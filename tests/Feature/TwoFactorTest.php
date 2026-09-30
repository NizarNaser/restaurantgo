<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;
use PragmaRX\Google2FA\Google2FA;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->google2fa = app(Google2FA::class);
});

it('enrolls and confirms 2FA, after which plain-password login defers to a verification step', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $enroll = $this->postJson('/api/auth/2fa/enroll')->assertOk();
    $secret = $enroll->json('secret');
    expect($secret)->not->toBeEmpty();
    expect($this->owner->fresh()->two_factor_confirmed_at)->toBeNull();

    $this->postJson('/api/auth/2fa/confirm', ['code' => $this->google2fa->getCurrentOtp($secret)])
        ->assertOk();

    expect($this->owner->fresh()->two_factor_confirmed_at)->not->toBeNull();

    $login = $this->postJson('/api/auth/login', [
        'email' => $this->owner->email, 'password' => 'password',
    ])->assertOk();

    $login->assertJson(['requires_2fa' => true]);
    expect($login->json('two_factor_token'))->not->toBeEmpty();
});

it('completes login when the 2fa code is correct, and rejects a wrong one', function () {
    $secret = $this->google2fa->generateSecretKey();
    $this->owner->update(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()]);

    $login = $this->postJson('/api/auth/login', [
        'email' => $this->owner->email, 'password' => 'password',
    ])->assertOk();
    $token = $login->json('two_factor_token');

    $this->postJson('/api/auth/2fa/verify', ['two_factor_token' => $token, 'code' => '000000'])
        ->assertStatus(422);

    $this->postJson('/api/auth/2fa/verify', [
        'two_factor_token' => $token,
        'code'              => $this->google2fa->getCurrentOtp($secret),
    ])->assertOk()->assertJsonStructure(['token', 'user', 'tenant']);
});

it('requires the current password to disable 2fa', function () {
    $secret = $this->google2fa->generateSecretKey();
    $this->owner->update(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => now()]);
    Sanctum::actingAs($this->owner, ['*']);

    $this->postJson('/api/auth/2fa/disable', ['password' => 'wrong-password'])->assertStatus(422);
    expect($this->owner->fresh()->two_factor_confirmed_at)->not->toBeNull();

    $this->postJson('/api/auth/2fa/disable', ['password' => 'password'])->assertOk();
    expect($this->owner->fresh()->two_factor_confirmed_at)->toBeNull();
});
