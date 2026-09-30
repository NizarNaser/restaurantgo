<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AttendanceRecord extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'employee_id', 'branch_id',
        'check_in', 'check_out',
        'type', // manual | biometric | api
        'notes', 'created_by',
    ];

    protected $casts = [
        'check_in'  => 'datetime',
        'check_out' => 'datetime',
    ];

    public function employee()  { return $this->belongsTo(Employee::class); }
    public function branch()    { return $this->belongsTo(Branch::class); }
    public function creator()   { return $this->belongsTo(User::class, 'created_by'); }

    public function hoursWorked(): float
    {
        if (! $this->check_out) return 0;
        return round($this->check_in->diffInMinutes($this->check_out) / 60, 2);
    }
}
