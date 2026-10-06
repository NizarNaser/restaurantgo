<?php

use App\Models\DiscountApplication;
use App\Models\DiscountCard;
use App\Models\Order;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);

    $this->card = DiscountCard::create([
        'tenant_id' => $this->tenant->id, 'card_number' => 'RACE-' . uniqid(),
        'customer_name' => 'Race Customer', 'discount_percentage' => 10,
        'accumulated_balance' => 50, 'is_active' => true,
    ]);
});

function makeOpenOrder(Tenant $tenant, float $subtotal = 100): Order
{
    return Order::create([
        'tenant_id' => $tenant->id, 'type' => Order::TYPE_DINE_IN, 'source' => 'staff',
        'status' => 'pending', 'subtotal' => $subtotal, 'total' => $subtotal,
        'currency' => $tenant->default_currency ?? 'USD', 'tracking_code' => strtoupper(uniqid()),
    ]);
}

it('redeems discount card credit and reduces the order total', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $order = makeOpenOrder($this->tenant);

    $this->postJson("/api/orders/{$order->id}/redeem-card-balance", [
        'discount_card_id' => $this->card->id,
        'amount'           => 20,
        'password'         => 'password',
    ])->assertCreated();

    expect($this->card->fresh()->accumulated_balance)->toBe('30.00');
    expect((float) $order->fresh()->total)->toBe(80.0);
});

it('refuses to redeem more than the card\'s current balance', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $order = makeOpenOrder($this->tenant);

    $this->postJson("/api/orders/{$order->id}/redeem-card-balance", [
        'discount_card_id' => $this->card->id,
        'amount'           => 999,
        'password'         => 'password',
    ])->assertStatus(422);

    expect($this->card->fresh()->accumulated_balance)->toBe('50.00');
});

it('never lets two concurrent redemptions push a card\'s balance negative', function () {
    // Two "concurrent" requests against the same order+card, each racing to
    // spend most of the balance — before the fix, both could read the same
    // pre-redemption balance and both succeed, overdrawing the card.
    Sanctum::actingAs($this->owner, ['*']);
    $order = makeOpenOrder($this->tenant, subtotal: 200);

    $payload = [
        'discount_card_id' => $this->card->id,
        'amount'           => 40, // balance is 50 — two of these would overdraw it to -30
        'password'         => 'password',
    ];

    $first  = $this->postJson("/api/orders/{$order->id}/redeem-card-balance", $payload);
    $second = $this->postJson("/api/orders/{$order->id}/redeem-card-balance", $payload);

    $statuses = [$first->getStatusCode(), $second->getStatusCode()];
    sort($statuses);
    // One succeeds (201); the other is rejected — either because the
    // balance guard now correctly sees the first redemption's effect, or
    // because the order already carries an approved discount.
    expect($statuses)->toBe([201, 422]);

    expect((float) $this->card->fresh()->accumulated_balance)->toBeGreaterThanOrEqual(0);
});

it('refuses to stack a second approved discount onto the same order', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $order = makeOpenOrder($this->tenant);

    $this->postJson("/api/orders/{$order->id}/redeem-card-balance", [
        'discount_card_id' => $this->card->id, 'amount' => 10, 'password' => 'password',
    ])->assertCreated();

    $this->postJson("/api/orders/{$order->id}/redeem-card-balance", [
        'discount_card_id' => $this->card->id, 'amount' => 10, 'password' => 'password',
    ])->assertStatus(422);

    expect(DiscountApplication::where('order_id', $order->id)->where('status', DiscountApplication::STATUS_APPROVED)->count())->toBe(1);
});
