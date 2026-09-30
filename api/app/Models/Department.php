<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'name', 'sort_order', 'kds_enabled'];

    protected $attributes = ['sort_order' => 0, 'kds_enabled' => false];

    protected $casts = ['kds_enabled' => 'boolean'];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function categories()
    {
        return $this->hasMany(MenuCategory::class);
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
