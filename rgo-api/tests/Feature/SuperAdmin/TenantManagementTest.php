<?php

use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('lists tenants for platform staff', function () {
    $this->getJson('/api/admin/tenants')
        ->assertOk()
        ->assertJsonFragment(['slug' => 'demo-restaurant']);
});

it('suspends and reactivates a tenant', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $this->putJson("/api/admin/tenants/{$tenant->id}/suspend")->assertOk();
    expect($tenant->fresh()->status)->toBe('suspended');

    $this->putJson("/api/admin/tenants/{$tenant->id}/activate")->assertOk();
    expect($tenant->fresh()->status)->toBe('active');
});
