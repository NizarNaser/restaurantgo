<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A live, per-department alternative to a printed kitchen/bar ticket.
 * Tracks progress independently of the parent Order's own status (which
 * tracks payment/table lifecycle, not per-department prep) via
 * `order_items.kitchen_status`/`started_at`/`ready_at`/`collected_at`
 * columns. A "ticket" here means every item from one addItems() round
 * (one `batch_id`) that belongs to one department, moved together as a
 * single unit (start/finish/collect apply to the whole ticket, not one
 * item at a time) — a table's second round of orders shows up as its own
 * ticket alongside an earlier round that's already preparing/ready,
 * rather than being folded into it. Items written before `batch_id`
 * existed (null) each order still collapses into one legacy ticket.
 */
class KitchenDisplayController extends Controller
{
    /** Departments this tenant has, for the screen's department picker. */
    public function departments(): JsonResponse
    {
        $departments = Department::where('tenant_id', app('tenant')->id)
            ->orderBy('sort_order')
            ->get(['id', 'name', 'kds_enabled']);

        return response()->json($departments);
    }

    /** Live tickets for one department's screen, one per (order, batch), newest-created first. */
    public function index(Department $department): JsonResponse
    {
        $this->authorizeTenant($department);
        $tenantId = app('tenant')->id;

        $orderIds = OrderItem::query()
            ->join('menu_items', 'menu_items.id', '=', 'order_items.menu_item_id')
            ->join('menu_categories', 'menu_categories.id', '=', 'menu_items.menu_category_id')
            ->where('menu_categories.department_id', $department->id)
            ->whereNull('order_items.collected_at')
            ->distinct()
            ->pluck('order_items.order_id');

        $orders = Order::where('tenant_id', $tenantId)
            ->whereIn('id', $orderIds)
            ->where('status', '!=', 'cancelled')
            ->with(['table.hall', 'items' => function ($query) use ($department) {
                $query->whereHas('menuItem.category', fn (Builder $q) => $q->where('department_id', $department->id))
                    ->whereNull('collected_at')
                    ->orderBy('created_at');
            }])
            ->get();

        $tickets = $orders->flatMap(function (Order $order) {
            return $order->items
                ->groupBy('batch_id') // null groups together too — one legacy ticket per order
                ->map(function ($items) use ($order) {
                    $allReady = $items->every(fn (OrderItem $i) => $i->kitchen_status === OrderItem::KITCHEN_STATUS_READY);
                    $anyPreparing = $items->contains(fn (OrderItem $i) => $i->kitchen_status === OrderItem::KITCHEN_STATUS_PREPARING);

                    return [
                        'order_id'      => $order->id,
                        'batch_id'      => $items->first()->batch_id,
                        'table_number'  => $order->table?->table_number,
                        'hall_name'     => $order->table?->hall?->name,
                        'customer_name' => $order->customer_name,
                        'created_at'    => $items->min('created_at') ?? $order->created_at,
                        'status'        => $allReady ? 'ready' : ($anyPreparing ? 'preparing' : 'new'),
                        'items'         => $items->map(fn (OrderItem $i) => [
                            'id'             => $i->id,
                            'name'           => $i->name,
                            'quantity'       => $i->quantity,
                            'weight'         => $i->weight,
                            'notes'          => $i->notes,
                            'kitchen_status' => $i->kitchen_status,
                        ])->values(),
                    ];
                });
        })->sortBy('created_at')->values();

        return response()->json($tickets);
    }

    public function start(Request $request, Department $department, Order $order): JsonResponse
    {
        $this->authorizeTenant($department);
        $this->authorizeOrder($order);

        $this->departmentItems($order, $department, $request->query('batch_id'))
            ->where('kitchen_status', OrderItem::KITCHEN_STATUS_PENDING)
            ->update(['kitchen_status' => OrderItem::KITCHEN_STATUS_PREPARING, 'started_at' => now()]);

        return response()->json(['message' => 'Ticket started.']);
    }

    public function finish(Request $request, Department $department, Order $order): JsonResponse
    {
        $this->authorizeTenant($department);
        $this->authorizeOrder($order);

        $this->departmentItems($order, $department, $request->query('batch_id'))
            ->whereIn('kitchen_status', [OrderItem::KITCHEN_STATUS_PENDING, OrderItem::KITCHEN_STATUS_PREPARING])
            ->update(['kitchen_status' => OrderItem::KITCHEN_STATUS_READY, 'ready_at' => now()]);

        return response()->json(['message' => 'Ticket marked ready.']);
    }

    /** Hides this ticket from the screen once it's been picked up/served. */
    public function collect(Request $request, Department $department, Order $order): JsonResponse
    {
        $this->authorizeTenant($department);
        $this->authorizeOrder($order);

        $this->departmentItems($order, $department, $request->query('batch_id'))->update(['collected_at' => now()]);

        return response()->json(['message' => 'Ticket collected.']);
    }

    /**
     * Scoped to one ticket: this order's items in this department, further
     * narrowed to one batch — the exact ticket the screen has open — rather
     * than every round the table has ever ordered in this department.
     */
    private function departmentItems(Order $order, Department $department, ?string $batchId)
    {
        return OrderItem::where('order_id', $order->id)
            ->whereHas('menuItem.category', fn (Builder $q) => $q->where('department_id', $department->id))
            ->when($batchId, fn ($q) => $q->where('batch_id', $batchId), fn ($q) => $q->whereNull('batch_id'));
    }

    private function authorizeTenant(Department $department): void
    {
        abort_if((int) $department->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }

    private function authorizeOrder(Order $order): void
    {
        abort_if((int) $order->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
