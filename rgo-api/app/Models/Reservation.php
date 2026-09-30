<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Reservation extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'type',
        'customer_name', 'customer_email', 'customer_phone',
        'party_size', 'event_name', 'reserved_at', 'duration_minutes',
        'status', 'notes',
    ];

    protected $casts = [
        'reserved_at' => 'datetime',
        'party_size'  => 'integer',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
