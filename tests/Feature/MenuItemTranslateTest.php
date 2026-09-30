<?php

use App\Models\User;
use App\Services\OpenAiService;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('rejects when source_locale and target_locale are the same', function () {
    $this->postJson('/api/menu/items/translate', [
        'source_locale' => 'en', 'target_locale' => 'en', 'name' => 'Pizza',
    ])->assertStatus(422);
});

it('rejects a request without a name', function () {
    $this->postJson('/api/menu/items/translate', [
        'source_locale' => 'en', 'target_locale' => 'ar',
    ])->assertStatus(422);
});

it('returns the translated name and description on a valid request', function () {
    // Mock set up before the (only) request in this test — a route's
    // resolved controller/service is cached for the lifetime of a single
    // test (learned the hard way with Stripe/PayPal/AI mocks earlier).
    $this->mock(OpenAiService::class)
        ->shouldReceive('chat')
        ->once()
        ->andReturn(json_encode(['name' => 'بيتزا مارغريتا', 'description' => 'طماطم وجبنة موزاريلا']));

    $this->postJson('/api/menu/items/translate', [
        'source_locale' => 'en', 'target_locale' => 'ar',
        'name' => 'Margherita Pizza', 'description' => 'Tomato and mozzarella',
    ])->assertOk()->assertJson([
        'name'        => 'بيتزا مارغريتا',
        'description' => 'طماطم وجبنة موزاريلا',
    ]);
});

it('cleanly rejects a non-JSON reply from the AI service', function () {
    $this->mock(OpenAiService::class)
        ->shouldReceive('chat')
        ->once()
        ->andReturn('Sorry, I cannot help with that.');

    $this->postJson('/api/menu/items/translate', [
        'source_locale' => 'en', 'target_locale' => 'ar', 'name' => 'Pizza',
    ])->assertStatus(422);
});
