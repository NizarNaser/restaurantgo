<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Ingredient extends Model
{
    use BelongsToTenant, SoftDeletes;

    public const UNIT_GRAM = 'gram';
    public const UNIT_PIECE = 'piece';

    protected $fillable = [
        'tenant_id', 'name', 'unit', 'unit_price', 'current_stock', 'is_active',
    ];

    protected $casts = [
        'unit_price'    => 'decimal:4',
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

    public function usedInLines()
    {
        return $this->morphMany(RecipeLine::class, 'componentable');
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
