<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'name', 'national_id',
        'phone', 'email', 'position', 'base_salary', 'currency',
        'hire_date', 'status', 'bank_account',
        'overtime_rate', 'notes',
    ];

    protected $hidden  = ['bank_account'];
    protected $casts   = [
        'hire_date'    => 'date',
        'base_salary'  => 'decimal:2',
        'overtime_rate'=> 'decimal:2',
    ];

    public function tenant()     { return $this->belongsTo(Tenant::class); }
    public function branch()     { return $this->belongsTo(Branch::class); }
    public function attendance() { return $this->hasMany(AttendanceRecord::class); }
    public function payrolls()   { return $this->hasMany(PayrollItem::class); }

    // محاسبة ساعات الشهر
    public function hoursWorkedBetween(string $from, string $to): float
    {
        return $this->attendance()
            ->whereBetween('check_in', [$from, $to])
            ->whereNotNull('check_out')
            ->get()
            ->sum(fn($r) => $r->hoursWorked());
    }

    public function scopeActive($q) { return $q->where('status', 'active'); }
}
