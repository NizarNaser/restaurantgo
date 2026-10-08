<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'amount', 'currency',
        'description', 'date', 'vendor', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:3',
        'date'   => 'date',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
