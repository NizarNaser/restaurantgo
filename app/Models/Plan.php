<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'name', 'slug', 'description',
        'price_monthly', 'price_yearly', 'currency',
        'max_branches', 'max_menu_items', 'max_users',
        'has_custom_domain', 'has_white_label', 'has_advanced_reports',
        'has_api_access', 'has_qr_ordering',
        'stripe_price_id_monthly', 'stripe_price_id_yearly',
        'paddle_price_id_monthly', 'paddle_price_id_yearly',
        'is_active', 'sort_order', 'features',
    ];

    protected $casts = [
        'price_monthly'       => 'decimal:2',
        'price_yearly'        => 'decimal:2',
        'has_custom_domain'   => 'boolean',
        'has_white_label'     => 'boolean',
        'has_advanced_reports'=> 'boolean',
        'has_api_access'      => 'boolean',
        'has_qr_ordering'     => 'boolean',
        'is_active'           => 'boolean',
        'features'            => 'array',
    ];

    public function tenants()
    {
        return $this->hasMany(Tenant::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }
}
