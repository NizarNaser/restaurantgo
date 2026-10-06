<?php

namespace App\Services;

use App\Models\Article;
use App\Models\ArticleTranslation;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Tenant;
use Illuminate\Support\Str;

/**
 * Builds every SEO artefact the public site needs: canonical URLs, hreflang
 * alternates, Schema.org JSON-LD blocks and the per-tenant sitemap / robots.
 *
 * URL shape: each tenant gets a base URL (custom domain > subdomain > the
 * shared "/p/{slug}" fallback used in local development), and every public
 * page hangs off it. Article slugs are unique per tenant across all locales,
 * so a slug alone resolves both the article and the language it is written in.
 */
class SeoService
{
    // ── URLs ──────────────────────────────────────────────────

    public function tenantBaseUrl(Tenant $tenant): string
    {
        if ($tenant->custom_domain) {
            return 'https://' . $tenant->custom_domain;
        }

        $baseDomain = config('app.base_domain');
        if ($baseDomain && $tenant->subdomain) {
            return 'https://' . $tenant->subdomain . '.' . $baseDomain;
        }

        return rtrim(config('app.public_url'), '/') . '/p/' . $tenant->slug;
    }

    public function menuUrl(Tenant $tenant): string
    {
        return $this->tenantBaseUrl($tenant);
    }

    public function blogUrl(Tenant $tenant): string
    {
        return $this->tenantBaseUrl($tenant) . '/blog';
    }

    public function articleUrl(Tenant $tenant, ArticleTranslation|string $translation): string
    {
        $slug = $translation instanceof ArticleTranslation ? $translation->slug : $translation;

        return $this->blogUrl($tenant) . '/' . $slug;
    }

    /**
     * hreflang alternates for an article — one entry per translated locale,
     * plus x-default pointing at the tenant's own default locale.
     */
    public function articleAlternates(Tenant $tenant, Article $article): array
    {
        $alternates = [];

        foreach ($article->translations as $translation) {
            $alternates[] = [
                'hreflang' => $translation->locale,
                'href'     => $this->articleUrl($tenant, $translation),
            ];
        }

        $default = $article->translations->firstWhere('locale', $tenant->default_locale)
            ?? $article->translations->first();

        if ($default) {
            $alternates[] = [
                'hreflang' => 'x-default',
                'href'     => $this->articleUrl($tenant, $default),
            ];
        }

        return $alternates;
    }

    // ── Schema.org / JSON-LD ──────────────────────────────────

    public function restaurantJsonLd(Tenant $tenant, ?string $locale = null): array
    {
        $branch = $tenant->branches()->where('is_active', true)->first();
        $locale = $locale ?? $tenant->default_locale;

        $schema = array_filter([
            '@context'    => 'https://schema.org',
            '@type'       => 'Restaurant',
            'name'        => $tenant->name,
            'url'         => $this->tenantBaseUrl($tenant),
            'description' => $this->pick($tenant->seo_description, $locale),
            'image'       => $tenant->seo_og_image ?: $tenant->logo_path,
            'hasMenu'     => $this->menuUrl($tenant),
            'currenciesAccepted' => $tenant->default_currency,
        ]);

        if ($branch) {
            $schema['address'] = array_filter([
                '@type'           => 'PostalAddress',
                'streetAddress'   => $this->pick($branch->address, $locale),
                'addressLocality' => app(CityTranslationService::class)->translate($branch->city, $locale),
                'addressCountry'  => $branch->country,
            ]);
            $schema['telephone'] = $branch->phone;

            if ($branch->latitude && $branch->longitude) {
                $schema['geo'] = [
                    '@type'     => 'GeoCoordinates',
                    'latitude'  => (float) $branch->latitude,
                    'longitude' => (float) $branch->longitude,
                ];
            }

            $schema = array_filter($schema);
        }

        return $schema;
    }

