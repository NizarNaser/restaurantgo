<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A prepared/manufactured warehouse item made from several raw ingredients
 * (e.g. a house sauce) — carries its own on-hand stock, replenished in
 * discrete production batches (see ProductionRecord), rather than being
 * exploded into raw ingredients every time a menu item that uses it sells.
 */
class SemiFinishedGood extends Model
{
    use BelongsToTenant, SoftDeletes;

    public const UNIT_GRAM = 'gram';
    public const UNIT_PIECE = 'piece';

    protected $fillable = [
        'tenant_id', 'name', 'unit', 'current_stock', 'is_active',
    ];

    protected $casts = [
        'current_stock' => 'decimal:3',
        'is_active'     => 'boolean',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function stockMovements()
    {
        return $this->morphMany(StockMovement::class, 'stockable');
    }

    /** This good's own production recipe (which raw ingredients make a batch of it). */
    public function ownRecipeLines()
    {
        return $this->morphMany(RecipeLine::class, 'recipeable');
    }

    /** Where this good is used as a component inside a menu item's recipe. */
    public function usedInLines()
    {
        return $this->morphMany(RecipeLine::class, 'componentable');
    }

    public function productionRecords()
    {
        return $this->hasMany(ProductionRecord::class);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
