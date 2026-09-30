<?php

use App\Models\Advertisement;
use App\Models\ContactMessage;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
});

it('accepts a public contact message', function () {
    $this->postJson('/api/v1/contact', [
        'name' => 'Ali', 'email' => 'ali@example.com', 'message' => 'How do I list my restaurant?',
    ])->assertCreated();

    expect(ContactMessage::where('email', 'ali@example.com')->exists())->toBeTrue();
});

it('only lists active, in-window advertisements publicly', function () {
    Advertisement::create(['title' => 'Live', 'placement' => 'home_hero', 'is_active' => true]);
    Advertisement::create(['title' => 'Disabled', 'placement' => 'home_hero', 'is_active' => false]);
    Advertisement::create(['title' => 'Expired', 'placement' => 'home_hero', 'is_active' => true, 'ends_at' => now()->subDay()]);

    $response = $this->getJson('/api/v1/ads?placement=home_hero');

    $response->assertOk();
    $titles = collect($response->json())->pluck('title');
    expect($titles)->toContain('Live');
    expect($titles)->not->toContain('Disabled');
    expect($titles)->not->toContain('Expired');
});

it('lets platform staff manage advertisements and read the contact inbox', function () {
    $admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($admin, ['*']);

    $create = $this->postJson('/api/admin/advertisements', [
        'title' => 'New Ad', 'placement' => 'directory_top', 'is_active' => true,
    ]);
    $create->assertCreated();

    $this->getJson('/api/admin/advertisements')->assertOk()->assertJsonFragment(['title' => 'New Ad']);

    ContactMessage::create(['name' => 'Ali', 'email' => 'ali@example.com', 'message' => 'Hi']);
    $this->getJson('/api/admin/contact-messages')->assertOk()->assertJsonFragment(['email' => 'ali@example.com']);
});