    /**
     * A schema.org Menu built from the tenant's active categories and items.
     *
     * @param  \Illuminate\Support\Collection<int, MenuCategory>  $categories
     * @param  \Illuminate\Support\Collection<int, MenuItem>      $items
     */
    public function menuJsonLd(Tenant $tenant, $categories, $items, ?string $locale = null): array
    {
        $locale = $locale ?? $tenant->default_locale ?? 'en';

        $sections = $categories->map(function (MenuCategory $category) use ($items, $locale, $tenant) {
            $sectionItems = $items
                ->where('menu_category_id', $category->id)
                ->map(fn(MenuItem $item) => array_filter([
                    '@type'       => 'MenuItem',
                    'name'        => $item->translation($locale)?->name,
                    'description' => $item->translation($locale)?->description,
                    'offers'      => [
                        '@type'         => 'Offer',
                        'price'         => (string) ($item->priceIn($tenant->default_currency) ?? $item->base_price),
                        'priceCurrency' => $tenant->default_currency,
                    ],
                ]))
                ->values()
                ->all();

            return array_filter([
                '@type'          => 'MenuSection',
                'name'           => $category->translation($locale)?->name,
                'hasMenuItem'    => $sectionItems,
            ]);
        })->values()->all();

        return [
            '@context'       => 'https://schema.org',
            '@type'          => 'Menu',
            'name'           => $tenant->name . ' Menu',
            'url'            => $this->menuUrl($tenant),
            'inLanguage'     => $locale,
            'hasMenuSection' => $sections,
        ];
    }

    public function articleJsonLd(Tenant $tenant, Article $article, ArticleTranslation $translation): array
    {
        return array_filter([
            '@context'         => 'https://schema.org',
            '@type'            => 'BlogPosting',
            'headline'         => $this->pick($article->seo_title, $translation->locale, $translation->title),
            'description'      => $this->pick($article->seo_description, $translation->locale, $translation->excerpt),
            'inLanguage'       => $translation->locale,
            'datePublished'    => optional($article->publish_at)->toAtomString(),
            'dateModified'     => optional($article->updated_at)->toAtomString(),
            'image'            => $article->seo_og_image ?: $article->getFirstMediaUrl('featured_image') ?: null,
            'mainEntityOfPage' => [
                '@type' => 'WebPage',
                '@id'   => $this->articleUrl($tenant, $translation),
            ],
            'author' => $article->author ? [
                '@type' => 'Person',
                'name'  => $article->author->name,
            ] : null,
            'publisher' => [
                '@type' => 'Organization',
                'name'  => $tenant->name,
                'url'   => $this->tenantBaseUrl($tenant),
            ],
        ]);
    }

    public function breadcrumbJsonLd(array $crumbs): array
    {
        return [
            '@context'        => 'https://schema.org',
            '@type'           => 'BreadcrumbList',
            'itemListElement' => collect($crumbs)->values()->map(fn($crumb, $i) => [
                '@type'    => 'ListItem',
                'position' => $i + 1,
                'name'     => $crumb['name'],
                'item'     => $crumb['url'],
            ])->all(),
        ];
    }

    /**
     * Resolves a per-locale SEO field (stored as `{locale: value}`, e.g.
     * Tenant/MenuItem/Article's seo_title) to one string for the requested
     * locale — that locale's own value if set, else the first value present
     * (so a restaurant that only wrote SEO copy in one language still has
     * *something*), else the given fallback.
     */
    public function pick(array|string|null $localized, ?string $locale, ?string $fallback = null): ?string
    {
        // Defensive: a handful of seeded/legacy rows still carry a plain
        // string from before this field became per-locale — treat that as
        // this locale's own value rather than erroring.
        if (is_string($localized)) {
            return $localized !== '' ? $localized : $fallback;
        }

        if (! $localized) {
            return $fallback;
        }

        $value = ($locale && isset($localized[$locale])) ? $localized[$locale] : (array_values($localized)[0] ?? null);

        return ($value !== null && $value !== '') ? $value : $fallback;
    }

