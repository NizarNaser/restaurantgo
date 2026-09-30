<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Public\Concerns\ResolvesPublicTenant;
use App\Models\MenuItem;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ResolvesPublicTenant;

    /**
     * Service-level reviews (not tied to a specific dish) for the restaurant's
     * own page — the average/count summary already lives on getInfo(); this
     * is the list of actual comments behind that number.
     */
    public function index(string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $reviews = Review::where('tenant_id', $tenant->id)
            ->whereNull('menu_item_id')
            ->approved()
            ->orderByDesc('created_at')
            ->limit(50)
            ->get(['id', 'customer_name', 'rating', 'comment', 'created_at']);

        return response()->json(['status' => 'success', 'data' => $reviews]);
    }

    /**
     * A review with a menu_item_id rates that dish; one without rates the
     * restaurant's service as a whole and is attached to its active branch.
     */
    public function store(Request $request, string $slug): JsonResponse
    {
        $tenant = $this->resolvePublicTenant($slug);

        $data = $request->validate([
            'menu_item_id'   => ['nullable', 'integer'],
            'customer_name'  => ['required', 'string', 'max:100'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'rating'         => ['required', 'integer', 'between:1,5'],
            'comment'        => ['nullable', 'string', 'max:1000'],
        ]);

        $menuItem = null;
        if (! empty($data['menu_item_id'])) {
            $menuItem = MenuItem::where('tenant_id', $tenant->id)->find($data['menu_item_id']);
            abort_if(! $menuItem, 404, 'Item not found.');
        }

        $branch = $menuItem ? null : $tenant->branches()->where('is_active', true)->first();

        $review = Review::create([
            'tenant_id'      => $tenant->id,
            'menu_item_id'   => $menuItem?->id,
            'branch_id'      => $branch?->id,
            'customer_name'  => $data['customer_name'],
            'customer_email' => $data['customer_email'] ?? null,
            'rating'         => $data['rating'],
            'comment'        => $data['comment'] ?? null,
            // Published immediately — there is no moderation queue yet, and an
            // unapproved review would otherwise never be visible to anyone.
            'is_approved'    => true,
        ]);

        return response()->json([
            'status' => 'success',
            'data'   => [
                'id'            => $review->id,
                'customer_name' => $review->customer_name,
                'rating'        => $review->rating,
                'comment'       => $review->comment,
                'created_at'    => $review->created_at->toIso8601String(),
            ],
        ], 201);
    }
}
