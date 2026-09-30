<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PayrollRun extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id',
        'period_start', 'period_end', 'currency',
        'status', // draft | approved | paid
        'processed_at', 'created_by', 'approved_by',
        'notes',
    ];

    protected $casts = [
        'period_start'  => 'date',
        'period_end'    => 'date',
        'processed_at'  => 'datetime',
    ];

    public function tenant()  { return $this->belongsTo(Tenant::class); }
    public function branch()  { return $this->belongsTo(Branch::class); }
    public function items()   { return $this->hasMany(PayrollItem::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(){ return $this->belongsTo(User::class, 'approved_by'); }

    public function totalNetSalary(): float
    {
        return $this->items()->sum('net_salary');
    }
}
