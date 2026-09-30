<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * One line of a recipe/BOM: "recipeable" is the thing being made (a MenuItem
 * or, for a SemiFinishedGood's own production BOM, that same
 * SemiFinishedGood); "componentable" is the thing consumed (an Ingredient or
 * a SemiFinishedGood). Quantities are always expressed in the componentable's
 * own unit.
 */
class RecipeLine extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'recipeable_type', 'recipeable_id',
        'componentable_type', 'componentable_id',
        'gross_quantity', 'net_quantity', 'sort_order', 'notes',
    ];

    protected $casts = [
        'gross_quantity' => 'decimal:3',
        'net_quantity'   => 'decimal:3',
        'sort_order'     => 'integer',
    ];

    public function recipeable()
    {
        return $this->morphTo();
    }

    public function componentable()
    {
        return $this->morphTo();
    }
}
