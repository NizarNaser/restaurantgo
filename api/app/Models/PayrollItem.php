<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollItem extends Model
{
    protected $fillable = [
        'payroll_run_id', 'employee_id',
        'hours_worked', 'base_salary', 'overtime_pay',
        'bonuses', 'deductions', 'net_salary', 'notes',
    ];

    protected $casts = [
        'hours_worked'  => 'decimal:2',
        'base_salary'   => 'decimal:3',
        'overtime_pay'  => 'decimal:3',
        'bonuses'       => 'decimal:3',
        'deductions'    => 'decimal:3',
        'net_salary'    => 'decimal:3',
    ];

    public function payrollRun() { return $this->belongsTo(PayrollRun::class); }
    public function employee()   { return $this->belongsTo(Employee::class); }
}
