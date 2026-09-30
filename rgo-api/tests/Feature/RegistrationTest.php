<?php

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\PlansSeeder;
use Database\Seeders\RolesPermissionsSeeder;

beforeEach(function () {
    $this->seed(PlansSeeder::class);
    $this->seed(RolesPermissionsSeeder::class);
});

it('registers a new tenant and owner, and returns a usable auth token', function () {
    $response = $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'test-bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
    ]);

    $response->assertCreated();
    $response->assertJsonStructure(['token', 'user' => ['id', 'name', 'email'], 'tenant' => ['id', 'name', 'subdomain', 'slug']]);

    $user = User::where('email', 'jane@example.com')->firstOrFail();
    expect($user->hasRole('owner'))->toBeTrue();

    $tenant = Tenant::where('subdomain', 'test-bistro')->firstOrFail();
    expect($tenant->id)->toBe($user->tenant_id);
    expect($tenant->onTrial())->toBeTrue();

    // The returned token should actually authenticate subsequent requests.
    $token = $response->json('token');
    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('email', 'jane@example.com');
});

it('registers a tenant on the plan chosen at signup', function () {
    $plan = Plan::where('slug', 'pro')->firstOrFail();

    $response = $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'test-bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
        'plan_id' => $plan->id,
    ]);

    $response->assertCreated();

    $tenant = Tenant::where('subdomain', 'test-bistro')->firstOrFail();
    expect($tenant->plan_id)->toBe($plan->id);
    expect($tenant->onTrial())->toBeTrue();
});

it('activates a free plan chosen at signup immediately, without a trial', function () {
    $plan = Plan::where('slug', 'free')->firstOrFail();

    $response = $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'test-bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
        'plan_id' => $plan->id,
    ]);

    $response->assertCreated();

    $tenant = Tenant::where('subdomain', 'test-bistro')->firstOrFail();
    expect($tenant->plan_id)->toBe($plan->id);
    expect($tenant->trial_ends_at)->toBeNull();
    expect($tenant->onTrial())->toBeFalse();
    expect($tenant->subscription?->status)->toBe(Subscription::STATUS_ACTIVE);
});

it('rejects registration with an unknown plan_id', function () {
    $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'test-bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
        'plan_id' => 999999,
    ])->assertStatus(422);
});

it('rejects registration with a reserved subdomain', function () {
    $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'admin',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
    ])->assertStatus(422)->assertJsonValidationErrors('subdomain');
});

it('normalizes the subdomain to lowercase before validating and storing it', function () {
    $response = $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'Test-Bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
        'supported_locales' => ['en'],
    ]);

    $response->assertCreated();
    expect(Tenant::where('subdomain', 'test-bistro')->exists())->toBeTrue();
});

it('rejects registration with a duplicate subdomain', function () {
    Tenant::create([
        'name' => 'Existing', 'slug' => 'existing', 'subdomain' => 'test-bistro',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);

    $this->postJson('/api/auth/register', [
        'restaurant_name' => 'Test Bistro',
        'subdomain' => 'test-bistro',
        'name' => 'Jane Owner',
        'email' => 'jane@example.com',
        'password' => 'Passw0rd123',
        'password_confirmation' => 'Passw0rd123',
    ])->assertStatus(422);
});
