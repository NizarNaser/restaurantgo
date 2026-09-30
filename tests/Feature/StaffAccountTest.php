<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('lets an owner create a staff account with a role', function () {
    $response = $this->postJson('/api/staff-accounts', [
        'name' => 'Nadia Waiter',
        'email' => 'nadia@demo.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
        'role' => 'waiter',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('role', 'waiter');
    $response->assertJsonPath('email', 'nadia@demo.com');

    $created = User::where('email', 'nadia@demo.com')->firstOrFail();
    expect($created->tenant_id)->toBe($this->owner->tenant_id);
    expect($created->hasRole('waiter'))->toBeTrue();
});

it('rejects assigning the owner role through this endpoint', function () {
    $this->postJson('/api/staff-accounts', [
        'name' => 'Sneaky', 'email' => 'sneaky@demo.com',
        'password' => 'Password123', 'password_confirmation' => 'Password123',
        'role' => 'owner',
    ])->assertStatus(422);
});

it('blocks a tenant user without manage users permission from creating staff accounts', function () {
    $waiter = User::create([
        'tenant_id' => $this->owner->tenant_id, 'name' => 'No Permission', 'email' => 'noperm-staff@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $waiter->assignRole('waiter');
    Sanctum::actingAs($waiter, ['*']);

    $this->getJson('/api/staff-accounts')->assertForbidden();
    $this->postJson('/api/staff-accounts', [
        'name' => 'X', 'email' => 'x@demo.com', 'password' => 'Password123',
        'password_confirmation' => 'Password123', 'role' => 'waiter',
    ])->assertForbidden();
});

it('lets an owner update a staff account\'s role', function () {
    $bartender = User::create([
        'tenant_id' => $this->owner->tenant_id, 'name' => 'Sam', 'email' => 'sam@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $bartender->assignRole('bartender');

    $this->putJson("/api/staff-accounts/{$bartender->id}", ['role' => 'manager'])
        ->assertOk()
        ->assertJsonPath('role', 'manager');

    expect($bartender->fresh()->hasRole('bartender'))->toBeFalse();
    expect($bartender->fresh()->hasRole('manager'))->toBeTrue();
});

it('lets an owner reset a staff account\'s password', function () {
    $bartender = User::create([
        'tenant_id' => $this->owner->tenant_id, 'name' => 'Sam', 'email' => 'sam-pw@demo.com',
        'password' => bcrypt('OldPassword1'), 'is_active' => true,
    ]);
    $bartender->assignRole('bartender');

    $this->putJson("/api/staff-accounts/{$bartender->id}", [
        'password' => 'NewPassword2', 'password_confirmation' => 'NewPassword2',
    ])->assertOk();

    expect(\Illuminate\Support\Facades\Hash::check('NewPassword2', $bartender->fresh()->password))->toBeTrue();
});

it("won't let the owner's own account be managed through this endpoint", function () {
    $this->putJson("/api/staff-accounts/{$this->owner->id}", ['role' => 'manager'])
        ->assertForbidden();
});

it('rejects updating a staff account belonging to another tenant', function () {
    $otherTenant = \App\Models\Tenant::create([
        'name' => 'Other Staff Tenant', 'slug' => 'other-staff-tenant', 'subdomain' => 'other-staff-tenant',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    $otherUser = User::create([
        'tenant_id' => $otherTenant->id, 'name' => 'Other', 'email' => 'other-staff@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $otherUser->assignRole('waiter');

    $this->putJson("/api/staff-accounts/{$otherUser->id}", ['role' => 'manager'])->assertForbidden();
});
