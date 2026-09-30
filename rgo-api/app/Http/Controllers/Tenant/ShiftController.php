<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Shift;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    /** Whichever shift is open right now — any authenticated staff member can check this. */
    public function current(Request $request): JsonResponse
    {
        $shift = Shift::where('tenant_id', app('tenant')->id)
            ->openShift()
            ->when($request->user()->branch_id, fn ($q) => $q->where(fn ($q) => $q->whereNull('branch_id')->orWhere('branch_id', $request->user()->branch_id)))
            ->with('openedBy:id,name')
            ->latest('opened_at')
            ->first();

        // response()->json(null) serializes to `{}` (Symfony's JsonResponse
        // replaces a null payload with an empty object) — the frontend
        // checks for a truthy `.id` rather than a strict null/empty check.
        return response()->json($shift);
    }

    public function index(Request $request): JsonResponse
    {
        $shifts = Shift::where('tenant_id', app('tenant')->id)
            ->with('openedBy:id,name', 'closedBy:id,name')
            ->orderByDesc('opened_at')
            ->paginate($request->per_page ?? 20);

        return response()->json($shifts);
    }

    public function open(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id'     => ['nullable', 'integer', 'exists:branches,id'],
            'opening_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $branchId = $data['branch_id'] ?? $request->user()->branch_id;

        $alreadyOpen = Shift::where('tenant_id', app('tenant')->id)
            ->openShift()
            ->where('branch_id', $branchId)
            ->exists();
        abort_if($alreadyOpen, 422, 'A shift is already open.');

        $shift = Shift::create([
            'branch_id'         => $branchId,
            'opened_by_user_id' => $request->user()->id,
            'opened_at'         => now(),
            'status'            => Shift::STATUS_OPEN,
            'opening_notes'     => $data['opening_notes'] ?? null,
        ]);

        $this->audit->log('shift.opened', $shift);

        return response()->json($shift, 201);
    }

    public function close(Request $request, Shift $shift): JsonResponse
    {
        $this->authorizeTenant($shift);
        abort_if(! $shift->isOpen(), 422, 'This shift is already closed.');

        $data = $request->validate([
            'closing_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $shift->update([
            'status'          => Shift::STATUS_CLOSED,
            'closed_by_user_id' => $request->user()->id,
            'closed_at'       => now(),
            'closing_notes'   => $data['closing_notes'] ?? null,
        ]);

        $this->audit->log('shift.closed', $shift);

        return response()->json($shift);
    }

    /** Sales totals for one shift — orders are attributed to it at completion time, not creation. */
    public function summary(Shift $shift): JsonResponse
    {
        $this->authorizeTenant($shift);

        $orders = Order::where('tenant_id', app('tenant')->id)->where('shift_id', $shift->id);

        return response()->json([
            'shift'         => $shift,
            'orders_count'  => (clone $orders)->count(),
            'total_sales'   => (clone $orders)->sum('total'),
        ]);
    }

    private function authorizeTenant(Shift $shift): void
    {
        abort_if((int) $shift->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
