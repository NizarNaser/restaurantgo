<?php

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Tenant;
use App\Services\OpenAiService;

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->item = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 10.00, 'is_available' => true,
    ]);
    $this->item->translations()->create(['locale' => 'en', 'name' => 'Margherita Pizza', 'description' => 'Tomato and mozzarella']);
});

it('rejects a chat request with no messages', function () {
    $this->postJson('/api/v1/public/demo-restaurant/assistant/chat', [])->assertStatus(422);
});

it('returns 404 for an unknown restaurant slug', function () {
    $this->postJson('/api/v1/public/no-such-restaurant/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'Are you open now?']],
    ])->assertNotFound();
});

it('grounds the system prompt in the restaurant\'s real name and menu', function () {
    $tenantName = $this->tenant->name;

    // Mock set up before the (only) request in this test — a route's
    // resolved controller/service is cached for the lifetime of a single
    // test (learned the hard way with Stripe/PayPal/AI mocks earlier).
    $this->mock(OpenAiService::class)
        ->shouldReceive('chat')
        ->once()
        ->with(
            Mockery::type('array'),
            Mockery::on(function (string $prompt) use ($tenantName) {
                return str_contains($prompt, $tenantName)
                    && str_contains($prompt, 'Margherita Pizza');
            })
        )
        ->andReturn('We do have vegetarian options!');

    $this->postJson('/api/v1/public/demo-restaurant/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'Do you have vegetarian options?']],
    ])->assertOk()->assertJson(['reply' => 'We do have vegetarian options!']);
});
