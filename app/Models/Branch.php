<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    use BelongsToTenant;

    protected $table = 'branches';

    protected $fillable = [
        'tenant_id', 'name', 'address', 'city', 'country', 'phone',
        'latitude', 'longitude', 'google_place_id', 'google_maps_embed_url',
        'working_hours', 'is_active',
    ];

    protected $casts = [
        'working_hours' => 'array',
        'is_active'     => 'boolean',
        'latitude'      => 'decimal:7',
        'longitude'     => 'decimal:7',
    ];

    public function tenant()          { return $this->belongsTo(Tenant::class); }
    public function menuCategories()  { return $this->hasMany(MenuCategory::class); }
    public function employees()       { return $this->hasMany(Employee::class); }
    public function articles()        { return $this->hasMany(Article::class); }
    public function halls()           { return $this->hasMany(Hall::class); }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
