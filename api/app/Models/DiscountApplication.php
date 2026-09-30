<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class DiscountApplication extends Model
{
    use BelongsToTenant;

    public const MODE_DEDUCT = 'deduct';
    public const MODE_ACCUMULATE = 'accumulate';
    public const MODE_REDEEM = 'redeem';

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'tenant_id', 'order_id', 'discount_card_id', 'requested_by_user_id',
        'mode', 'discount_percentage', 'amount', 'status',
        'approved_by_user_id', 'approved_at',
    ];

    protected $casts = [
        'discount_percentage' => 'decimal:2',
        'amount'              => 'decimal:2',
        'approved_at'         => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function discountCard()
    {
        return $this->belongsTo(DiscountCard::class);
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by_user_id');
    }
}
