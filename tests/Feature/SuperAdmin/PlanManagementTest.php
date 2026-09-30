<?php

use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('lists plans for platform staff', function () {
    $this->getJson('/api/admin/plans')
        ->assertOk()
        ->assertJsonFragment(['slug' => 'starter']);
});

it('creates a plan', function () {
    $response = $this->postJson('/api/admin/plans', [
        'name'           => 'Growth',
        'price_monthly'  => 49,
        'price_yearly'   => 490,
        'currency'       => 'USD',
        'max_branches'   => 5,
        'max_menu_items' => 200,
        'is_active'      => true,
    ]);

    $response->assertCreated();
    expect(Plan::where('slug', 'growth')->exists())->toBeTrue();
});

it('updates a plan', function () {
    $plan = Plan::where('slug', 'starter')->firstOrFail();

    $this->putJson("/api/admin/plans/{$plan->id}", [
        'name'          => $plan->name,
        'price_monthly' => 19,
        'price_yearly'  => 190,
        'currency'      => 'USD',
        'is_active'     => false,
    ])->assertOk();

    expect($plan->fresh()->is_active)->toBeFalse();
    expect((float) $plan->fresh()->price_monthly)->toBe(19.0);
});

it('refuses to delete a plan that still has tenants on it', function () {
    $plan = Plan::where('slug', 'starter')->firstOrFail();
    expect(Tenant::where('plan_id', $plan->id)->exists())->toBeTrue();

    $this->deleteJson("/api/admin/plans/{$plan->id}")->assertStatus(422);
    expect(Plan::find($plan->id))->not->toBeNull();
});

it('rejects plan management from a non-platform user', function () {
    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($owner, ['*']);

    $this->getJson('/api/admin/plans')->assertForbidden();
});
