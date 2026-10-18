<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use BelongsToTenant;

    public const TYPE_DINE_IN = 'dine_in';
    public const TYPE_DELIVERY = 'delivery';
    public const TYPE_PICKUP = 'pickup';

    public const PAYMENT_STATUS_PENDING = 'pending';
    public const PAYMENT_STATUS_PAID = 'paid';

    // How the order is paid. `online` = Stripe checkout (payment_status
    // starts `pending` until the webhook confirms it). `cash` / `card` =
    // collected by staff, so the order is a real kitchen order straight away
    // (payment_status null, like an open table) and becomes `paid` when it's
    // handed over / the table is closed.
    public const PAYMENT_METHOD_ONLINE = 'online';
    public const PAYMENT_METHOD_CASH = 'cash';
    public const PAYMENT_METHOD_CARD = 'card';

    protected $fillable = [
        'tenant_id', 'branch_id', 'qr_code_id', 'table_number',
        'table_id', 'opened_by_user_id',
        'type', 'source', 'customer_name', 'customer_phone',
        'status', 'notes', 'subtotal', 'total', 'currency', 'tracking_code',
        'payment_status', 'payment_method', 'stripe_checkout_session_id', 'stripe_payment_intent_id',
        'platform_fee_amount', 'paid_at', 'stock_deducted_at', 'shift_id',
        'discount_card_id', 'discount_amount',
        'delivery_address_line', 'delivery_city', 'delivery_instructions',
    ];

    protected $casts = [
        'subtotal'            => 'decimal:3',
        'total'               => 'decimal:3',
        'platform_fee_amount' => 'decimal:3',
        'discount_amount'     => 'decimal:3',
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
        $array['items'] = OrderItem::groupForDisplay($order->items, $order->currency)->all();

        return $array;
    }

    public function requiresOnlinePayment(): bool
    {
        return $this->payment_method === self::PAYMENT_METHOD_ONLINE;
    }

    /** Paid in cash at hand-over (delivery/pickup) and not collected yet. */
    public function awaitsCashOnHandover(): bool
    {
        return $this->payment_method === self::PAYMENT_METHOD_CASH
            && in_array($this->type, [self::TYPE_DELIVERY, self::TYPE_PICKUP], true)
            && ! $this->isPaid();
    }

    /**
     * Income of an (already filtered) order query split by how it was paid
     * — what the cash drawer should hold vs. card/online. `unrecorded` is
     * sales from before payment methods were tracked (or closed by an older
     * POS build that doesn't send one).
     */
    public static function totalsByPaymentMethod(Builder $orders): array
    {
        $totals = ['cash' => 0.0, 'card' => 0.0, 'online' => 0.0, 'unrecorded' => 0.0];

        (clone $orders)
            ->selectRaw('payment_method, COALESCE(SUM(total), 0) as income')
            ->groupBy('payment_method')
            ->toBase()
            ->get()
            ->each(function ($row) use (&$totals) {
                $key = $row->payment_method && isset($totals[$row->payment_method]) ? $row->payment_method : 'unrecorded';
                $totals[$key] += (float) $row->income;
            });

        return $totals;
    }

    public function isPaid(): bool
    {
        return $this->payment_status === self::PAYMENT_STATUS_PAID;
    }
}
