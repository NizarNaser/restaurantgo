<?php

use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

const CONNECT_WEBHOOK_TEST_SECRET = 'whsec_test_secret_for_connect_webhook';

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
    config(['services.stripe.webhook_secret' => CONNECT_WEBHOOK_TEST_SECRET]);
});

/** See OrderPaymentWebhookTest.php's identical helper — the webhook endpoint
 * fails closed on an unverified payload, so these need a real signature. */
function postSignedConnectWebhook(array $payload)
{
    $body = json_encode($payload);
    $timestamp = time();
    $signature = hash_hmac('sha256', "{$timestamp}.{$body}", CONNECT_WEBHOOK_TEST_SECRET);

    return test()->call(
        'POST',
        '/api/webhooks/stripe',
        server: ['HTTP_Stripe-Signature' => "t={$timestamp},v1={$signature}", 'CONTENT_TYPE' => 'application/json'],
        content: $body,
    );
}

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

    postSignedConnectWebhook($payload)->assertOk();

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

    postSignedConnectWebhook($payload)->assertOk();
});