    // ── Meta blocks ───────────────────────────────────────────

    /**
     * The meta payload the public frontend renders into <head>.
     */
    public function metaFor(
        Tenant $tenant,
        string $title,
        ?string $description,
        string $canonical,
        ?string $image = null,
        string $type = 'website',
        array $alternates = [],
    ): array {
        return [
            'title'       => $title,
            'description' => $description ? Str::limit(strip_tags($description), 160) : null,
            'canonical'   => $canonical,
            'robots'      => $tenant->isActive() ? 'index, follow' : 'noindex, nofollow',
            'alternates'  => $alternates,
            'google_site_verification' => $tenant->google_site_verification,
            'og'          => array_filter([
                'og:type'        => $type,
                'og:title'       => $title,
                'og:description' => $description ? Str::limit(strip_tags($description), 200) : null,
                'og:url'         => $canonical,
                'og:image'       => $image ?: $tenant->seo_og_image,
                'og:site_name'   => $tenant->name,
                'og:locale'      => $tenant->default_locale,
            ]),
            'twitter'     => array_filter([
                'twitter:card'        => $image ? 'summary_large_image' : 'summary',
                'twitter:title'       => $title,
                'twitter:description' => $description ? Str::limit(strip_tags($description), 200) : null,
                'twitter:image'       => $image ?: $tenant->seo_og_image,
            ]),
        ];
    }

    // ── Sitemap / robots ──────────────────────────────────────

    /**
     * Full sitemap XML for a tenant, with xhtml:link alternates on every
     * article so Google sees the translations as one page in many languages.
     */
    public function sitemapXml(Tenant $tenant): string
    {
        $base = $this->tenantBaseUrl($tenant);

        $urls = [
            ['loc' => $base, 'lastmod' => $tenant->updated_at, 'changefreq' => 'weekly', 'priority' => '1.0'],
            ['loc' => $this->blogUrl($tenant), 'lastmod' => $tenant->updated_at, 'changefreq' => 'daily', 'priority' => '0.8'],
        ];

        $articles = Article::forTenant($tenant->id)
            ->published()
            ->with('translations')
            ->orderByDesc('publish_at')
            ->get();

        foreach ($articles as $article) {
            foreach ($article->translations as $translation) {
                $urls[] = [
                    'loc'        => $this->articleUrl($tenant, $translation),
                    'lastmod'    => $article->updated_at,
                    'changefreq' => 'monthly',
                    'priority'   => '0.6',
                    'alternates' => $this->articleAlternates($tenant, $article),
                ];
            }
        }

        $xml  = '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . PHP_EOL;

        foreach ($urls as $url) {
            $xml .= '  <url>' . PHP_EOL;
            $xml .= '    <loc>' . e($this->encodeUrl($url['loc'])) . '</loc>' . PHP_EOL;

            if (! empty($url['lastmod'])) {
                $xml .= '    <lastmod>' . $url['lastmod']->toAtomString() . '</lastmod>' . PHP_EOL;
            }

            $xml .= '    <changefreq>' . $url['changefreq'] . '</changefreq>' . PHP_EOL;
            $xml .= '    <priority>' . $url['priority'] . '</priority>' . PHP_EOL;

            foreach ($url['alternates'] ?? [] as $alternate) {
                $xml .= '    <xhtml:link rel="alternate" hreflang="' . e($alternate['hreflang'])
                     . '" href="' . e($this->encodeUrl($alternate['href'])) . '"/>' . PHP_EOL;
            }

            $xml .= '  </url>' . PHP_EOL;
        }

        return $xml . '</urlset>' . PHP_EOL;
    }

