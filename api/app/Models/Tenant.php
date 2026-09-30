<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'slug', 'subdomain', 'custom_domain',
        'plan_id', 'trial_ends_at', 'status',
        'timezone', 'default_currency', 'default_locale', 'supported_locales', 'tax_rate',
        'logo_path', 'favicon_path', 'cover_image_path',
        'seo_title', 'seo_description', 'seo_og_image', 'google_site_verification',
        'google_analytics_id', 'facebook_pixel_id',
        'social_facebook_url', 'social_instagram_url', 'social_twitter_url',
        'social_tiktok_url', 'social_youtube_url', 'social_snapchat_url',
        'settings',
        'stripe_connect_account_id', 'stripe_connect_charges_enabled', 'stripe_connect_details_submitted',
        'paypal_merchant_id', 'paypal_payments_receivable', 'paypal_email_confirmed',
    ];

    protected $casts = [
        'trial_ends_at'                     => 'datetime',
        'settings'                          => 'array',
        'supported_locales'                 => 'array',
        'seo_title'                         => 'array',
        'seo_description'                  => 'array',
        'stripe_connect_charges_enabled'    => 'boolean',
        'stripe_connect_details_submitted'  => 'boolean',
        'paypal_payments_receivable'        => 'boolean',
        'paypal_email_confirmed'            => 'boolean',
        'tax_rate'                          => 'decimal:2',
    ];

    // ── Relations ──────────────────────────────────────────────
    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function subscription()
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function branches()
    {
        return $this->hasMany(Branch::class);
    }

    public function menuCategories()
    {
        return $this->hasMany(MenuCategory::class);
    }

    public function menuItems()
    {
        return $this->hasMany(MenuItem::class);
    }

    public function articles()
    {
        return $this->hasMany(Article::class);
    }

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    public function revenues()
    {
        return $this->hasMany(Revenue::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    // ── Helpers ────────────────────────────────────────────────
    public function onTrial(): bool
    {
        return $this->trial_ends_at && $this->trial_ends_at->isFuture();
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function getPublicUrl(): string
    {
        if ($this->custom_domain) {
            return 'https://' . $this->custom_domain;
        }
        return 'https://' . $this->subdomain . '.' . config('app.base_domain');
    }

    public function canUse(string $feature): bool
    {
        return $this->plan?->features[$feature] ?? false;
    }

    /**
     * Whether this tenant's Stripe Connect account can actually receive
     * charges yet — the gate order-payment code checks before letting a
     * customer pay for delivery/takeout.
     */
    public function hasActiveConnectAccount(): bool
    {
        return $this->stripe_connect_charges_enabled;
    }

    /** The PayPal equivalent of hasActiveConnectAccount(). */
    public function hasActivePaypalAccount(): bool
    {
        return $this->paypal_payments_receivable;
    }

    /**
     * There's no dedicated column for it, so the Stripe customer id — which
     * must exist before a subscription does — lives in the settings blob.
     */
    public function stripeCustomerId(): ?string
    {
        return $this->settings['stripe_customer_id'] ?? null;
    }

    public function setStripeCustomerId(string $customerId): void
    {
        $this->update(['settings' => array_merge($this->settings ?? [], ['stripe_customer_id' => $customerId])]);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
