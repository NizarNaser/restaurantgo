<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'type', 'value', 'currency',
        'max_uses', 'used_count', 'expires_at', 'is_active',
    ];

    protected $casts = [
        'value'      => 'decimal:2',
        'expires_at' => 'datetime',
        'is_active'  => 'boolean',
    ];

    const TYPE_PERCENT = 'percent';
    const TYPE_FIXED   = 'fixed';

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isValid(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        if ($this->max_uses !== null && $this->used_count >= $this->max_uses) {
            return false;
        }

        return true;
    }

    public function scopeUsableBy($query, ?int $tenantId)
    {
        return $query->where(fn($q) => $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId));
    }
}
