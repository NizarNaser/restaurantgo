<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\StaffCard;
use App\Models\User;
use App\Services\AuditService;
use App\Services\StaffAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffCardController extends Controller
{
    public function __construct(
        private readonly AuditService $audit,
        private readonly StaffAccessService $staffAccess,
    ) {
    }

    public function index(): JsonResponse
    {
        $cards = StaffCard::where('tenant_id', app('tenant')->id)->with('user:id,name,email')->get();

        return response()->json($cards);
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'user_id'         => ['required', 'integer', 'exists:users,id'],
            'card_identifier' => ['required', 'string', 'max:255', 'unique:staff_cards,card_identifier'],
            'access_code'     => ['required', 'string', 'min:4', 'max:50'],
        ]);

        $user = User::where('tenant_id', $tenant->id)->findOrFail($data['user_id']);
        abort_if($user->staffCard()->exists(), 422, 'This staff member already has a card.');

        $card = StaffCard::create([
            'tenant_id'       => $tenant->id,
            'user_id'         => $user->id,
            'card_identifier' => $data['card_identifier'],
            'access_code'     => $data['access_code'],
        ]);

        $this->audit->log('staff_card.created', $card);

        return response()->json($card->load('user:id,name,email'), 201);
    }

    public function update(Request $request, StaffCard $staffCard): JsonResponse
    {
        $this->authorizeTenant($staffCard);

        $data = $request->validate([
            'card_identifier' => ['sometimes', 'string', 'max:255', 'unique:staff_cards,card_identifier,' . $staffCard->id],
            'access_code'     => ['sometimes', 'string', 'min:4', 'max:50'],
            'is_active'       => ['sometimes', 'boolean'],
        ]);

        $staffCard->update($data);
        $this->audit->log('staff_card.updated', $staffCard, ['fields' => array_keys($data)]);

        return response()->json($staffCard->load('user:id,name,email'));
    }

    public function destroy(StaffCard $staffCard): JsonResponse
    {
        $this->authorizeTenant($staffCard);

        $this->audit->log('staff_card.deleted', $staffCard);
        $staffCard->delete();

        return response()->json(['message' => 'Staff card deleted.']);
    }

    /**
     * Called by the card-reader device at the entrance/POS: toggles the
     * linked employee's attendance (open a check-in if none is open, close
     * the open one otherwise) — reuses the exact same AttendanceRecord
     * ledger as the manual HR check-in/check-out, per the "one attendance
     * system, not two" decision.
     */
    public function swipe(Request $request): JsonResponse
    {
        $data = $request->validate(['card_identifier' => ['required', 'string']]);

        $card = StaffCard::where('tenant_id', app('tenant')->id)
            ->where('card_identifier', $data['card_identifier'])
            ->where('is_active', true)
            ->with('user')
            ->first();

        abort_if(! $card, 404, 'Unrecognized card.');
        abort_if(! $card->user->employee_id, 422, "This staff member's login isn't linked to an HR employee record.");

        $open = AttendanceRecord::where('employee_id', $card->user->employee_id)
            ->whereNull('check_out')
            ->latest()
            ->first();

        if ($open) {
            $open->update(['check_out' => now()]);

            return response()->json(['action' => 'checked_out', 'name' => $card->user->name, 'record' => $open]);
        }

        $record = AttendanceRecord::create([
            'tenant_id'   => app('tenant')->id,
            'employee_id' => $card->user->employee_id,
            'branch_id'   => $card->user->branch_id,
            'check_in'    => now(),
            'type'        => 'card',
            'created_by'  => $card->user_id,
        ]);

        return response()->json(['action' => 'checked_in', 'name' => $card->user->name, 'record' => $record], 201);
    }

    /**
     * Resolves the staff member behind a manually-typed access code — used by
     * the phone/tablet app to authenticate table actions, and by the discount
     * approval flow (a different owner/manager confirming in person).
     */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate(['access_code' => ['required', 'string']]);

        $user = $this->staffAccess->resolveByAccessCode($data['access_code']);
        abort_if(! $user, 422, 'Invalid access code.');

        return response()->json([
            'user_id'     => $user->id,
            'name'        => $user->name,
            'roles'       => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ]);
    }

    private function authorizeTenant(StaffCard $card): void
    {
        abort_if((int) $card->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
