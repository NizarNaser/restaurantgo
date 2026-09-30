<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReservationController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $reservations = Reservation::where('tenant_id', app('tenant')->id)
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->branch_id, fn ($q) => $q->where('branch_id', $request->branch_id))
            ->orderByDesc('reserved_at')
            ->paginate($request->per_page ?? 20);

        return response()->json($reservations);
    }

    public function update(Request $request, Reservation $reservation): JsonResponse
    {
        $this->authorizeTenant($reservation);

        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'confirmed', 'cancelled', 'completed'])],
        ]);

        $reservation->update($data);
        $this->audit->log('reservation.status_updated', $reservation, ['new' => $data]);

        return response()->json($reservation);
    }

    private function authorizeTenant(Reservation $reservation): void
    {
        abort_if((int) $reservation->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
