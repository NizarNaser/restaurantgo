<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A singleton row (always id 1) holding the platform's own marketing-site
 * settings — the `web` app's own title/description/OG image/Google
 * verification, as opposed to any one tenant's restaurant SEO (see Tenant's
 * seo_* columns), plus the announcement bar above its nav.
 */
class PlatformSetting extends Model
{
    protected $fillable = [
        'seo_title', 'seo_description', 'seo_og_image', 'google_site_verification',
        'announcement_enabled', 'announcement_message',
    ];

    // Mirrors the column default, so a freshly created row reports the bar
    // as shown without a reload.
    protected $attributes = [
        'announcement_enabled' => true,
    ];

    protected $casts = [
        'seo_title'       => 'array',
        'seo_description' => 'array',
        'announcement_enabled' => 'boolean',
        'announcement_message' => 'array',
    ];

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }
}
