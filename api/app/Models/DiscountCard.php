<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class DiscountCard extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'card_number', 'customer_name', 'customer_birth_date',
        'customer_phone', 'customer_email', 'discount_percentage',
        'accumulated_balance', 'is_active', 'registered_by_user_id',
    ];

    protected $casts = [
        'customer_birth_date' => 'date',
        'discount_percentage' => 'decimal:2',
        'accumulated_balance' => 'decimal:3',
        'is_active'           => 'boolean',
    ];

    public function applications()
    {
        return $this->hasMany(DiscountApplication::class);
    }

    public function registeredBy()
    {
        return $this->belongsTo(User::class, 'registered_by_user_id');
    }

    public function accumulate(float $amount): void
    {
        $this->increment('accumulated_balance', $amount);
    }

    public function redeem(float $amount): void
    {
        $this->decrement('accumulated_balance', $amount);
    }
}
