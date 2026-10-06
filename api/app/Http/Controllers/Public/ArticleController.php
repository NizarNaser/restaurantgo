<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\Article;
use App\Models\ArticleTranslation;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ArticleController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly SeoService $seo) {}

    /**
     * Published articles for a restaurant's public blog, with the SEO meta
     * and JSON-LD the frontend renders into <head>.
     */
    public function index(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);
        $locale = $this->resolvePublicLocale($tenant);

        $articles = Article::forTenant($tenant->id)
            ->published()
            ->with(['translations', 'author', 'media'])
            ->orderByDesc('publish_at')
            ->paginate($request->per_page ?? 12);

        $data = $articles->getCollection()->map(function (Article $article) use ($tenant, $locale) {
            $translation = $article->translation($locale);

            return [
                'id'             => $article->id,
                'title'          => $translation?->title,
                'slug'           => $translation?->slug,
                'excerpt'        => $translation?->excerpt ?: Str::limit(strip_tags($translation?->content ?? ''), 180),
                'locale'         => $translation?->locale,
                'published_at'   => optional($article->publish_at)->toIso8601String(),
                'author'         => $article->author?->name,
                'featured_image' => $article->getFirstMediaUrl('featured_image') ?: null,
                'url'            => $translation ? $this->seo->articleUrl($tenant, $translation) : null,
            ];
        });

        return response()->json([
            'status' => 'success',
            'data'   => $data,
            'meta'   => [
                'current_page' => $articles->currentPage(),
                'last_page'    => $articles->lastPage(),
                'total'        => $articles->total(),
            ],
            'seo'    => $this->seo->metaFor(
                $tenant,
                ($this->seo->pick($tenant->seo_title, $locale) ?: $tenant->name) . ' — Blog',
                $this->seo->pick($tenant->seo_description, $locale),
                $this->seo->blogUrl($tenant),
                type: 'website',
            ),
            'json_ld' => [
                $this->seo->restaurantJsonLd($tenant, $locale),
                $this->seo->breadcrumbJsonLd([
                    ['name' => $tenant->name, 'url' => $this->seo->tenantBaseUrl($tenant)],
                    ['name' => 'Blog',        'url' => $this->seo->blogUrl($tenant)],
                ]),
            ],
        ]);
    }

    /**
     * A single published article, resolved by its (tenant-unique) slug.
     */
    public function show(string $slug, string $articleSlug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $translation = ArticleTranslation::where('slug', $articleSlug)
            ->whereHas('article', fn($q) => $q->where('tenant_id', $tenant->id)->published())
            ->firstOrFail();

        $article = $translation->article()->with(['translations', 'author', 'media'])->firstOrFail();

        $alternates = $this->seo->articleAlternates($tenant, $article);
        $canonical  = $this->seo->articleUrl($tenant, $translation);
        $image      = $article->seo_og_image ?: ($article->getFirstMediaUrl('featured_image') ?: null);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'id'             => $article->id,
                'title'          => $translation->title,
                'slug'           => $translation->slug,
                'excerpt'        => $translation->excerpt,
                'content'        => $translation->content,
                'locale'         => $translation->locale,
                'published_at'   => optional($article->publish_at)->toIso8601String(),
                'updated_at'     => optional($article->updated_at)->toIso8601String(),
                'author'         => $article->author?->name,
                'featured_image' => $article->getFirstMediaUrl('featured_image') ?: null,
                'translations'   => collect($alternates)
                    ->reject(fn($a) => $a['hreflang'] === 'x-default')
                    ->values(),
            ],
            'seo' => $this->seo->metaFor(
                $tenant,
                $this->seo->pick($article->seo_title, $translation->locale) ?: $translation->title,
                $this->seo->pick($article->seo_description, $translation->locale) ?: ($translation->excerpt ?: $translation->content),
                $canonical,
                $image,
                'article',
                $alternates,
            ),
            'json_ld' => [
                $this->seo->articleJsonLd($tenant, $article, $translation),
                $this->seo->breadcrumbJsonLd([
                    ['name' => $tenant->name,       'url' => $this->seo->tenantBaseUrl($tenant)],
                    ['name' => 'Blog',              'url' => $this->seo->blogUrl($tenant)],
                    ['name' => $translation->title, 'url' => $canonical],
                ]),
            ],
        ]);
    }
}
