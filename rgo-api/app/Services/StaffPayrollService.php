<?php

namespace App\Services;

use App\Models\Staff;
use App\Models\StaffPayrollItem;
use App\Models\StaffPayrollRun;
use Illuminate\Support\Facades\DB;

/**
 * Payroll for the platform's own internal staff — mirrors PayrollService,
 * minus tenant/branch scoping since staff aren't tied to any tenant.
 */
class StaffPayrollService
{
    public function generate(string $from, string $to, int $createdBy): StaffPayrollRun
    {
        abort_if(
            StaffPayrollRun::where('period_start', $from)
                ->where('period_end', $to)
                ->where('status', '!=', 'paid')
                ->exists(),
            422,
            'A staff payroll run already exists for this period.',
        );

        return DB::transaction(function () use ($from, $to, $createdBy) {
            $run = StaffPayrollRun::create([
                'period_start' => $from,
                'period_end'   => $to,
                'currency'     => 'USD',
                'status'       => 'draft',
                'created_by'   => $createdBy,
            ]);

            $staffMembers = Staff::active()->get();

            // Standard hours a full-time staff member is assumed to work over the
            // period: 8h/day, 22 working days — anything beyond that is overtime.
            $standardHours = 176;

            foreach ($staffMembers as $staff) {
                $hoursWorked = $staff->hoursWorkedBetween($from, $to);
                $hourlyRate  = $staff->base_salary / $standardHours;

                $overtimeHours = max(0, $hoursWorked - $standardHours);
                $overtimePay   = $overtimeHours * $hourlyRate * ($staff->overtime_rate ?? 1.5);

                $baseSalary = $staff->base_salary;
                $netSalary  = $baseSalary + $overtimePay;

                StaffPayrollItem::create([
                    'staff_payroll_run_id' => $run->id,
                    'staff_id'             => $staff->id,
                    'hours_worked'         => $hoursWorked,
                    'base_salary'          => $baseSalary,
                    'overtime_pay'         => $overtimePay,
                    'bonuses'              => 0,
                    'deductions'           => 0,
                    'net_salary'           => $netSalary,
                ]);
            }

            return $run->load('items.staff');
        });
    }

    public function approve(StaffPayrollRun $run, int $approvedBy): StaffPayrollRun
    {
        abort_if($run->status !== 'draft', 422, 'Only draft payroll runs can be approved.');

        $run->update([
            'status'       => 'approved',
            'approved_by'  => $approvedBy,
            'processed_at' => now(),
        ]);

        return $run;
    }

    public function markPaid(StaffPayrollRun $run): StaffPayrollRun
    {
        abort_if($run->status !== 'approved', 422, 'Only approved payroll runs can be marked as paid.');

        $run->update(['status' => 'paid']);

        return $run;
    }
}
