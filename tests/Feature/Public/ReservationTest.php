<?php

use App\Models\Reservation;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
});

it('creates a public table reservation for a restaurant', function () {
    $response = $this->postJson('/api/v1/public/demo-restaurant/reservations', [
        'type' => 'table',
        'customer_name' => 'Nadia',
        'customer_phone' => '+96170000000',
        'party_size' => 4,
        'reserved_at' => now()->addDay()->toIso8601String(),
    ]);

    $response->assertCreated();
    expect(Reservation::where('customer_name', 'Nadia')->exists())->toBeTrue();
});

it('requires an event name when booking an event', function () {
    $this->postJson('/api/v1/public/demo-restaurant/reservations', [
        'type' => 'event',
        'customer_name' => 'Nadia',
        'customer_phone' => '+96170000000',
        'party_size' => 40,
        'reserved_at' => now()->addDay()->toIso8601String(),
    ])->assertStatus(422);
});

it('lets the tenant owner see and confirm incoming reservations', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $reservation = Reservation::create([
        'tenant_id' => $this->owner->tenant_id, 'type' => 'table',
        'customer_name' => 'Nadia', 'customer_phone' => '+96170000000',
        'party_size' => 2, 'reserved_at' => now()->addDay(), 'status' => 'pending',
    ]);

    $this->getJson('/api/reservations')->assertOk()->assertJsonFragment(['customer_name' => 'Nadia']);

    $this->putJson("/api/reservations/{$reservation->id}", ['status' => 'confirmed'])
        ->assertOk()
        ->assertJsonPath('status', 'confirmed');
});

it('rejects updating a reservation belonging to another tenant', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $otherTenant = Tenant::create([
        'name' => 'Other', 'slug' => 'other-3', 'subdomain' => 'other3',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    $reservation = Reservation::create([
        'tenant_id' => $otherTenant->id, 'type' => 'table',
        'customer_name' => 'Not Yours', 'customer_phone' => '000',
        'party_size' => 2, 'reserved_at' => now()->addDay(), 'status' => 'pending',
    ]);

    // The tenant global scope makes another tenant's reservation invisible to route-model
    // binding itself, so the request 404s before the controller's own guard ever runs.
    $this->putJson("/api/reservations/{$reservation->id}", ['status' => 'confirmed'])->assertNotFound();
});
