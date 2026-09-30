<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function checkin(Request $request): JsonResponse
    {
        $request->validate(['employee_id' => 'required|integer', 'branch_id' => 'nullable|integer', 'notes' => 'nullable|string']);

        $tenant   = app('tenant');
        $employee = Employee::where('tenant_id', $tenant->id)->findOrFail($request->employee_id);

        // Prevent double check-in
        $open = AttendanceRecord::where('employee_id', $employee->id)
                                ->whereNull('check_out')
                                ->latest()
                                ->first();
        if ($open) {
            return response()->json(['message' => 'Employee already checked in.'], 422);
        }

        $record = AttendanceRecord::create([
            'tenant_id'   => $tenant->id,
            'employee_id' => $employee->id,
            'branch_id'   => $request->branch_id,
            'check_in'    => now(),
            'type'        => 'manual',
            'notes'       => $request->notes,
            'created_by'  => $request->user()->id,
        ]);

        return response()->json(['message' => 'Checked in.', 'record' => $record], 201);
    }

    public function checkout(Request $request): JsonResponse
    {
        $request->validate(['employee_id' => 'required|integer', 'notes' => 'nullable|string']);

        $tenant   = app('tenant');
        $record   = AttendanceRecord::where('tenant_id', $tenant->id)
                                    ->where('employee_id', $request->employee_id)
                                    ->whereNull('check_out')
                                    ->latest()
                                    ->firstOrFail();

        $record->update(['check_out' => now(), 'notes' => $request->notes ?? $record->notes]);

        return response()->json([
            'message'      => 'Checked out.',
            'hours_worked' => $record->hoursWorked(),
            'record'       => $record,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $tenant  = app('tenant');
        $records = AttendanceRecord::where('tenant_id', $tenant->id)
            ->when($request->employee_id, fn($q) => $q->where('employee_id', $request->employee_id))
            ->when($request->branch_id, fn($q) => $q->where('branch_id', $request->branch_id))
            ->when($request->from, fn($q) => $q->where('check_in', '>=', $request->from))
            ->when($request->to, fn($q) => $q->where('check_in', '<=', $request->to))
            ->with('employee', 'branch')
            ->latest('check_in')
            ->paginate($request->per_page ?? 30);

        return response()->json($records);
    }
}
