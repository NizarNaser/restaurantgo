<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed();
});

it('blocks a tenant user from the company admin API even with matching permissions', function () {
    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($owner, ['*']);

    $this->getJson('/api/admin/tenants')->assertStatus(403);
});

it('blocks a platform user without the required permission', function () {
    $user = User::create([
        'tenant_id' => null, 'name' => 'Support', 'email' => 'support@restaurantgo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $user->assignRole(Role::firstOrCreate(['name' => 'support_agent']));
    Sanctum::actingAs($user, ['*']);

    // support_agent has "manage contact messages" but not "manage tenants".
    $this->getJson('/api/admin/tenants')->assertStatus(403);
    $this->getJson('/api/admin/contact-messages')->assertOk();
});

it('allows a super_admin platform user full access to tenants', function () {
    $user = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($user, ['*']);

    $this->getJson('/api/admin/tenants')->assertOk();
    $this->getJson('/api/admin/metrics')->assertOk()
        ->assertJsonStructure(['tenants_total', 'tenants_active', 'mrr']);
});
