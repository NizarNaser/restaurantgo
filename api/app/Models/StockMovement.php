<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    use BelongsToTenant;

    public const TYPE_IN = 'in';
    public const TYPE_OUT = 'out';

    public const REASON_PURCHASE = 'purchase';
    public const REASON_SALE_DEDUCTION = 'sale_deduction';
    public const REASON_PRODUCTION_CONSUMPTION = 'production_consumption';
    public const REASON_PRODUCTION_OUTPUT = 'production_output';
    public const REASON_MANUAL_ADJUSTMENT = 'manual_adjustment';

    protected $fillable = [
        'tenant_id', 'stockable_type', 'stockable_id', 'type', 'reason',
        'quantity', 'unit_cost', 'total_cost',
        'reference_type', 'reference_id', 'occurred_at', 'notes', 'created_by',
    ];

    protected $casts = [
        'quantity'    => 'decimal:3',
        'unit_cost'   => 'decimal:4',
        'total_cost'  => 'decimal:3',
        'occurred_at' => 'datetime',
    ];

    public function stockable()
    {
        return $this->morphTo();
    }

    public function reference()
    {
        return $this->morphTo();
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
