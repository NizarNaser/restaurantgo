<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StaffAttendanceRecord extends Model
{
    protected $fillable = [
        'staff_id', 'check_in', 'check_out', 'type', 'notes', 'created_by',
    ];

    protected $casts = [
        'check_in'  => 'datetime',
        'check_out' => 'datetime',
    ];

    public function staff()   { return $this->belongsTo(Staff::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }

    public function hoursWorked(): float
    {
        if (! $this->check_out) return 0;
        return round($this->check_in->diffInMinutes($this->check_out) / 60, 2);
    }
}
