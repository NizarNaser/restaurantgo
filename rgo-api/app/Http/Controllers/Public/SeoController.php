<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Services\SeoService;
use Illuminate\Http\Response;

class SeoController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly SeoService $seo) {}

    /**
     * Per-tenant sitemap, cached for an hour so crawlers don't hammer the DB.
     */
    public function sitemap(string $slug): Response
    {
        $tenant = $this->resolvePublicTenant($slug);

        $xml = cache()->remember(
            "sitemap:tenant:{$tenant->id}",
            now()->addHour(),
            fn() => $this->seo->sitemapXml($tenant),
        );

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }

    public function robots(string $slug): Response
    {
        $tenant = $this->resolvePublicTenant($slug);

        return response($this->seo->robotsTxt($tenant), 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    /**
     * Platform-wide sitemap index — the single entry point search/AI
     * crawlers need to discover every active tenant's own sitemap, cached
     * for an hour for the same reason the per-tenant one is.
     */
    public function sitemapIndex(): Response
    {
        $xml = cache()->remember(
            'sitemap:index',
            now()->addHour(),
            fn() => $this->seo->platformSitemapIndex(),
        );

        return response($xml, 200, ['Content-Type' => 'application/xml; charset=UTF-8']);
    }
}
