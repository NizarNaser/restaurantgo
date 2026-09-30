<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Article extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'branch_id', 'author_id',
        'status', 'publish_at',
        'seo_title', 'seo_description', 'seo_og_image',
    ];

    protected $casts = [
        'publish_at'      => 'datetime',
        'seo_title'       => 'array',
        'seo_description' => 'array',
    ];

    const STATUS_DRAFT     = 'draft';
    const STATUS_PUBLISHED = 'published';
    const STATUS_SCHEDULED = 'scheduled';

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('featured_image')->singleFile();
    }

    public function tenant()  { return $this->belongsTo(Tenant::class); }
    public function branch()  { return $this->belongsTo(Branch::class); }
    public function author()  { return $this->belongsTo(User::class, 'author_id'); }
    public function translations() { return $this->hasMany(ArticleTranslation::class); }

    public function translation(?string $locale = null)
    {
        $locale = $locale ?? app()->getLocale();
        return $this->translations->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', 'en')
            ?? $this->translations->first();
    }

    public function scopePublished($query)
    {
        return $query->where('status', self::STATUS_PUBLISHED)
                     ->where(fn($q) => $q->whereNull('publish_at')->orWhere('publish_at', '<=', now()));
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    /** The locales this article has been translated into. */
    public function availableLocales(): array
    {
        return $this->translations->pluck('locale')->all();
    }
}
