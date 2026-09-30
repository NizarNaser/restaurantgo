<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Revenue extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'amount', 'currency',
        'description', 'date', 'reference_number', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'date'   => 'date',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }
}
