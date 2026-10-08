<?php

namespace App\Models;

use App\Services\Currency;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class OrderItem extends Model
{
    public const KITCHEN_STATUS_PENDING = 'pending';
    public const KITCHEN_STATUS_PREPARING = 'preparing';
    public const KITCHEN_STATUS_READY = 'ready';

    protected $fillable = [
        'order_id', 'menu_item_id', 'name', 'weight', 'unit_price', 'quantity', 'subtotal', 'notes',
        'kitchen_status', 'started_at', 'ready_at', 'collected_at', 'batch_id',
    ];

    protected $casts = [
        'unit_price'   => 'decimal:3',
        'subtotal'     => 'decimal:3',
        'quantity'     => 'integer',
        'started_at'   => 'datetime',
        'ready_at'     => 'datetime',
        'collected_at' => 'datetime',
    ];

    public function order()    { return $this->belongsTo(Order::class); }
    public function menuItem() { return $this->belongsTo(MenuItem::class); }

    /**
     * Consolidates an order's raw rows — one per addItems() round, kept
     * separate so the kitchen/KDS can track each round independently — into
     * one guest-facing line per distinct (menu item, notes) combination,
     * with quantities/subtotals summed. Purely a display transform: nothing
     * is written back, and the underlying rows (and their individual
     * kitchen_status/timestamps) are untouched.
     */
    public static function groupForDisplay(Collection $items, string $currency = 'USD'): Collection
    {
        $decimals = Currency::decimals($currency);

        return $items
            ->groupBy(fn (self $item) => $item->menu_item_id.'|'.($item->notes ?? ''))
            ->map(function (Collection $group) use ($decimals) {
                /** @var self $first */
                $first = $group->sortBy('created_at')->first();
                $quantity = (int) $group->sum('quantity');
                $subtotal = (float) $group->sum('subtotal');
                // Formatted as a fixed-decimal string, matching the
                // model's own `decimal` cast JSON shape — every other
                // place these fields are read (frontend included) expects
                // a string like "37.50" (or "37.500" for a 3-decimal
                // currency), not a bare float.
                $unitPrice = $quantity > 0 ? $subtotal / $quantity : (float) $first->unit_price;

                return [
                    'id'           => $first->id,
                    'menu_item_id' => $first->menu_item_id,
                    'name'         => $first->name,
                    'weight'       => $first->weight,
                    'unit_price'   => number_format($unitPrice, $decimals, '.', ''),
                    'quantity'     => $quantity,
                    'subtotal'     => number_format($subtotal, $decimals, '.', ''),
                    'notes'        => $first->notes,
                    'created_at'   => $first->created_at,
                ];
            })
            ->values();
    }
}
