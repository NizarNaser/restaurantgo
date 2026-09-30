<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ProductionRecord extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'semi_finished_good_id', 'quantity_produced',
        'produced_at', 'produced_by_user_id', 'notes',
    ];

    protected $casts = [
        'quantity_produced' => 'decimal:3',
        'produced_at'       => 'datetime',
    ];

    public function semiFinishedGood()
    {
        return $this->belongsTo(SemiFinishedGood::class);
    }

    public function producedBy()
    {
        return $this->belongsTo(User::class, 'produced_by_user_id');
    }
}
