<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffPayrollItem extends Model
{
    protected $fillable = [
        'staff_payroll_run_id', 'staff_id',
        'hours_worked', 'base_salary', 'overtime_pay',
        'bonuses', 'deductions', 'net_salary', 'notes',
    ];

    protected $casts = [
        'hours_worked' => 'decimal:2',
        'base_salary'  => 'decimal:3',
        'overtime_pay' => 'decimal:3',
        'bonuses'      => 'decimal:3',
        'deductions'   => 'decimal:3',
        'net_salary'   => 'decimal:3',
    ];

    public function payrollRun() { return $this->belongsTo(StaffPayrollRun::class, 'staff_payroll_run_id'); }
    public function staff()      { return $this->belongsTo(Staff::class); }
}
