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

    /**
     * Atomically reserves one use of this coupon via a single conditional
     * UPDATE, returning false if doing so would exceed max_uses. Must be
     * called (and must succeed) before creating the Stripe checkout session
     * a coupon is applied to, not after it completes via webhook — checking
     * isValid() and incrementing used_count later left a gap where several
     * concurrent checkouts could all read the same stale used_count and all
     * get the coupon applied, oversold past max_uses.
     */
    public function tryReserve(): bool
    {
        if ($this->max_uses === null) {
            $this->increment('used_count');

            return true;
        }

        $affected = static::where('id', $this->id)
            ->whereColumn('used_count', '<', 'max_uses')
            ->increment('used_count');

        if ($affected > 0) {
            $this->used_count++;
        }

        return $affected > 0;
    }

    public function scopeUsableBy($query, ?int $tenantId)
    {
        return $query->where(fn($q) => $q->whereNull('tenant_id')->orWhere('tenant_id', $tenantId));
    }
}
