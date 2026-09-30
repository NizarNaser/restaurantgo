<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class MenuCategory extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'parent_id', 'department_id',
        'sort_order', 'is_active', 'image_path',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function tenant()      { return $this->belongsTo(Tenant::class); }
    public function branch()      { return $this->belongsTo(Branch::class); }
    public function department()  { return $this->belongsTo(Department::class); }
    public function parent()      { return $this->belongsTo(MenuCategory::class, 'parent_id'); }
    public function children()    { return $this->hasMany(MenuCategory::class, 'parent_id'); }
    public function translations(){ return $this->hasMany(MenuCategoryTranslation::class); }
    public function items()       { return $this->hasMany(MenuItem::class); }

    public function translation(?string $locale = null)
    {
        $locale = $locale ?? app()->getLocale();
        return $this->translations->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', 'en')
            ?? $this->translations->first();
    }
}
