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

    public function translations()
    {
        return $this->hasMany(DepartmentTranslation::class);
    }

    /**
     * The plain `name` column predates per-locale support and stays as the
     * ultimate fallback — any department created before this feature, or
     * reached through a code path that never loaded `translations`, still
     * resolves to something sensible instead of null.
     */
    public function translation(?string $locale = null)
    {
        $locale = $locale ?? app()->getLocale();
        return $this->translations->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', 'en')
            ?? $this->translations->first();
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
