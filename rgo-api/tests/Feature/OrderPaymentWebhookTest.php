<?php

use App\Models\Order;
use App\Models\Tenant;

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

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

it('marks an order as paid from a checkout.session.completed webhook', function () {
    // STRIPE_WEBHOOK_SECRET is empty in phpunit.xml, so the controller falls
    // back to unverified event parsing — no signature header needed, same as
    // every other unsigned-webhook local-dev path in this app.
    $this->postJson('/api/webhooks/stripe', orderPaymentWebhookPayload($this->order->id))->assertOk();

    $this->order->refresh();
    expect($this->order->payment_status)->toBe(Order::PAYMENT_STATUS_PAID);
    expect($this->order->stripe_payment_intent_id)->toBe('pi_test_123');
    expect($this->order->paid_at)->not->toBeNull();
});

it('is idempotent when the same webhook is redelivered', function () {
    $this->postJson('/api/webhooks/stripe', orderPaymentWebhookPayload($this->order->id))->assertOk();
    $this->order->refresh();
    $firstPaidAt = $this->order->paid_at;

    $this->postJson('/api/webhooks/stripe', orderPaymentWebhookPayload($this->order->id, 'evt_test_redelivered'))->assertOk();

    $this->order->refresh();
    expect($this->order->paid_at->eq($firstPaidAt))->toBeTrue();
});

it('ignores an order payment webhook for an unknown order id', function () {
    $this->postJson('/api/webhooks/stripe', orderPaymentWebhookPayload(999999))->assertOk();
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
    $this->postJson('/api/webhooks/stripe', $payload)->assertOk();
});
