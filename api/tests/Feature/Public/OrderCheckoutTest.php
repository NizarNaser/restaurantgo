<?php

use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Tenant;
use App\Services\StripeService;
use Stripe\Checkout\Session as CheckoutSession;

beforeEach(function () {
    $this->seed();
    $this->tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->item = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 10.00, 'is_available' => true,
    ]);
});

function validCheckoutPayload(MenuItem $item, array $overrides = []): array
{
    return array_merge([
        'items' => [['menu_item_id' => $item->id, 'quantity' => 2]],
        'customer_name' => 'Nadia',
        'customer_phone' => '+96170000000',
        'delivery_address_line' => '123 Main St',
        'delivery_city' => 'Beirut',
        'success_url' => 'http://localhost:5173/p/demo-restaurant/order',
        'cancel_url' => 'http://localhost:5173/p/demo-restaurant/cart',
    ], $overrides);
}

it('rejects checkout when the tenant has no active Connect account', function () {
    $ordersBefore = Order::count();

    $this->postJson('/api/v1/public/demo-restaurant/orders/checkout', validCheckoutPayload($this->item))
        ->assertStatus(422);

    expect(Order::count())->toBe($ordersBefore);
});

it('rejects checkout without a delivery address', function () {
    $this->tenant->update(['stripe_connect_charges_enabled' => true, 'stripe_connect_account_id' => 'acct_test']);

    $this->postJson('/api/v1/public/demo-restaurant/orders/checkout', validCheckoutPayload($this->item, [
        'delivery_address_line' => null,
        'delivery_city' => null,
    ]))->assertStatus(422);
});

it('creates a pending, unpaid delivery order and returns a checkout url, ignoring any client-sent price', function () {
    $this->tenant->update(['stripe_connect_charges_enabled' => true, 'stripe_connect_account_id' => 'acct_test']);

    // Set up before the (only) request in this test — the resolved
    // controller/service binding for a route is cached for the lifetime of
    // a single test, so the mock must be in place before the first hit.
    $this->mock(StripeService::class)
        ->shouldReceive('createOrderCheckoutSession')
        ->once()
        ->andReturn(CheckoutSession::constructFrom(['id' => 'cs_test_123', 'url' => 'https://checkout.stripe.com/pay/cs_test_123']));

    $response = $this->postJson('/api/v1/public/demo-restaurant/orders/checkout', validCheckoutPayload($this->item, [
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 3, 'price' => 0.01]],
    ]));

    $response->assertCreated();
    $response->assertJsonPath('total', '30.00');
    $response->assertJsonPath('checkout_url', 'https://checkout.stripe.com/pay/cs_test_123');

    $order = Order::findOrFail($response->json('order_id'));
    expect($order->type)->toBe('delivery');
    expect($order->payment_status)->toBe(Order::PAYMENT_STATUS_PENDING);
    expect($order->delivery_address_line)->toBe('123 Main St');
    expect($order->delivery_city)->toBe('Beirut');
    expect($order->qr_code_id)->toBeNull();
});

it('rejects checkout referencing an unavailable menu item', function () {
    $this->tenant->update(['stripe_connect_charges_enabled' => true, 'stripe_connect_account_id' => 'acct_test']);
    $this->item->update(['is_available' => false]);

    $this->postJson('/api/v1/public/demo-restaurant/orders/checkout', validCheckoutPayload($this->item))
        ->assertStatus(422);
});
