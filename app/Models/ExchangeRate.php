<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'base_currency', 'target_currency', 'rate', 'date', 'source',
    ];

    protected $casts = [
        'rate' => 'decimal:8',
        'date' => 'date',
    ];
}
