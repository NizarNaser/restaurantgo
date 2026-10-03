<?php

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StripeService;
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

it('lets platform staff create a tenant directly on a paid plan without checkout', function () {
    $plan = Plan::where('slug', 'pro')->firstOrFail();

    $response = $this->postJson('/api/admin/tenants', [
        'restaurant_name' => 'Admin Created Diner',
        'subdomain' => 'admin-created-diner',
        'plan_id' => $plan->id,
        'owner_name' => 'New Owner',
        'owner_email' => 'new-owner@example.com',
        'owner_password' => 'Password1',
        'owner_password_confirmation' => 'Password1',
    ])->assertCreated();

    $tenant = Tenant::where('subdomain', 'admin-created-diner')->firstOrFail();
    expect($tenant->plan_id)->toBe($plan->id);
    expect($tenant->status)->toBe('active');
    expect($tenant->trial_ends_at)->toBeNull();

    $subscription = Subscription::where('tenant_id', $tenant->id)->firstOrFail();
    expect($subscription->status)->toBe(Subscription::STATUS_ACTIVE);
    expect($subscription->plan_id)->toBe($plan->id);

    $owner = $tenant->users()->role('owner')->firstOrFail();
    expect($owner->email)->toBe('new-owner@example.com');

    $response->assertJsonPath('tenant.subdomain', 'admin-created-diner');
});

it('lets platform staff switch a tenant onto another plan without payment', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    $newPlan = Plan::where('slug', 'enterprise')->firstOrFail();

    $this->putJson("/api/admin/tenants/{$tenant->id}/plan", ['plan_id' => $newPlan->id])
        ->assertOk()
        ->assertJsonPath('tenant.plan.id', $newPlan->id);

    $tenant->refresh();
    expect($tenant->plan_id)->toBe($newPlan->id);
    expect($tenant->status)->toBe('active');

    $subscription = Subscription::where('tenant_id', $tenant->id)->firstOrFail();
    expect($subscription->plan_id)->toBe($newPlan->id);
    expect($subscription->status)->toBe(Subscription::STATUS_ACTIVE);
});

it('requires the matching subdomain before deleting a tenant', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $this->deleteJson("/api/admin/tenants/{$tenant->id}", ['confirm_subdomain' => 'wrong'])
        ->assertStatus(422);

    expect(Tenant::find($tenant->id))->not->toBeNull();
});

it('lets platform staff delete a tenant', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $this->deleteJson("/api/admin/tenants/{$tenant->id}", ['confirm_subdomain' => $tenant->subdomain])
        ->assertOk();

    expect(Tenant::find($tenant->id))->toBeNull();
    expect(Tenant::withTrashed()->find($tenant->id)->status)->toBe('cancelled');
});

it('cancels a live Stripe subscription when platform staff delete a tenant', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $subscription = Subscription::updateOrCreate(['tenant_id' => $tenant->id], [
        'plan_id'                => $tenant->plan_id,
        'stripe_subscription_id' => 'sub_test456',
        'status'                 => Subscription::STATUS_ACTIVE,
        'billing_interval'       => 'monthly',
        'current_period_start'   => now(),
    ]);

    $this->mock(StripeService::class, function ($mock) use ($subscription) {
        $mock->shouldReceive('cancel')
            ->once()
            ->withArgs(fn (Subscription $s, bool $atPeriodEnd) => $s->is($subscription) && $atPeriodEnd === false);
    });

    $this->deleteJson("/api/admin/tenants/{$tenant->id}", ['confirm_subdomain' => $tenant->subdomain])
        ->assertOk();

    expect(Tenant::find($tenant->id))->toBeNull();
});
