<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    use BelongsToTenant;

    public const STATUS_OPEN = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'tenant_id', 'branch_id', 'opened_by_user_id', 'opened_at',
        'closed_by_user_id', 'closed_at', 'status', 'opening_notes', 'closing_notes',
    ];

    protected $casts = [
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function openedBy()
    {
        return $this->belongsTo(User::class, 'opened_by_user_id');
    }

    public function closedBy()
    {
        return $this->belongsTo(User::class, 'closed_by_user_id');
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }

    public function scopeOpenShift($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }
}
