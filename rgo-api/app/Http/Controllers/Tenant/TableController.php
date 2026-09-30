<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Hall;
use App\Models\Order;
use App\Models\Table;
use App\Services\AuditService;
use App\Services\OrderCompletionService;
use App\Services\StaffAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TableController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly OrderCompletionService $orderCompletion,
        private readonly StaffAccessService $staffAccess,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $tables = Table::where('tenant_id', app('tenant')->id)
            ->when($request->hall_id, fn ($q) => $q->where('hall_id', $request->hall_id))
            ->get();

        return response()->json($tables);
    }

    /**
     * Read-only floor view for staff working the room (waiter/bartender and
     * above) — distinct from index() above, which backs the layout editor
     * and is gated behind "manage halls" instead.
     */
    public function floor(Request $request): JsonResponse
    {
        $tables = Table::where('tenant_id', app('tenant')->id)
            ->when($request->hall_id, fn ($q) => $q->where('hall_id', $request->hall_id))
            ->with('openedBy:id,name')
            ->get()
            ->map(function (Table $table) {
                $currentOrder = null;

                if ($table->isOccupied()) {
                    $order = Order::where('tenant_id', app('tenant')->id)
                        ->where('table_id', $table->id)
                        ->whereNotIn('status', ['completed', 'cancelled'])
                        ->latest()
                        ->first();

                    if ($order) {
                        $currentOrder = ['id' => $order->id, 'total' => $order->total];
                    }
                }

                return [
                    'id'            => $table->id,
                    'hall_id'       => $table->hall_id,
                    'table_number'  => $table->table_number,
                    'shape'         => $table->shape,
                    'pos_x'         => $table->pos_x,
                    'pos_y'         => $table->pos_y,
                    'width'         => $table->width,
                    'height'        => $table->height,
                    'status'        => $table->status,
                    'opened_at'     => $table->opened_at,
                    'opened_by'     => $table->openedBy?->name,
                    'current_order' => $currentOrder,
                ];
            });

        return response()->json($tables);
    }

    /**
     * A staff member with table-management rights opens a vacant table,
     * locking it to themselves and creating the (initially empty) dine-in
     * order that items will be added to.
     */
    public function open(Table $table): JsonResponse
    {
        $this->authorizeTenant($table);
        abort_if($table->isOccupied(), 422, 'This table is already occupied.');

        $tenant = app('tenant');
        $user = auth()->user();

        $order = DB::transaction(function () use ($tenant, $table, $user) {
            $order = Order::create([
                'tenant_id'         => $tenant->id,
                'branch_id'         => $table->hall->branch_id,
                'table_id'          => $table->id,
                'opened_by_user_id' => $user->id,
                'type'              => Order::TYPE_DINE_IN,
                'source'            => 'staff',
                'status'            => 'pending',
                'subtotal'          => 0,
                'total'             => 0,
                'currency'          => $tenant->default_currency ?? 'USD',
                'tracking_code'     => Str::upper(Str::random(8)),
            ]);

            $table->update([
                'status'             => Table::STATUS_OCCUPIED,
                'opened_by_user_id'  => $user->id,
                'opened_at'          => now(),
            ]);

            return $order;
        });

        $this->audit->log('table.opened', $table, ['order_id' => $order->id]);

        return response()->json(['table' => $table->fresh(), 'order' => Order::withDisplayItems($order->load('items'))], 201);
    }

    /**
     * Frees a table back to vacant. An order with items gets marked paid
     * (a real closed sale); an order with no items (opened by mistake, or
     * the customer left before ordering) gets cancelled instead — nothing
     * was actually sold, so it shouldn't show up as a $0 "paid" sale later
     * on the Sales page.
     */
    public function close(Table $table): JsonResponse
    {
        $this->authorizeTenant($table);
        abort_if($table->isVacant(), 422, 'This table is already vacant.');

        $order = Order::where('tenant_id', app('tenant')->id)
            ->where('table_id', $table->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->withCount('items')
            ->latest()
            ->first();

        abort_if(! $order, 422, 'This table has no open order to close.');
        abort_unless($table->canBeManagedBy(auth()->user()), 403, 'This table is locked to another staff member.');

        DB::transaction(function () use ($table, $order) {
            if ($order->items_count > 0) {
                $order->update([
                    'status'         => 'completed',
                    'payment_status' => Order::PAYMENT_STATUS_PAID,
                    'paid_at'        => now(),
                ]);
                $this->orderCompletion->complete($order);
            } else {
                $order->update(['status' => 'cancelled']);
            }

            $table->update([
                'status'            => Table::STATUS_VACANT,
                'opened_by_user_id' => null,
                'opened_at'         => null,
            ]);
        });

        $this->audit->log('table.closed', $table, ['order_id' => $order->id]);

        return response()->json(['table' => $table->fresh(), 'order' => Order::withDisplayItems($order->fresh()->load('items'))]);
    }

    /**
     * The dine-in order currently open on a table — locked to its opener (or
     * an owner/manager override): a staff member can't see or act on another
     * staff member's open order at all, not even read-only.
     */
    public function currentOrder(Table $table): JsonResponse
    {
        $this->authorizeTenant($table);
        abort_unless($table->canBeManagedBy(auth()->user()), 403, 'This table is being handled by another staff member.');

        $order = Order::where('tenant_id', app('tenant')->id)
            ->where('table_id', $table->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->with('items')
            ->latest()
            ->first();

        abort_if(! $order, 404, 'This table has no open order.');

        return response()->json([
            'order'     => Order::withDisplayItems($order),
            'can_edit'  => true,
            'opened_by' => $table->openedBy?->name,
        ]);
    }

    /**
     * Moves every open order on a table to a different (vacant) table — e.g.
     * the customer/party asked to be reseated. Gated by the "transfer tables"
     * permission (owner/manager only) *and*, on top of that, the same
     * step-up credential check used for discount approval — a second,
     * explicit confirmation before the move happens.
     */
    public function transfer(Request $request, Table $table): JsonResponse
    {
        $this->authorizeTenant($table);
        abort_if($table->isVacant(), 422, 'This table has no order to transfer.');

        $data = $request->validate([
            'to_table_id' => ['required', 'integer', 'exists:tables,id'],
        ]);
        abort_if((int) $data['to_table_id'] === (int) $table->id, 422, 'Choose a different table to transfer to.');

        $destination = Table::where('tenant_id', app('tenant')->id)->findOrFail($data['to_table_id']);
        abort_unless($destination->isVacant(), 422, 'The destination table is not vacant.');

        $orders = Order::where('tenant_id', app('tenant')->id)
            ->where('table_id', $table->id)
            ->whereNotIn('status', ['completed', 'cancelled'])
            ->get();

        abort_if($orders->isEmpty(), 422, 'This table has no open order to transfer.');

        $approver = $this->staffAccess->resolveApprover($request);
        abort_unless($approver, 401, 'Could not verify an owner/manager credential.');
        abort_unless($approver->hasRole(['owner', 'manager']), 403, 'Only an owner or manager can approve a table transfer.');

        DB::transaction(function () use ($table, $destination, $orders) {
            foreach ($orders as $order) {
                $order->update(['table_id' => $destination->id]);
            }

            $destination->update([
                'status'            => Table::STATUS_OCCUPIED,
                'opened_by_user_id' => $table->opened_by_user_id,
                'opened_at'         => $table->opened_at,
            ]);

            $table->update([
                'status'            => Table::STATUS_VACANT,
                'opened_by_user_id' => null,
                'opened_at'         => null,
            ]);
        });

        $this->audit->log('table.transferred', $table, [
            'from_table_id' => $table->id,
            'to_table_id'   => $destination->id,
            'order_ids'     => $orders->pluck('id')->all(),
        ], $approver);

        return response()->json(['from' => $table->fresh(), 'to' => $destination->fresh(), 'orders' => $orders->fresh()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hall_id'       => ['required', 'integer', 'exists:halls,id'],
            'table_number'  => ['required', 'string', 'max:50'],
            'capacity'      => ['nullable', 'integer', 'min:1'],
            'shape'         => ['nullable', Rule::in(['round', 'square', 'rect'])],
            'pos_x'         => ['nullable', 'integer'],
            'pos_y'         => ['nullable', 'integer'],
            'width'         => ['nullable', 'integer', 'min:20'],
            'height'        => ['nullable', 'integer', 'min:20'],
        ]);

        $hall = Hall::where('tenant_id', app('tenant')->id)->findOrFail($data['hall_id']);

        $table = Table::create(array_merge($data, ['tenant_id' => app('tenant')->id, 'hall_id' => $hall->id]));
        $this->audit->log('table.created', $table);

        return response()->json($table, 201);
    }

    public function update(Request $request, Table $table): JsonResponse
    {
        $this->authorizeTenant($table);

        $data = $request->validate([
            'table_number' => ['sometimes', 'string', 'max:50'],
            'capacity'     => ['sometimes', 'nullable', 'integer', 'min:1'],
            'shape'        => ['sometimes', Rule::in(['round', 'square', 'rect'])],
            'pos_x'        => ['sometimes', 'integer'],
            'pos_y'        => ['sometimes', 'integer'],
            'width'        => ['sometimes', 'integer', 'min:20'],
            'height'       => ['sometimes', 'integer', 'min:20'],
            'hall_id'      => ['sometimes', 'integer', 'exists:halls,id'],
        ]);

        $table->update($data);
        $this->audit->log('table.updated', $table, $data);

        return response()->json($table);
    }

    public function destroy(Table $table): JsonResponse
    {
        $this->authorizeTenant($table);

        abort_if($table->isOccupied(), 422, 'This table currently has an open order and cannot be deleted.');

        $this->audit->log('table.deleted', $table);
        $table->delete();

        return response()->json(['message' => 'Table deleted.']);
    }

    private function authorizeTenant(Table $table): void
    {
        abort_if((int) $table->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
