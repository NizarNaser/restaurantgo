<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Staff extends Model
{
    protected $fillable = [
        'user_id', 'name', 'email', 'phone', 'position', 'department',
        'base_salary', 'currency', 'overtime_rate', 'hire_date',
        'status', 'bank_account', 'notes',
    ];

    protected $hidden = ['bank_account'];

    protected $casts = [
        'hire_date'     => 'date',
        'base_salary'   => 'decimal:3',
        'overtime_rate' => 'decimal:2',
    ];

    public function user()        { return $this->belongsTo(User::class); }
    public function attendance()  { return $this->hasMany(StaffAttendanceRecord::class); }
    public function payrollItems(){ return $this->hasMany(StaffPayrollItem::class); }

    public function hoursWorkedBetween(string $from, string $to): float
    {
        return $this->attendance()
            ->whereBetween('check_in', [$from, $to])
            ->whereNotNull('check_out')
            ->get()
            ->sum(fn ($r) => $r->hoursWorked());
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
