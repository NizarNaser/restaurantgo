<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    use HasFactory, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'plan_id',
        'stripe_subscription_id', 'stripe_customer_id', 'paddle_subscription_id',
        'status', 'billing_interval',
        'current_period_start', 'current_period_end',
        'trial_ends_at', 'canceled_at',
    ];

    protected $casts = [
        'current_period_start' => 'datetime',
        'current_period_end'   => 'datetime',
        'trial_ends_at'        => 'datetime',
        'canceled_at'          => 'datetime',
    ];

    const STATUS_ACTIVE   = 'active';
    const STATUS_TRIALING = 'trialing';
    const STATUS_PAST_DUE = 'past_due';
    const STATUS_CANCELED = 'canceled';
    const STATUS_PAUSED   = 'paused';

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    /** True once Stripe has scheduled the subscription to end at period close. */
    public function isEnding(): bool
    {
        return $this->canceled_at !== null && $this->status !== self::STATUS_CANCELED;
    }
}
