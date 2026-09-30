<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A singleton row (always id 1) holding the platform's own marketing-site
 * SEO — the `web` app's own title/description/OG image/Google verification,
 * as opposed to any one tenant's restaurant SEO (see Tenant's seo_* columns).
 */
class PlatformSetting extends Model
{
    protected $fillable = [
        'seo_title', 'seo_description', 'seo_og_image', 'google_site_verification',
    ];

    protected $casts = [
        'seo_title'       => 'array',
        'seo_description' => 'array',
    ];

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }
}
