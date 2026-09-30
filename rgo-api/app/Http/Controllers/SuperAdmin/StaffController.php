<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StaffRequest;
use App\Http\Resources\StaffResource;
use App\Models\Staff;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class StaffController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $staff = Staff::with('user.roles')->orderBy('id', 'desc')->get();

        return response()->json(StaffResource::collection($staff));
    }

    public function store(StaffRequest $request): JsonResponse
    {
        $data = $request->validated();

        $staff = DB::transaction(function () use ($data) {
            $staff = Staff::create(collect($data)->only([
                'name', 'email', 'phone', 'position', 'department',
                'base_salary', 'currency', 'overtime_rate', 'hire_date',
                'status', 'bank_account', 'notes',
            ])->toArray());

            if (! empty($data['create_login'])) {
                $user = User::create([
                    'tenant_id' => null,
                    'name'      => $staff->name,
                    'email'     => $data['login_email'],
                    'password'  => Hash::make($data['login_password']),
                    'is_active' => true,
                ]);
                $user->assignRole($data['role']);
                $staff->update(['user_id' => $user->id]);
            }

            return $staff;
        });

        $this->audit->log('staff.created', $staff);

        return response()->json(new StaffResource($staff->load('user.roles')), 201);
    }

    public function show(Staff $staffMember): JsonResponse
    {
        return response()->json(new StaffResource($staffMember->load('user.roles')));
    }

    public function update(StaffRequest $request, Staff $staffMember): JsonResponse
    {
        $data = $request->validated();

        $staffMember->update(collect($data)->only([
            'name', 'email', 'phone', 'position', 'department',
            'base_salary', 'currency', 'overtime_rate', 'hire_date',
            'status', 'bank_account', 'notes',
        ])->toArray());

        if ($staffMember->user_id) {
            // Edit the existing linked login instead of creating a new one.
            $user = $staffMember->user;
            $user->fill([
                'name'      => $staffMember->name,
                'email'     => $data['login_email'] ?? $user->email,
                'is_active' => array_key_exists('login_is_active', $data) ? $data['login_is_active'] : $user->is_active,
            ]);
            if (! empty($data['login_password'])) {
                $user->password = Hash::make($data['login_password']);
            }
            $user->save();

            if (! empty($data['role'])) {
                $user->syncRoles([$data['role']]);
            }
        } elseif (! empty($data['create_login'])) {
            $user = User::create([
                'tenant_id' => null,
                'name'      => $staffMember->name,
                'email'     => $data['login_email'],
                'password'  => Hash::make($data['login_password']),
                'is_active' => true,
            ]);
            $user->assignRole($data['role']);
            $staffMember->update(['user_id' => $user->id]);
        }

        $this->audit->log('staff.updated', $staffMember);

        return response()->json(new StaffResource($staffMember->load('user.roles')));
    }

    public function destroy(Staff $staffMember): JsonResponse
    {
        $this->audit->log('staff.deleted', $staffMember);

        // Revoke dashboard access along with the HR record, if any was granted.
        $staffMember->user?->tokens()->delete();
        $staffMember->user?->delete();
        $staffMember->delete();

        return response()->json(['message' => 'Staff member deleted.']);
    }
}
