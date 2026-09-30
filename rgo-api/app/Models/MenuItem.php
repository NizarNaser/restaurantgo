<?php

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class MenuItem extends Model implements HasMedia
{
    use HasFactory, SoftDeletes, InteractsWithMedia, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'menu_category_id', 'sku',
        'base_price', 'calories', 'weight', 'prep_time_minutes',
        'is_available', 'is_featured', 'sort_order', 'video_url',
        'tags', 'seo_title', 'seo_description', 'seo_og_image',
    ];

    protected $casts = [
        'base_price'      => 'decimal:2',
        'is_available'    => 'boolean',
        'is_featured'     => 'boolean',
        'tags'            => 'array',
        'seo_title'       => 'array',
        'seo_description' => 'array',
    ];

    // ── Media Collections ──────────────────────────────────────
    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('images')
             ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp']);

        $this->addMediaCollection('video')
             ->acceptsMimeTypes(['video/mp4', 'video/webm'])
             ->singleFile();
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
             ->width(300)->height(300)
             ->format('webp')->quality(80)
             ->nonQueued();

        $this->addMediaConversion('card')
             ->width(600)->height(400)
             ->format('webp')->quality(80)
             ->nonQueued();
    }

    // ── Relations ──────────────────────────────────────────────
    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category()
    {
        return $this->belongsTo(MenuCategory::class, 'menu_category_id');
    }

    public function translations()
    {
        return $this->hasMany(MenuItemTranslation::class);
    }

    public function prices()
    {
        return $this->hasMany(MenuItemPrice::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function approvedReviews()
    {
        return $this->hasMany(Review::class)->approved();
    }

    /** This item's recipe/BOM card — the ingredients/semi-finished goods used to prepare it. */
    public function recipeLines()
    {
        return $this->morphMany(RecipeLine::class, 'recipeable');
    }

    // ── Helpers ────────────────────────────────────────────────
    public function translation(?string $locale = null)
    {
        $locale = $locale ?? app()->getLocale();
        return $this->translations->firstWhere('locale', $locale)
            ?? $this->translations->firstWhere('locale', 'en')
            ?? $this->translations->first();
    }

    /**
     * Falls back to the original if the named conversion hasn't been
     * generated yet (e.g. media uploaded before conversions existed, until
     * a regenerate job backfills it) — never returns a URL that 404s.
     */
    public function imageUrl(?string $conversion = null): ?string
    {
        $media = $this->getFirstMedia('images');
        if (! $media) {
            return null;
        }

        return ($conversion && $media->hasGeneratedConversion($conversion))
            ? $media->getUrl($conversion)
            : $media->getUrl();
    }

    public function priceIn(string $currency): ?float
    {
        return $this->prices->firstWhere('currency', $currency)?->price
            ?? $this->base_price;
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_available', true);
    }
}
