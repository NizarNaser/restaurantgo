<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('requires the current password to change email', function () {
    $this->putJson('/api/auth/profile/email', [
        'email' => 'new-owner@demo.com', 'password' => 'wrong-password',
    ])->assertStatus(422);

    expect($this->owner->fresh()->email)->toBe('owner@demo.com');
});

it('changes the email with the correct password', function () {
    $this->putJson('/api/auth/profile/email', [
        'email' => 'new-owner@demo.com', 'password' => 'password',
    ])->assertOk()->assertJsonPath('user.email', 'new-owner@demo.com');

    expect($this->owner->fresh()->email)->toBe('new-owner@demo.com');
});

it('rejects an email already used by another user', function () {
    User::create([
        'tenant_id' => $this->owner->tenant_id, 'name' => 'Other', 'email' => 'taken@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);

    $this->putJson('/api/auth/profile/email', [
        'email' => 'taken@demo.com', 'password' => 'password',
    ])->assertStatus(422);
});

it('requires the current password to change password', function () {
    $this->putJson('/api/auth/profile/password', [
        'current_password' => 'wrong-password',
        'password' => 'new-password-123', 'password_confirmation' => 'new-password-123',
    ])->assertStatus(422);

    expect(Hash::check('password', $this->owner->fresh()->password))->toBeTrue();
});

it('rejects a new password without matching confirmation', function () {
    $this->putJson('/api/auth/profile/password', [
        'current_password' => 'password',
        'password' => 'new-password-123', 'password_confirmation' => 'something-else',
    ])->assertStatus(422);
});

it('changes the password with the correct current password', function () {
    $this->putJson('/api/auth/profile/password', [
        'current_password' => 'password',
        'password' => 'new-password-123', 'password_confirmation' => 'new-password-123',
    ])->assertOk();

    expect(Hash::check('new-password-123', $this->owner->fresh()->password))->toBeTrue();
});
