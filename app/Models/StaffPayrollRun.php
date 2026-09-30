<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffPayrollRun extends Model
{
    protected $fillable = [
        'period_start', 'period_end', 'currency',
        'status', // draft | approved | paid
        'processed_at', 'created_by', 'approved_by', 'notes',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end'   => 'date',
        'processed_at' => 'datetime',
    ];

    public function items()    { return $this->hasMany(StaffPayrollItem::class); }
    public function creator()  { return $this->belongsTo(User::class, 'created_by'); }
    public function approver() { return $this->belongsTo(User::class, 'approved_by'); }

    public function totalNetSalary(): float
    {
        return $this->items()->sum('net_salary');
    }
}
