<?php

use App\Models\Review;
use App\Models\Tenant;

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
});

it('lists approved service-level reviews for a restaurant', function () {
    Review::create([
        'tenant_id' => $this->tenant->id, 'menu_item_id' => null,
        'customer_name' => 'Nour', 'rating' => 5, 'comment' => 'Wonderful evening!', 'is_approved' => true,
    ]);

    $response = $this->getJson("/api/v1/public/{$this->tenant->slug}/reviews");

    $response->assertOk();
    $response->assertJsonFragment(['customer_name' => 'Nour', 'comment' => 'Wonderful evening!']);
});

it('excludes dish-level reviews from the restaurant-wide list', function () {
    $category = \App\Models\MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0]);
    $item = \App\Models\MenuItem::create(['tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id, 'base_price' => 10]);
    Review::create([
        'tenant_id' => $this->tenant->id, 'menu_item_id' => $item->id,
        'customer_name' => 'Dish Reviewer', 'rating' => 4, 'comment' => 'Great dish', 'is_approved' => true,
    ]);

    $response = $this->getJson("/api/v1/public/{$this->tenant->slug}/reviews");

    $response->assertOk();
    $response->assertJsonMissing(['customer_name' => 'Dish Reviewer']);
});

it('lets a visitor submit a new service review with a rating and comment', function () {
    $response = $this->postJson("/api/v1/public/{$this->tenant->slug}/reviews", [
        'customer_name' => 'Visitor',
        'rating'        => 5,
        'comment'       => 'Loved it, coming back soon.',
    ]);

    $response->assertCreated();
    expect(Review::where('customer_name', 'Visitor')->where('menu_item_id', null)->exists())->toBeTrue();

    // Immediately visible — the review has no moderation queue.
    $this->getJson("/api/v1/public/{$this->tenant->slug}/reviews")
        ->assertJsonFragment(['customer_name' => 'Visitor']);
});

it('rejects a review with an out-of-range rating', function () {
    $this->postJson("/api/v1/public/{$this->tenant->slug}/reviews", [
        'customer_name' => 'Visitor', 'rating' => 7,
    ])->assertStatus(422);
});
