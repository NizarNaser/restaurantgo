<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\AuditService;
use App\Services\Currency;
use App\Services\OrderCompletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly OrderCompletionService $orderCompletion,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $orders = Order::where('tenant_id', app('tenant')->id)
            ->with('items')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->shift_id, fn ($q) => $q->where('shift_id', $request->shift_id))
            // Delivery/takeout orders awaiting payment aren't real kitchen
            // orders yet — hide them unless explicitly asked for.
            ->unless($request->boolean('include_unpaid'), fn ($q) => $q->where(
                fn ($q) => $q->whereNull('payment_status')->orWhere('payment_status', Order::PAYMENT_STATUS_PAID)
            ))
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 20);

        return response()->json($orders);
    }

    /**
     * A member of staff (waiter/customer-service) takes an order on a
     * customer's behalf — same pricing/validation as the public QR flow,
     * but the table is typed in rather than resolved from a scanned code.
     */
    public function store(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'branch_id'              => ['nullable', 'integer', 'exists:branches,id'],
            'table_number'           => ['required', 'string', 'max:50'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.menu_item_id'   => ['required', 'integer'],
            'items.*.quantity'       => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes'          => ['nullable', 'string', 'max:500'],
            'customer_name'          => ['nullable', 'string', 'max:255'],
            'customer_phone'         => ['nullable', 'string', 'max:50'],
            'notes'                  => ['nullable', 'string', 'max:1000'],
        ]);

        $branch = isset($data['branch_id'])
            ? Branch::where('id', $data['branch_id'])->where('tenant_id', $tenant->id)->firstOrFail()
            : Branch::where('tenant_id', $tenant->id)->first();

        $menuItems = MenuItem::where('tenant_id', $tenant->id)
            ->available()
            ->whereIn('id', collect($data['items'])->pluck('menu_item_id'))
            ->get()
            ->keyBy('id');

        abort_unless(
            collect($data['items'])->every(fn ($line) => $menuItems->has($line['menu_item_id'])),
            422,
            'One or more items are no longer available.'
        );

        $order = DB::transaction(function () use ($tenant, $branch, $menuItems, $data) {
            $currency = $tenant->default_currency ?? 'USD';

            $order = Order::create([
                'tenant_id'      => $tenant->id,
                'branch_id'      => $branch?->id,
                'table_number'   => $data['table_number'],
                'type'           => 'dine_in',
                'source'         => 'staff',
                'customer_name'  => $data['customer_name'] ?? null,
                'customer_phone' => $data['customer_phone'] ?? null,
                'status'         => 'pending',
                'notes'          => $data['notes'] ?? null,
                'subtotal'       => 0,
                'total'          => 0,
                'currency'       => $currency,
                'tracking_code'  => Str::upper(Str::random(8)),
            ]);

            $subtotal = 0;
            $batchId = (string) Str::uuid();
            foreach ($data['items'] as $line) {
                $menuItem = $menuItems[$line['menu_item_id']];
                $unitPrice = $menuItem->priceIn($currency);
                $lineSubtotal = Currency::round($unitPrice * $line['quantity'], $currency);
                $subtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'name'         => $menuItem->translation()?->name ?? $menuItem->sku ?? 'Item',
                    'weight'       => $menuItem->weight,
                    'unit_price'   => $unitPrice,
                    'quantity'     => $line['quantity'],
                    'subtotal'     => $lineSubtotal,
                    'notes'        => $line['notes'] ?? null,
                    'batch_id'     => $batchId,
                ]);
            }

            $order->update(['subtotal' => $subtotal, 'total' => $subtotal]);

            return $order;
        });

        $this->audit->log('order.created_by_staff', $order);

        return response()->json(Order::withDisplayItems($order->load('items')), 201);
    }

    /**
     * The printable bill for a dine-in table order: full itemized total plus
     * items split by department (Kitchen/Bar/etc.), so each department's
     * ticket only shows what it's responsible for preparing. This is the
     * content a department-routed printer (Phase 5's native app) sends —
     * building it here keeps it verifiable without real printer hardware.
     */
    public function invoice(Order $order): JsonResponse
    {
        $this->authorizeTenant($order);

        $order->load(['items.menuItem.category.department.translations', 'table.hall', 'openedBy']);

        // Department only ever depends on the menu item, so it's constant
        // across every raw row a grouped line was built from — look it up
        // once per menu item rather than per (already-collapsed) line.
        $departmentByMenuItemId = $order->items
            ->keyBy('menu_item_id')
            ->map(fn ($item) => $item->menuItem?->category?->department);

        $departments = [];
        $unassignedItems = [];
        $flatItems = [];

        foreach (OrderItem::groupForDisplay($order->items, $order->currency) as $groupedLine) {
            $line = collect($groupedLine)->except(['menu_item_id', 'notes'])->all();
            $flatItems[] = $line;

            $department = $departmentByMenuItemId[$groupedLine['menu_item_id']] ?? null;
            if ($department) {
                $departments[$department->id] ??= ['id' => $department->id, 'name' => $department->translation()?->name ?? $department->name, 'items' => []];
                $departments[$department->id]['items'][] = $line;
            } else {
                $unassignedItems[] = $line;
            }
        }

        $tenant = app('tenant');
        $taxRate = (float) $tenant->tax_rate;
        $taxAmount = Currency::round(((float) $order->total) * $taxRate / 100, $order->currency);

        // Dine-in only (this endpoint only ever serves the Halls & Tables
        // bill/invoice) — delivery/online orders never see this. The owner
        // can disclose the rate to customers without charging it yet (or
        // vice versa), hence the separate apply_to_invoice toggle.
        $serviceChargeRate = $tenant->service_charge_apply_to_invoice ? (float) $tenant->service_charge_rate : 0.0;
        $serviceChargeAmount = Currency::round(((float) $order->total) * $serviceChargeRate / 100, $order->currency);

        $grandTotal = Currency::round(((float) $order->total) + $taxAmount + $serviceChargeAmount, $order->currency);

        return response()->json([
            'order' => [
                'id'              => $order->id,
                'status'          => $order->status,
                'subtotal'        => $order->subtotal,
                'discount_amount' => $order->discount_amount,
                'total'           => $order->total,
                'tax_rate'    => $taxRate,
                'tax_amount'  => $taxAmount,
                'service_charge_rate'   => $serviceChargeRate,
                'service_charge_amount' => $serviceChargeAmount,
                'grand_total' => $grandTotal,
                'currency'    => $order->currency,
                'created_at'  => $order->created_at,
                'paid_at'     => $order->paid_at,
            ],
            'table'            => $order->table ? [
                'table_number' => $order->table->table_number,
                'hall_name'    => $order->table->hall?->name,
            ] : null,
            'opened_by'        => $order->openedBy?->name,
            'items'            => $flatItems,
            'departments'      => array_values($departments),
            'unassigned_items' => $unassignedItems,
        ]);
    }

    /**
     * Adds items to an already-open dine-in table order (Halls & Tables
     * flow) — distinct from store() above, which always creates a brand
     * new order. Locked to the table's opener, with an owner/manager
     * override, per the "only he and the admin can deal with this table"
     * requirement.
     */
    public function addItems(Request $request, Order $order): JsonResponse
    {
        $this->authorizeTenant($order);
        abort_if(! $order->table_id, 422, 'This order is not linked to a dine-in table.');

        $table = $order->table;
        abort_unless($table->canBeManagedBy(auth()->user()), 403, 'This table is locked to another staff member.');
        abort_if(in_array($order->status, ['completed', 'cancelled']), 422, 'This order is already closed.');

        $data = $request->validate([
            'items'                 => ['required', 'array', 'min:1'],
            'items.*.menu_item_id'  => ['required', 'integer'],
            'items.*.quantity'      => ['required', 'integer', 'min:1', 'max:50'],
            'items.*.notes'         => ['nullable', 'string', 'max:500'],
        ]);

        $tenant = app('tenant');

        $menuItems = MenuItem::where('tenant_id', $tenant->id)
            ->available()
            ->whereIn('id', collect($data['items'])->pluck('menu_item_id'))
            ->get()
            ->keyBy('id');

        abort_unless(
            collect($data['items'])->every(fn ($line) => $menuItems->has($line['menu_item_id'])),
            422,
            'One or more items are no longer available.'
        );

        DB::transaction(function () use ($order, $menuItems, $data) {
            $addedSubtotal = 0;
            $batchId = (string) Str::uuid();

            // Every addItems() call is its own independent kitchen round —
            // always a fresh OrderItem row per line, tagged with one batch_id
            // shared only within this call, never merged into an earlier
            // row/batch. The kitchen/KDS needs each round to stay a
            // distinct, independently-trackable ticket (its own
            // pending/preparing/ready/collected lifecycle) — see
            // KitchenDisplayController, which groups tickets by batch_id,
            // not by order — so a round that got folded into an
            // already-collected batch would vanish from the kitchen's view
            // instead of showing up as new work. The bill still shows one
            // consolidated line per dish — see OrderItem::groupForDisplay(),
            // applied when rendering the order/invoice back out, not when
            // writing these rows.
            foreach ($data['items'] as $line) {
                $menuItem = $menuItems[$line['menu_item_id']];
                $unitPrice = $menuItem->priceIn($order->currency);
                $lineSubtotal = Currency::round($unitPrice * $line['quantity'], $order->currency);
                $addedSubtotal += $lineSubtotal;

                $order->items()->create([
                    'menu_item_id' => $menuItem->id,
                    'name'         => $menuItem->translation()?->name ?? $menuItem->sku ?? 'Item',
                    'weight'       => $menuItem->weight,
                    'unit_price'   => $unitPrice,
                    'quantity'     => $line['quantity'],
                    'batch_id'     => $batchId,
                    'subtotal'     => $lineSubtotal,
                    'notes'        => $line['notes'] ?? null,
                ]);
            }

            $order->update([
                'subtotal' => $order->subtotal + $addedSubtotal,
                'total'    => $order->total + $addedSubtotal,
            ]);
        });

        $this->audit->log('order.items_added', $order, ['count' => count($data['items'])]);

        return response()->json(Order::withDisplayItems($order->fresh()->load('items')), 201);
    }

    public function update(Request $request, Order $order): JsonResponse
    {
        $this->authorizeTenant($order);

        abort_if($order->payment_status === Order::PAYMENT_STATUS_PENDING, 422, 'This order has not been paid yet.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'preparing', 'ready', 'completed', 'cancelled'])],
        ]);

        DB::transaction(function () use ($order, $data) {
            $order->update($data);

            if ($order->wasChanged('status') && $order->status === 'completed') {
                $this->orderCompletion->complete($order);
            }
        });

        $this->audit->log('order.status_updated', $order, ['new' => $data]);

        return response()->json($order);
    }

    /**
     * Cancels an order that hasn't been paid yet — the "delete a
     * reservation" action, admin/manager-only. Frees its table if it was
     * a dine-in order.
     */
    public function cancel(Order $order): JsonResponse
    {
        $this->authorizeTenant($order);
        abort_if($order->payment_status === Order::PAYMENT_STATUS_PAID, 422, 'A paid order can only be deleted as an invoice, not cancelled.');

        DB::transaction(function () use ($order) {
            $order->update(['status' => 'cancelled']);

            if ($order->table_id) {
                $order->table->update(['status' => 'vacant', 'opened_by_user_id' => null, 'opened_at' => null]);
            }
        });

        $this->audit->log('order.cancelled', $order);

        return response()->json(['message' => 'Order cancelled.']);
    }

    /**
     * Permanently deletes a paid invoice — owner-only ("super admin" per the
     * spec), distinct from cancel() above which only ever touches unpaid
     * orders. A manager can review/print invoices but never delete them.
     */
    public function destroy(Order $order): JsonResponse
    {
        $this->authorizeTenant($order);
        abort_if($order->payment_status !== Order::PAYMENT_STATUS_PAID, 422, 'Only a paid invoice can be deleted here — use cancel for an unpaid order.');
        abort_if($order->shift?->status === 'closed', 422, "This sale belongs to a closed shift and can't be modified anymore.");

        $this->audit->log('invoice.deleted', $order);
        $order->delete();

        return response()->json(['message' => 'Invoice deleted.']);
    }

    private function authorizeTenant(Order $order): void
    {
        abort_if((int) $order->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
