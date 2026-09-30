<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Resources\StaffAccountResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Lets a tenant owner/manager create login accounts for their own staff
 * (waiters, bartenders, managers) — something that previously only ever
 * happened once, automatically, for the tenant owner at signup. Deliberately
 * separate from the HR `Employee` payroll record: this is about who can log
 * in and what they're allowed to do, not attendance/salary.
 */
class StaffAccountController extends Controller
{
    /** Owner is never assignable here — it's created exactly once, at tenant signup. */
    private const ASSIGNABLE_ROLES = ['manager', 'staff', 'waiter', 'bartender', 'kitchen_display'];

    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $users = User::where('tenant_id', app('tenant')->id)
            ->with('roles')
            ->orderBy('name')
            ->get();

        return response()->json(StaffAccountResource::collection($users));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'email'     => ['required', 'email', 'unique:users'],
            'password'  => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'role'      => ['required', Rule::in(self::ASSIGNABLE_ROLES)],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        $tenant = app('tenant');

        $user = DB::transaction(function () use ($tenant, $data) {
            $user = User::create([
                'tenant_id' => $tenant->id,
                'branch_id' => $data['branch_id'] ?? null,
                'name'      => $data['name'],
                'email'     => $data['email'],
                'password'  => Hash::make($data['password']),
                'is_active' => true,
            ]);
            $user->assignRole($data['role']);

            return $user;
        });

        $this->audit->log('staff_account.created', $user, ['role' => $data['role']]);

        return response()->json(new StaffAccountResource($user->load('roles')), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorizeTenant($user);

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'role'        => ['sometimes', Rule::in(self::ASSIGNABLE_ROLES)],
            'branch_id'   => ['sometimes', 'nullable', 'integer', 'exists:branches,id'],
            'is_active'   => ['sometimes', 'boolean'],
            // Links this login to its HR payroll record, so a staff card's
            // attendance swipe feeds the existing Employee/AttendanceRecord
            // pipeline — see StaffCardController::swipe().
            'employee_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            // Resets this staff member's password — e.g. they forgot it, or
            // an owner/manager is issuing new credentials.
            'password'    => ['sometimes', 'confirmed', Password::min(8)->mixedCase()->numbers()],
        ]);

        $user->update(collect($data)->only(['name', 'branch_id', 'is_active', 'employee_id'])->all());

        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        if (isset($data['password'])) {
            $user->update(['password' => Hash::make($data['password'])]);
        }

        $this->audit->log('staff_account.updated', $user, $data);

        return response()->json(new StaffAccountResource($user->load('roles')));
    }

    private function authorizeTenant(User $user): void
    {
        abort_if((int) $user->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
        abort_if($user->hasRole('owner'), 403, "The owner's account can't be managed here.");
    }
}
