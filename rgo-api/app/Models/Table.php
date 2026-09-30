<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    use BelongsToTenant;

    protected $table = 'tables';

    public const STATUS_VACANT = 'vacant';
    public const STATUS_OCCUPIED = 'occupied';

    protected $fillable = [
        'tenant_id', 'hall_id', 'table_number', 'capacity', 'shape',
        'pos_x', 'pos_y', 'width', 'height',
        'status', 'opened_by_user_id', 'opened_at',
    ];

    protected $casts = [
        'capacity'  => 'integer',
        'pos_x'     => 'integer',
        'pos_y'     => 'integer',
        'width'     => 'integer',
        'height'    => 'integer',
        'opened_at' => 'datetime',
    ];

    // Mirrors the migration's DB-level defaults — without these, a freshly
    // created model instance reads these as null in the same request until
    // it's re-fetched, since Eloquent doesn't read back DB column defaults.
    protected $attributes = [
        'shape'  => 'square',
        'pos_x'  => 0,
        'pos_y'  => 0,
        'width'  => 80,
        'height' => 80,
        'status' => self::STATUS_VACANT,
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function hall()
    {
        return $this->belongsTo(Hall::class);
    }

    public function openedBy()
    {
        return $this->belongsTo(User::class, 'opened_by_user_id');
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function isVacant(): bool
    {
        return $this->status === self::STATUS_VACANT;
    }

    public function isOccupied(): bool
    {
        return $this->status === self::STATUS_OCCUPIED;
    }

    /**
     * A vacant table can be opened by anyone with table-management rights; an
     * occupied one is locked to whoever opened it, with owner/manager able to
     * override the lock (per spec: "only he and the admin can deal with this
     * table").
     */
    public function canBeManagedBy(User $user): bool
    {
        return $this->isVacant()
            || (int) $this->opened_by_user_id === (int) $user->id
            || $user->hasRole(['owner', 'manager']);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
