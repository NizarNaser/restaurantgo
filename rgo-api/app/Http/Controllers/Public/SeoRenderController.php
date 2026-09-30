<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuCategory;
use App\Services\SeoService;
use Illuminate\View\View;

/**
 * A pure server-rendered (no JS required) HTML page for a tenant's public
 * menu, built from the exact same data/meta/JSON-LD the `dashboard` SPA
 * renders client-side (see MenuController::getInfo/getMenu). Search and AI
 * crawlers that don't execute JavaScript (most of them — GPTBot, ClaudeBot,
 * PerplexityBot, and non-Google/Bing search engines in general) only ever
 * see the SPA's near-empty `<div id="root">` otherwise, so shared hosting's
 * static frontend serves THIS page to those user-agents instead, at the
 * same public URL — see dashboard/public/bot-render.php, the shim that
 * fetches this route and echoes it back to the crawler.
 */
class SeoRenderController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly SeoService $seo) {}

    public function menu(string $slug): View
    {
        $tenant = $this->resolvePublicTenant($slug);
        $locale = $this->resolvePublicLocale($tenant);
        $branch = $tenant->branches()->where('is_active', true)->first();

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with('translations')
            ->orderBy('sort_order')
            ->get();

        $items = \App\Models\MenuItem::where('tenant_id', $tenant->id)
            ->where('is_available', true)
            ->with(['translations', 'prices'])
            ->orderBy('sort_order')
            ->get();

        return view('public.menu-preview', [
            'tenant'     => $tenant,
            'locale'     => $locale,
            'branch'     => $branch,
            'categories' => $categories,
            'items'      => $items,
            'menuUrl'    => $this->seo->menuUrl($tenant),
            'seo'        => $this->seo->metaFor(
                $tenant,
                ($this->seo->pick($tenant->seo_title, $locale) ?: $tenant->name) . ' — Menu',
                $this->seo->pick($tenant->seo_description, $locale),
                $this->seo->menuUrl($tenant),
            ),
            'jsonLd' => [
                $this->seo->restaurantJsonLd($tenant),
                $this->seo->menuJsonLd($tenant, $categories, $items, $locale),
            ],
        ]);
    }
}
