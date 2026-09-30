<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;

/**
 * The platform's own marketing site (the `web` app) — not scoped to any
 * tenant. Returns raw defaults; each page builds its own full SeoPayload
 * (title/canonical/OG/Twitter) client-side, falling back to these when it
 * has nothing more specific of its own.
 */
class PlatformController extends Controller
{
    public function seo(): JsonResponse
    {
        $settings = PlatformSetting::current();

        return response()->json([
            'seo_title'                => $settings->seo_title,
            'seo_description'          => $settings->seo_description,
            'seo_og_image'             => $settings->seo_og_image,
            'google_site_verification' => $settings->google_site_verification,
        ]);
    }
}