    /**
     * A sitemap index listing every active tenant's own sitemap, so a single
     * URL (the platform's own `/sitemap.xml`) gives search/AI crawlers a
     * starting point that reaches every restaurant's public pages — needed
     * because path-based tenancy (`/p/{slug}`, used when there is no
     * wildcard subdomain) has no single host a crawler could discover
     * tenants from on its own.
     */
    public function platformSitemapIndex(): string
    {
        $xml  = '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;

        Tenant::active()->orderBy('id')->chunk(200, function ($tenants) use (&$xml) {
            foreach ($tenants as $tenant) {
                $xml .= '  <sitemap>' . PHP_EOL;
                $xml .= '    <loc>' . e($this->encodeUrl($this->tenantSitemapUrl($tenant))) . '</loc>' . PHP_EOL;
                $xml .= '    <lastmod>' . $tenant->updated_at->toAtomString() . '</lastmod>' . PHP_EOL;
                $xml .= '  </sitemap>' . PHP_EOL;
            }
        });

        return $xml . '</sitemapindex>' . PHP_EOL;
    }

    /**
     * Where a tenant's own `sitemapXml()` is actually reachable at. A custom
     * domain or real subdomain serves it at its own root; the path-based
     * fallback has no host of its own, so its sitemap is only ever reachable
     * on the API's own host (there is nothing else to serve it from).
     */
    private function tenantSitemapUrl(Tenant $tenant): string
    {
        if ($tenant->custom_domain || (config('app.base_domain') && $tenant->subdomain)) {
            return $this->tenantBaseUrl($tenant) . '/sitemap.xml';
        }

        return rtrim(config('app.url'), '/') . '/p/' . $tenant->slug . '/sitemap.xml';
    }

    public function robotsTxt(Tenant $tenant): string
    {
        if (! $tenant->isActive()) {
            return "User-agent: *\nDisallow: /\n";
        }

        return "User-agent: *\n"
             . "Allow: /\n"
             . "Disallow: /dashboard\n"
             . "Disallow: /login\n\n"
             . 'Sitemap: ' . $this->tenantBaseUrl($tenant) . "/sitemap.xml\n";
    }

    /**
     * Slugify a title and guarantee it is unique for the tenant across every
     * locale, so a public slug always resolves to exactly one translation.
     */
    public function uniqueSlug(int $tenantId, string $source, ?int $ignoreTranslationId = null): string
    {
        $base = $this->slugify($source);

        if ($base === '') {
            $base = 'post';
        }

        $slug    = $base;
        $suffix  = 2;

        while ($this->slugTaken($tenantId, $slug, $ignoreTranslationId)) {
            $slug = $base . '-' . $suffix++;
        }

        return $slug;
    }

    /**
     * Sitemap <loc> values must be URL-escaped, so percent-encode the
     * non-ASCII characters an Arabic (or any non-Latin) slug puts in a path.
     */
    private function encodeUrl(string $url): string
    {
        return preg_replace_callback('/[^\x20-\x7E]+/u', fn($m) => rawurlencode($m[0]), $url);
    }

    /**
     * Str::slug transliterates non-Latin scripts ("قائمة الصيف" becomes
     * "kaym-alsyf"), which reads as noise to Arabic searchers. Keep the
     * original letters whenever the title isn't plain ASCII.
     */
    private function slugify(string $source): string
    {
        $ascii = Str::slug($source);

        if ($ascii !== '' && ! preg_match('/[^\x20-\x7E]/u', $source)) {
            return $ascii;
        }

        $unicode = preg_replace('/[^\p{L}\p{N}]+/u', '-', $source);
        $unicode = trim(mb_strtolower($unicode ?? '', 'UTF-8'), '-');

        return $unicode !== '' ? $unicode : $ascii;
    }

    private function slugTaken(int $tenantId, string $slug, ?int $ignoreTranslationId): bool
    {
        return ArticleTranslation::where('slug', $slug)
            ->when($ignoreTranslationId, fn($q) => $q->where('id', '!=', $ignoreTranslationId))
            ->whereHas('article', fn($q) => $q->withTrashed()->where('tenant_id', $tenantId))
            ->exists();
    }
}
