<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;

class PayrollService
{
    /**
     * Generate a payroll run for all active employees in a branch/tenant.
     */
    public function generate(Tenant $tenant, string $from, string $to, ?int $branchId, int $createdBy): PayrollRun
    {
        abort_if(
            PayrollRun::where('tenant_id', $tenant->id)
                ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
                ->where('period_start', $from)
                ->where('period_end', $to)
                ->where('status', '!=', 'paid')
                ->exists(),
            422,
            'A payroll run already exists for this period.',
        );

        return DB::transaction(function () use ($tenant, $from, $to, $branchId, $createdBy) {
            $run = PayrollRun::create([
                'tenant_id'    => $tenant->id,
                'branch_id'    => $branchId,
                'period_start' => $from,
                'period_end'   => $to,
                'currency'     => $tenant->default_currency,
                'status'       => 'draft',
                'created_by'   => $createdBy,
            ]);

            $employees = Employee::where('tenant_id', $tenant->id)
                ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
                ->active()
                ->get();

            // Standard hours a full-time employee is assumed to work over the
            // period: 8h/day, 22 working days — anything beyond that is overtime.
            $standardHours = 176;

            foreach ($employees as $employee) {
                $hoursWorked = $employee->hoursWorkedBetween($from, $to);
                $hourlyRate  = $employee->base_salary / $standardHours;

                $overtimeHours = max(0, $hoursWorked - $standardHours);
                $overtimePay   = $overtimeHours * $hourlyRate * ($employee->overtime_rate ?? 1.5);

                $baseSalary = $employee->base_salary;
                $netSalary  = $baseSalary + $overtimePay;

                PayrollItem::create([
                    'payroll_run_id' => $run->id,
                    'employee_id'    => $employee->id,
                    'hours_worked'   => $hoursWorked,
                    'base_salary'    => $baseSalary,
                    'overtime_pay'   => $overtimePay,
                    'bonuses'        => 0,
                    'deductions'     => 0,
                    'net_salary'     => $netSalary,
                ]);
            }

            return $run->load('items.employee');
        });
    }

    public function approve(PayrollRun $run, int $approvedBy): PayrollRun
    {
        abort_if($run->status !== 'draft', 422, 'Only draft payroll runs can be approved.');

        $run->update([
            'status'       => 'approved',
            'approved_by'  => $approvedBy,
            'processed_at' => now(),
        ]);

        return $run;
    }

    public function markPaid(PayrollRun $run): PayrollRun
    {
        abort_if($run->status !== 'approved', 422, 'Only approved payroll runs can be marked as paid.');

        $run->update(['status' => 'paid']);

        return $run;
    }
}
