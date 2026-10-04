<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Jobs\TranslateTenantContentJob;
use App\Models\Department;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function __construct(private readonly AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $departments = Department::where('tenant_id', app('tenant')->id)
            ->with('translations')
            ->orderBy('sort_order')
            ->get()
            ->map(function (Department $department) {
                $department->name = $department->translation()?->name ?? $department->name;
                return $department;
            });

        return response()->json($departments);
    }

    public function store(Request $request): JsonResponse
    {
        $tenant = app('tenant');

        $data = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer'],
        ]);

        $department = Department::create(array_merge($data, ['tenant_id' => $tenant->id]));

        // Not app()->getLocale(): see MenuCategoryController for why that's
        // derived from the admin's raw browser Accept-Language header rather
        // than a locale actually meaningful to this tenant.
        $department->translations()->create([
            'locale' => $tenant->default_locale ?? 'en',
            'name'   => $data['name'],
        ]);

        TranslateTenantContentJob::dispatchForMissingLocales($tenant, $department->load('translations'));

        $this->audit->log('department.created', $department);

        return response()->json($department, 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $this->authorizeTenant($department);
        $tenant = app('tenant');

        $data = $request->validate([
            'name'        => ['sometimes', 'string', 'max:255'],
            'sort_order'  => ['sometimes', 'integer'],
            'kds_enabled' => ['sometimes', 'boolean'],
        ]);

        $department->update($data);

        if (isset($data['name'])) {
            $department->translations()->updateOrCreate(
                ['locale' => $tenant->default_locale ?? 'en'],
                ['name' => $data['name']],
            );
        }

        TranslateTenantContentJob::dispatchForMissingLocales($tenant, $department->load('translations'));

        $this->audit->log('department.updated', $department, $data);

        return response()->json($department);
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->authorizeTenant($department);

        $this->audit->log('department.deleted', $department);
        $department->delete();

        return response()->json(['message' => 'Department deleted.']);
    }

    private function authorizeTenant(Department $department): void
    {
        abort_if((int) $department->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
