<?php

use App\Models\Order;
use App\Models\Tenant;

const WEBHOOK_TEST_SECRET = 'whsec_test_secret_for_order_payment_webhook';

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    config(['services.stripe.webhook_secret' => WEBHOOK_TEST_SECRET]);

    $this->order = Order::create([
        'tenant_id' => $this->tenant->id, 'type' => 'delivery', 'status' => 'pending',
        'payment_status' => Order::PAYMENT_STATUS_PENDING,
        'subtotal' => 20, 'total' => 20, 'currency' => 'USD', 'tracking_code' => 'WHK001',
    ]);
});

function orderPaymentWebhookPayload(int $orderId, string $eventId = 'evt_test_order_payment'): array
{
    return [
        'id'   => $eventId,
        'type' => 'checkout.session.completed',
        'data' => [
            'object' => [
                'id'              => 'cs_test_123',
                'payment_intent'  => 'pi_test_123',
                'client_reference_id' => (string) $orderId,
                'metadata'        => ['kind' => 'order_payment', 'order_id' => (string) $orderId],
            ],
        ],
    ];
}

/**
 * Posts a webhook payload with a real, correctly-signed Stripe-Signature
 * header — the webhook endpoint now fails closed on an unverified payload
 * (see WebhookController), so these tests must exercise the real signature
 * path rather than relying on the old unsigned-fallback behavior.
 */
function postSignedStripeWebhook(array $payload)
{
    $body = json_encode($payload);
    $timestamp = time();
    $signedPayload = "{$timestamp}.{$body}";
    $signature = hash_hmac('sha256', $signedPayload, WEBHOOK_TEST_SECRET);

    return test()->call(
        'POST',
        '/api/webhooks/stripe',
        server: ['HTTP_Stripe-Signature' => "t={$timestamp},v1={$signature}", 'CONTENT_TYPE' => 'application/json'],
        content: $body,
    );
}

it('marks an order as paid from a checkout.session.completed webhook', function () {
    postSignedStripeWebhook(orderPaymentWebhookPayload($this->order->id))->assertOk();

    $this->order->refresh();
    expect($this->order->payment_status)->toBe(Order::PAYMENT_STATUS_PAID);
    expect($this->order->stripe_payment_intent_id)->toBe('pi_test_123');
    expect($this->order->paid_at)->not->toBeNull();
});

it('is idempotent when the same webhook is redelivered', function () {
    postSignedStripeWebhook(orderPaymentWebhookPayload($this->order->id))->assertOk();
    $this->order->refresh();
    $firstPaidAt = $this->order->paid_at;

    postSignedStripeWebhook(orderPaymentWebhookPayload($this->order->id, 'evt_test_redelivered'))->assertOk();

    $this->order->refresh();
    expect($this->order->paid_at->eq($firstPaidAt))->toBeTrue();
});

it('ignores an order payment webhook for an unknown order id', function () {
    postSignedStripeWebhook(orderPaymentWebhookPayload(999999))->assertOk();
});

it('still processes a subscription-shaped session with no metadata.kind, unaffected by the new branch', function () {
    $payload = [
        'id'   => 'evt_test_subscription_shaped',
        'type' => 'checkout.session.completed',
        'data' => [
            'object' => [
                'id'           => 'cs_test_sub',
                'subscription' => null,
                'client_reference_id' => (string) $this->tenant->id,
                'metadata'     => ['tenant_id' => (string) $this->tenant->id],
            ],
        ],
    ];

    // No subscription on the session, so onCheckoutCompleted's existing
    // early-return kicks in — this just proves the new order-payment branch
    // doesn't intercept or crash on it.
    postSignedStripeWebhook($payload)->assertOk();
});

it('rejects a webhook whose signature does not match', function () {
    $body = json_encode(orderPaymentWebhookPayload($this->order->id));

    test()->call(
        'POST',
        '/api/webhooks/stripe',
        server: ['HTTP_Stripe-Signature' => 't=' . time() . ',v1=not_the_real_signature', 'CONTENT_TYPE' => 'application/json'],
        content: $body,
    )->assertStatus(400);

    expect($this->order->fresh()->payment_status)->toBe(Order::PAYMENT_STATUS_PENDING);
});

it('rejects any webhook outright when no secret is configured, instead of parsing it unverified', function () {
    config(['services.stripe.webhook_secret' => null]);

    $this->postJson('/api/webhooks/stripe', orderPaymentWebhookPayload($this->order->id))
        ->assertStatus(500);

    expect($this->order->fresh()->payment_status)->toBe(Order::PAYMENT_STATUS_PENDING);
});
