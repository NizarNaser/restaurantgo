<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Review;
use App\Services\SeoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The public restaurant directory on the main marketing site — every active
 * tenant with at least one active branch is listed, browsable by country/city.
 * Listed at branch level (a tenant can have several), each row carrying its
 * parent restaurant's identity for the card/link.
 */
class DirectoryController extends Controller
{
    public function __construct(private readonly SeoService $seo) {}

    public function index(Request $request): JsonResponse
    {
        $branches = Branch::query()
            ->where('is_active', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'))
            ->with('tenant:id,name,slug,subdomain,logo_path,seo_description')
            ->when($request->country, fn ($q) => $q->where('country', $request->country))
            ->when($request->city, fn ($q) => $q->where('city', 'like', "%{$request->city}%"))
            ->when($request->search, fn ($q) => $q->whereHas(
                'tenant',
                fn ($t) => $t->where('name', 'like', "%{$request->search}%")
            ))
            ->orderBy('city')
            ->paginate($request->per_page ?? 20);

        $locale = $request->query('lang');
        $branches->getCollection()->transform(fn (Branch $branch) => $this->branchToCard($branch, null, $locale));

        return response()->json($branches);
    }

    /**
     * Top N restaurants by average rating, for the homepage's "best rated" spotlight.
     * Ratings are computed, not a stored column, so this ranks in PHP rather than
     * relying on the paginated `index()` query's DB-level ordering.
     */
    public function topRated(Request $request): JsonResponse
    {
        $limit = max(1, min(20, (int) $request->query('limit', 10)));

        $ratingsByTenant = Review::approved()
            ->selectRaw('tenant_id, AVG(rating) as avg_rating, COUNT(*) as rating_count')
            ->groupBy('tenant_id')
            ->get()
            ->keyBy('tenant_id');

        $cards = Branch::query()
            ->where('is_active', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'))
            ->whereIn('tenant_id', $ratingsByTenant->keys())
            ->with('tenant:id,name,slug,subdomain,logo_path,seo_description')
            ->get()
            ->map(fn (Branch $branch) => $this->branchToCard($branch, $ratingsByTenant->get($branch->tenant_id), $request->query('lang')))
            ->sortByDesc(fn ($card) => [$card['rating_average'], $card['rating_count']])
            ->values()
            ->take($limit);

        return response()->json($cards);
    }

    /**
     * Distinct country/city combinations, to populate the directory's filter dropdowns.
     */
    public function filters(): JsonResponse
    {
        $locations = Branch::query()
            ->where('is_active', true)
            ->whereHas('tenant', fn ($q) => $q->where('status', 'active'))
            ->whereNotNull('country')
            ->select('country', 'city')
            ->distinct()
            ->orderBy('country')
            ->orderBy('city')
            ->get()
            ->groupBy('country')
            ->map(fn ($rows) => $rows->pluck('city')->filter()->unique()->values());

        return response()->json($locations);
    }

    private function branchToCard(Branch $branch, ?object $precomputedRating = null, ?string $locale = null): array
    {
        if ($precomputedRating) {
            $ratingAverage = round((float) $precomputedRating->avg_rating, 1);
            $ratingCount = (int) $precomputedRating->rating_count;
        } else {
            $ratings = Review::where('tenant_id', $branch->tenant_id)->approved();
            $ratingAverage = round((float) (clone $ratings)->avg('rating'), 1);
            $ratingCount = (clone $ratings)->count();
        }

        return [
            'tenant_name'    => $branch->tenant->name,
            'tenant_slug'    => $branch->tenant->slug,
            'logo_path'      => $branch->tenant->logo_path,
            'description'    => $this->seo->pick($branch->tenant->seo_description, $locale),
            'branch_id'      => $branch->id,
            'address'        => $branch->address,
            'city'           => $branch->city,
            'country'        => $branch->country,
            'latitude'       => $branch->latitude ? (float) $branch->latitude : null,
            'longitude'      => $branch->longitude ? (float) $branch->longitude : null,
            'rating_average' => $ratingAverage ?: null,
            'rating_count'   => $ratingCount,
        ];
    }
}
