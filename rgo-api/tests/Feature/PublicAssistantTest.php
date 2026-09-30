<?php

use App\Services\OpenAiService;

it('rejects a chat request with no messages', function () {
    $this->postJson('/api/v1/assistant/chat', [])->assertStatus(422);
});

it('rejects a message with an invalid role', function () {
    $this->postJson('/api/v1/assistant/chat', [
        'messages' => [['role' => 'system', 'content' => 'hi']],
    ])->assertStatus(422);
});

it('rejects a message over the length cap', function () {
    $this->postJson('/api/v1/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => str_repeat('a', 4001)]],
    ])->assertStatus(422);
});

it('returns the assistant reply on a valid request, with no authentication needed', function () {
    // Mock set up before the (only) request in this test — a route's
    // resolved controller/service is cached for the lifetime of a single
    // test (learned the hard way with Stripe/PayPal/AI-1 mocks earlier).
    $this->mock(OpenAiService::class)
        ->shouldReceive('chat')
        ->once()
        ->with(Mockery::type('array'), Mockery::type('string'))
        ->andReturn('RestaurantGo lets you manage your menu, take orders, and accept online payments.');

    $this->postJson('/api/v1/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'What does RestaurantGo do?']],
    ])->assertOk()->assertJson(['reply' => 'RestaurantGo lets you manage your menu, take orders, and accept online payments.']);
});

it('cleanly rejects when the assistant is not configured', function () {
    // No OPENAI_API_KEY is set in the test environment, so the real
    // OpenAiService (not mocked here) hits its own assertConfigured() guard.
    $this->postJson('/api/v1/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'hi']],
    ])->assertStatus(422);
});
