<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use BelongsToTenant;

    public const TYPE_DINE_IN = 'dine_in';
    public const TYPE_DELIVERY = 'delivery';

    public const PAYMENT_STATUS_PENDING = 'pending';
    public const PAYMENT_STATUS_PAID = 'paid';

    protected $fillable = [
        'tenant_id', 'branch_id', 'qr_code_id', 'table_number',
        'table_id', 'opened_by_user_id',
        'type', 'source', 'customer_name', 'customer_phone',
        'status', 'notes', 'subtotal', 'total', 'currency', 'tracking_code',
        'payment_status', 'stripe_checkout_session_id', 'stripe_payment_intent_id',
        'platform_fee_amount', 'paid_at', 'stock_deducted_at', 'shift_id',
        'discount_card_id', 'discount_amount',
        'delivery_address_line', 'delivery_city', 'delivery_instructions',
    ];

    protected $casts = [
        'subtotal'            => 'decimal:2',
        'total'               => 'decimal:2',
        'platform_fee_amount' => 'decimal:2',
        'discount_amount'     => 'decimal:2',
        'paid_at'             => 'datetime',
        'stock_deducted_at'   => 'datetime',
    ];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function qrCode() { return $this->belongsTo(QrCode::class); }
    public function items()  { return $this->hasMany(OrderItem::class); }
    public function table()  { return $this->belongsTo(Table::class); }
    public function openedBy() { return $this->belongsTo(User::class, 'opened_by_user_id'); }
    public function shift()  { return $this->belongsTo(Shift::class); }
    public function discountCard() { return $this->belongsTo(DiscountCard::class); }
    public function discountApplications() { return $this->hasMany(DiscountApplication::class); }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeAwaitingPayment($query)
    {
        return $query->where('payment_status', self::PAYMENT_STATUS_PENDING);
    }

    /**
     * The order's array form with its `items` swapped for the guest-facing
     * consolidated lines (see OrderItem::groupForDisplay()) instead of the
     * raw one-row-per-addItems()-round records. Use this wherever an order
     * is returned to the dashboard/customer for display — the raw `items`
     * relation stays available for anything that needs real per-row
     * granularity (the KDS, stock deduction, sales reports).
     */
    public static function withDisplayItems(self $order): array
    {
        $array = $order->toArray();
        $array['items'] = OrderItem::groupForDisplay($order->items)->all();

        return $array;
    }

    public function requiresOnlinePayment(): bool
    {
        return $this->type === self::TYPE_DELIVERY;
    }

    public function isPaid(): bool
    {
        return $this->payment_status === self::PAYMENT_STATUS_PAID;
    }
}
