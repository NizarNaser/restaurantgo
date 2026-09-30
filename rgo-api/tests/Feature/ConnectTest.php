<?php

use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('reports a fresh tenant as not connected', function () {
    $this->getJson('/api/connect/status')
        ->assertOk()
        ->assertJson(['connected' => false, 'charges_enabled' => false, 'details_submitted' => false]);
});

it('requires return_url and refresh_url to start onboarding', function () {
    $this->postJson('/api/connect/onboard', [])->assertStatus(422);
});

it('syncs charges_enabled and details_submitted from an account.updated webhook', function () {
    $this->tenant->update(['stripe_connect_account_id' => 'acct_test123']);

    $payload = [
        'id'   => 'evt_test_connect',
        'type' => 'account.updated',
        'data' => [
            'object' => [
                'id'                 => 'acct_test123',
                'charges_enabled'    => true,
                'details_submitted'  => true,
            ],
        ],
    ];

    // STRIPE_WEBHOOK_SECRET is empty locally, so the controller falls back to
    // unverified event parsing — no signature header needed, same as every
    // other unsigned-webhook local-dev path in this app.
    $this->postJson('/api/webhooks/stripe', $payload)->assertOk();

    $this->tenant->refresh();
    expect($this->tenant->stripe_connect_charges_enabled)->toBeTrue();
    expect($this->tenant->stripe_connect_details_submitted)->toBeTrue();
});

it('ignores an account.updated webhook for an unknown account id', function () {
    $payload = [
        'id'   => 'evt_test_connect_unknown',
        'type' => 'account.updated',
        'data' => [
            'object' => [
                'id'                => 'acct_does_not_exist',
                'charges_enabled'   => true,
                'details_submitted' => true,
            ],
        ],
    ];

    $this->postJson('/api/webhooks/stripe', $payload)->assertOk();
});
