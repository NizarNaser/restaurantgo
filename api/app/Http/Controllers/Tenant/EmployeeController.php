<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Http\Requests\EmployeeRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;

class EmployeeController extends Controller
{
    public function __construct(private AuditService $audit)
    {
    }

    public function index(): JsonResponse
    {
        $employees = Employee::where('tenant_id', app('tenant')->id)
            ->orderBy('id', 'desc')
            ->get();

        return response()->json(EmployeeResource::collection($employees));
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        $employee = new Employee($request->validated());
        $employee->tenant_id = app('tenant')->id;
        $employee->save();

        $this->audit->log('employee.created', $employee);

        return response()->json(new EmployeeResource($employee), 201);
    }

    public function show(Employee $employee): JsonResponse
    {
        $this->authorizeTenant($employee);
        return response()->json(new EmployeeResource($employee));
    }

    public function update(EmployeeRequest $request, Employee $employee): JsonResponse
    {
        $this->authorizeTenant($employee);

        $employee->update($request->validated());
        $this->audit->log('employee.updated', $employee);

        return response()->json(new EmployeeResource($employee));
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->authorizeTenant($employee);
        
        $this->audit->log('employee.deleted', $employee);
        $employee->delete();

        return response()->json(['message' => 'Employee deleted successfully.']);
    }

    private function authorizeTenant(Employee $employee): void
    {
        abort_if((int) $employee->tenant_id !== (int) app('tenant')->id, 403, 'Forbidden.');
    }
}
