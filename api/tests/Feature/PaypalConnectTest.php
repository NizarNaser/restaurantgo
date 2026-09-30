<?php

use App\Models\Tenant;
use App\Models\User;
use App\Services\PayPalService;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('reports a fresh tenant as not connected to paypal', function () {
    $this->getJson('/api/connect/status')
        ->assertOk()
        ->assertJsonPath('paypal.connected', false)
        ->assertJsonPath('paypal.payments_receivable', false);
});

it('requires return_url to start paypal onboarding', function () {
    $this->postJson('/api/connect/paypal/onboard', [])->assertStatus(422);
});

it('returns a paypal onboarding url', function () {
    // Mock set up before the (only) request in this test — a route's
    // resolved controller/service is cached for the lifetime of a single
    // test (bit us once already with Stripe in OrderCheckoutTest.php).
    $this->mock(PayPalService::class)
        ->shouldReceive('createPartnerReferral')
        ->once()
        ->andReturn('https://www.sandbox.paypal.com/bizsignup/partner/entry?token=abc123');

    $this->postJson('/api/connect/paypal/onboard', ['return_url' => 'http://localhost:5173/billing?paypal=success'])
        ->assertOk()
        ->assertJsonPath('url', 'https://www.sandbox.paypal.com/bizsignup/partner/entry?token=abc123');
});

it('requires merchant_id to sync paypal status', function () {
    $this->postJson('/api/connect/paypal/sync', [])->assertStatus(422);
});

it('syncs paypal status and persists the merchant id', function () {
    $this->mock(PayPalService::class)
        ->shouldReceive('fetchMerchantStatus')
        ->once()
        ->with('MERCHANT123')
        ->andReturn(['payments_receivable' => true, 'email_confirmed' => true]);

    $this->postJson('/api/connect/paypal/sync', ['merchant_id' => 'MERCHANT123'])
        ->assertOk()
        ->assertJson(['connected' => true, 'payments_receivable' => true, 'email_confirmed' => true]);

    $this->tenant->refresh();
    expect($this->tenant->paypal_merchant_id)->toBe('MERCHANT123');
    expect($this->tenant->paypal_payments_receivable)->toBeTrue();
    expect($this->tenant->paypal_email_confirmed)->toBeTrue();
});
