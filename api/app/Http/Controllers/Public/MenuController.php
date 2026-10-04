<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\Department;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Review;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;

class MenuController extends Controller
{
    use ResolvesPublicTenant;

    public function __construct(private readonly SeoService $seo) {}

    public function getInfo(string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);
        $branch = $tenant->branches()->where('is_active', true)->first();
        $locale = $this->resolvePublicLocale($tenant);

        $serviceReviews = Review::where('tenant_id', $tenant->id)
            ->whereNull('menu_item_id')
            ->approved();

        return response()->json([
            'status' => 'success',
            'data' => [
                'name'        => $tenant->name,
                'slug'        => $tenant->slug,
                'description' => $this->seo->pick($tenant->seo_description, $locale, ''),
                'avatar'      => $tenant->logo_path ?? null,
                'cover_image' => $tenant->cover_image_path ?? null,
                'favicon'     => $tenant->favicon_path ?? null,
                'locale'            => $locale,
                'default_locale'    => $tenant->default_locale ?? config('app.locale'),
                'supported_locales' => $tenant->supported_locales ?: [$tenant->default_locale ?? config('app.locale')],
                // Dine-in only — never shown/charged for delivery orders.
                'service_charge_rate'         => (float) $tenant->service_charge_rate,
                'service_charge_message'      => $tenant->service_charge_show_message ? $tenant->service_charge_message : null,
                'public_url'  => $this->seo->menuUrl($tenant),
                'blog_url'    => $this->seo->blogUrl($tenant),
                'analytics'   => [
                    'google_analytics_id' => $tenant->google_analytics_id,
                    'facebook_pixel_id'   => $tenant->facebook_pixel_id,
                ],
                'contact'     => $branch ? [
                    'phone'         => $branch->phone,
                    'address'       => $branch->address,
                    'city'          => $branch->city,
                    'country'       => $branch->country,
                    'working_hours' => $branch->working_hours,
                    'latitude'      => $branch->latitude ? (float) $branch->latitude : null,
                    'longitude'     => $branch->longitude ? (float) $branch->longitude : null,
                    'maps_embed_url' => $branch->google_maps_embed_url,
                ] : null,
                'service_rating' => [
                    'average' => $this->roundRating((clone $serviceReviews)->avg('rating')),
                    'count'   => (clone $serviceReviews)->count(),
                ],
                'social' => [
                    'facebook'  => $tenant->social_facebook_url,
                    'instagram' => $tenant->social_instagram_url,
                    'twitter'   => $tenant->social_twitter_url,
                    'tiktok'    => $tenant->social_tiktok_url,
                    'youtube'   => $tenant->social_youtube_url,
                    'snapchat'  => $tenant->social_snapchat_url,
                ],
            ],
            'seo' => $this->seo->metaFor(
                $tenant,
                $this->seo->pick($tenant->seo_title, $locale) ?: $tenant->name,
                $this->seo->pick($tenant->seo_description, $locale),
                $this->seo->tenantBaseUrl($tenant),
            ),
            'json_ld' => [$this->seo->restaurantJsonLd($tenant)],
        ]);
    }

    public function getMenu(string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);
        $locale = $this->resolvePublicLocale($tenant);

        $categories = MenuCategory::where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->with('translations')
            ->orderBy('sort_order')
            ->get();

        // Departments (Kitchen, Bar, ...) are the same grouping the dashboard's
        // Menu page already uses — surfaced here so the public site can offer
        // one-tap department filters (e.g. "Bar") above the finer-grained
        // category list, without the customer needing to know category names.
        $departments = Department::where('tenant_id', $tenant->id)
            ->with('translations')
            ->orderBy('sort_order')
            ->get()
            ->map(fn(Department $dept) => [
                'id'   => $dept->id,
                'name' => $dept->translation($locale)?->name ?? $dept->name,
            ]);

        $items = $this->ratedItemsQuery($tenant->id)
            ->where('is_available', true)
            ->orderBy('sort_order')
            ->get();

        $trending = $this->trendingItems($tenant->id, $items);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'departments' => $departments,
                'categories' => $categories->map(fn(MenuCategory $cat) => [
                    'id'            => $cat->id,
                    'name'          => $cat->translation($locale)?->name ?? 'Category',
                    'department_id' => $cat->department_id,
                ]),
                'items'    => $items->map(fn(MenuItem $item) => $this->serializeItem($item, $locale, $tenant->default_currency)),
                'trending' => $trending->map(fn(MenuItem $item) => $this->serializeItem($item, $locale, $tenant->default_currency)),
            ],
            'seo' => $this->seo->metaFor(
                $tenant,
                ($this->seo->pick($tenant->seo_title, $locale) ?: $tenant->name) . ' — Menu',
                $this->seo->pick($tenant->seo_description, $locale),
                $this->seo->menuUrl($tenant),
            ),
            'json_ld' => [
                $this->seo->restaurantJsonLd($tenant),
                $this->seo->menuJsonLd($tenant, $categories, $items, $locale),
            ],
        ]);
    }

    public function getItem(string $slug, int $itemId): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);
        $locale = $this->resolvePublicLocale($tenant);

        $item = $this->ratedItemsQuery($tenant->id)
            ->where('is_available', true)
            ->with('category.translations')
            ->findOrFail($itemId);

        $reviews = $item->approvedReviews()->orderByDesc('created_at')->limit(50)->get();

        $related = $this->ratedItemsQuery($tenant->id)
            ->where('id', '!=', $item->id)
            ->where('is_available', true)
            ->where('menu_category_id', $item->menu_category_id)
            ->orderBy('sort_order')
            ->limit(4)
            ->get();

        $canonical = $this->seo->menuUrl($tenant) . '/item/' . $item->id;
        $image     = $item->imageUrl();

        return response()->json([
            'status' => 'success',
            'data'   => array_merge($this->serializeItem($item, $locale, $tenant->default_currency), [
                'category_name' => $item->category?->translation($locale)?->name,
                'reviews'       => $reviews->map(fn(Review $r) => [
                    'id'            => $r->id,
                    'customer_name' => $r->customer_name,
                    'rating'        => $r->rating,
                    'comment'       => $r->comment,
                    'created_at'    => $r->created_at->toIso8601String(),
                ]),
            ]),
            'related' => $related->map(fn(MenuItem $i) => $this->serializeItem($i, $locale, $tenant->default_currency)),
            'seo'     => $this->seo->metaFor(
                $tenant,
                $this->seo->pick($item->seo_title, $locale) ?: (($item->translation($locale)?->name ?: 'Item') . ' — ' . $tenant->name),
                $this->seo->pick($item->seo_description, $locale) ?: ($item->translation($locale)?->description ?: $this->seo->pick($tenant->seo_description, $locale)),
                $canonical,
                $item->seo_og_image ?: $image,
            ),
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────

    private function ratedItemsQuery(int $tenantId)
    {
        return MenuItem::where('tenant_id', $tenantId)
            ->withAvg(['approvedReviews as avg_rating'], 'rating')
            ->withCount(['approvedReviews as reviews_count'])
            ->with(['translations', 'prices', 'media']);
    }

    /**
     * Featured items first; if the tenant hasn't flagged any, fall back to
     * the best-reviewed items so "Trending" is never an empty section.
     *
     * @param  \Illuminate\Support\Collection<int, MenuItem>  $items  already-loaded items to fall back on
     */
    private function trendingItems(int $tenantId, $items)
    {
        $featured = $items->where('is_featured', true)->values();

        if ($featured->isNotEmpty()) {
            return $featured->take(8);
        }

        return $items
            ->filter(fn(MenuItem $i) => $i->reviews_count > 0)
            ->sortByDesc('avg_rating')
            ->take(8)
            ->values();
    }

    private function serializeItem(MenuItem $item, string $locale, string $currency): array
    {
        return [
            'id'            => $item->id,
            'category_id'   => $item->menu_category_id,
            'name'          => $item->translation($locale)?->name ?? 'Item',
            'description'   => $item->translation($locale)?->description,
            'weight'        => $item->weight,
            'tags'          => $item->tags ?? [],
            'is_featured'   => (bool) $item->is_featured,
            'is_available'  => (bool) $item->is_available,
            'price'         => $item->prices->first()?->price ?? $item->base_price ?? 0,
            'currency'      => $item->prices->first()?->currency ?? $currency,
            'image_url'         => $item->imageUrl(),
            'image_thumb_url'   => $item->imageUrl('thumb'),
            'image_card_url'    => $item->imageUrl('card'),
            'avg_rating'    => $this->roundRating($item->avg_rating),
            'reviews_count' => (int) ($item->reviews_count ?? 0),
        ];
    }

    private function roundRating(mixed $value): ?float
    {
        return $value !== null ? round((float) $value, 1) : null;
    }
}
