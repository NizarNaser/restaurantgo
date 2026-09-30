<?php

use App\Models\User;
use App\Services\OpenAiService;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('rejects a chat request with no messages', function () {
    $this->postJson('/api/assistant/chat', [])->assertStatus(422);
});

it('rejects a message with an invalid role', function () {
    $this->postJson('/api/assistant/chat', [
        'messages' => [['role' => 'system', 'content' => 'hi']],
    ])->assertStatus(422);
});

it('rejects a message over the length cap', function () {
    $this->postJson('/api/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => str_repeat('a', 4001)]],
    ])->assertStatus(422);
});

it('returns the assistant reply on a valid request', function () {
    // Mock set up before the (only) request in this test — a route's
    // resolved controller/service is cached for the lifetime of a single
    // test (learned the hard way with Stripe/PayPal mocks earlier).
    $this->mock(OpenAiService::class)
        ->shouldReceive('chat')
        ->once()
        ->andReturn('You can connect Stripe from the Billing page.');

    $this->postJson('/api/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'How do I get paid for delivery orders?']],
    ])->assertOk()->assertJson(['reply' => 'You can connect Stripe from the Billing page.']);
});

it('cleanly rejects when the assistant is not configured', function () {
    // No OPENAI_API_KEY is set in the test environment, so the real
    // OpenAiService (not mocked here) hits its own assertConfigured() guard.
    $this->postJson('/api/assistant/chat', [
        'messages' => [['role' => 'user', 'content' => 'hi']],
    ])->assertStatus(422);
});
