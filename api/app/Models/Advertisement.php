<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Advertisement extends Model
{
    protected $fillable = [
        'title', 'advertiser_name', 'image_path', 'link_url', 'placement',
        'starts_at', 'ends_at', 'is_active', 'sort_order',
        'impression_count', 'click_count',
    ];

    protected $casts = [
        'starts_at' => 'date',
        'ends_at'   => 'date',
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        $today = now()->toDateString();

        return $query->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $today))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $today));
    }

    public function scopePlacement($query, string $placement)
    {
        return $query->where('placement', $placement);
    }
}
