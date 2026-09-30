<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReservationController extends Controller
{
    use ResolvesPublicTenant;

    public function store(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $data = $request->validate([
            'branch_id'      => ['nullable', 'integer', 'exists:branches,id'],
            'type'           => ['required', Rule::in(['table', 'event'])],
            'customer_name'  => ['required', 'string', 'max:255'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:50'],
            'party_size'     => ['required', 'integer', 'min:1', 'max:500'],
            'event_name'     => ['required_if:type,event', 'nullable', 'string', 'max:255'],
            'reserved_at'    => ['required', 'date', 'after:now'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);

        $branch = $tenant->branches()
            ->when($data['branch_id'] ?? null, fn ($q) => $q->where('id', $data['branch_id']))
            ->where('is_active', true)
            ->first();

        $reservation = Reservation::create([
            'tenant_id'      => $tenant->id,
            'branch_id'      => $branch?->id,
            'type'           => $data['type'],
            'customer_name'  => $data['customer_name'],
            'customer_email' => $data['customer_email'] ?? null,
            'customer_phone' => $data['customer_phone'],
            'party_size'     => $data['party_size'],
            'event_name'     => $data['event_name'] ?? null,
            'reserved_at'    => $data['reserved_at'],
            'status'         => 'pending',
            'notes'          => $data['notes'] ?? null,
        ]);

        return response()->json([
            'message' => 'Your reservation request has been sent. The restaurant will confirm it shortly.',
            'reservation' => $reservation,
        ], 201);
    }
}
