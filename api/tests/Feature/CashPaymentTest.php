<?php

use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StripeService;
use Laravel\Sanctum\Sanctum;
use Stripe\Checkout\Session as CheckoutSession;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    $this->tenant->update(['stripe_connect_charges_enabled' => true, 'stripe_connect_account_id' => 'acct_test']);

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->item = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 10.00, 'is_available' => true,
    ]);

    $this->checkoutUrl = "/api/v1/public/{$this->tenant->slug}/orders/checkout";
});

function cashOrderPayload(MenuItem $item, array $overrides = []): array
{
    return array_merge([
        'items' => [['menu_item_id' => $item->id, 'quantity' => 2]],
        'customer_name' => 'Nadia',
        'customer_phone' => '+96170000000',
        'type' => 'delivery',
        'payment_method' => 'cash',
        'delivery_address_line' => '123 Main St',
        'delivery_city' => 'Beirut',
    ], $overrides);
}

it('rejects a cash order when the restaurant has not enabled cash payments', function () {
    $ordersBefore = Order::count();

    $this->postJson($this->checkoutUrl, cashOrderPayload($this->item))->assertStatus(422);

    expect(Order::count())->toBe($ordersBefore);
});

it('rejects a cash order when online ordering itself is not set up, even with cash enabled', function () {
    $this->tenant->update(['cash_payments_enabled' => true, 'stripe_connect_charges_enabled' => false]);

    $this->postJson($this->checkoutUrl, cashOrderPayload($this->item))->assertStatus(422);
});

it('creates a cash-on-delivery order without any online checkout', function () {
    $this->tenant->update(['cash_payments_enabled' => true]);
    $this->mock(StripeService::class)->shouldNotReceive('createOrderCheckoutSession');

    $response = $this->postJson($this->checkoutUrl, cashOrderPayload($this->item));

    $response->assertCreated();
    $response->assertJsonPath('checkout_url', null);
    $response->assertJsonPath('payment_method', 'cash');
    $response->assertJsonPath('total', '20.000');

    $order = Order::findOrFail($response->json('order_id'));
    expect($order->type)->toBe(Order::TYPE_DELIVERY);
    expect($order->payment_method)->toBe(Order::PAYMENT_METHOD_CASH);
    expect($order->payment_status)->toBeNull();
    expect($order->delivery_address_line)->toBe('123 Main St');
});

it('creates a cash pickup order without a delivery address', function () {
    $this->tenant->update(['cash_payments_enabled' => true]);

    $response = $this->postJson($this->checkoutUrl, cashOrderPayload($this->item, [
        'type' => 'pickup',
        'delivery_address_line' => null,
        'delivery_city' => null,
    ]));

    $response->assertCreated();
    $order = Order::findOrFail($response->json('order_id'));
    expect($order->type)->toBe(Order::TYPE_PICKUP);
    expect($order->delivery_address_line)->toBeNull();
});

it('still requires an address for cash delivery', function () {
    $this->tenant->update(['cash_payments_enabled' => true]);

    $this->postJson($this->checkoutUrl, cashOrderPayload($this->item, ['delivery_address_line' => null]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('delivery_address_line');
});

it('creates an online pickup order through Stripe checkout', function () {
    $this->mock(StripeService::class)
        ->shouldReceive('createOrderCheckoutSession')
        ->once()
        ->andReturn(CheckoutSession::constructFrom(['id' => 'cs_test_1', 'url' => 'https://checkout.stripe.com/pay/cs_test_1']));

    $response = $this->postJson($this->checkoutUrl, [
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        'customer_name' => 'Nadia',
        'customer_phone' => '+96170000000',
        'type' => 'pickup',
        'success_url' => 'http://localhost:5173/p/demo/order',
        'cancel_url' => 'http://localhost:5173/p/demo/cart',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('checkout_url', 'https://checkout.stripe.com/pay/cs_test_1');
    $order = Order::findOrFail($response->json('order_id'));
    expect($order->payment_method)->toBe(Order::PAYMENT_METHOD_ONLINE);
    expect($order->payment_status)->toBe(Order::PAYMENT_STATUS_PENDING);
});

it('shows a cash order to staff straight away and marks it paid on completion', function () {
    $this->tenant->update(['cash_payments_enabled' => true]);
    $orderId = $this->postJson($this->checkoutUrl, cashOrderPayload($this->item))->json('order_id');

    Sanctum::actingAs($this->owner, ['*']);
    $listed = collect($this->getJson('/api/orders')->assertOk()->json('data'))->pluck('id');
    expect($listed)->toContain($orderId);

    $this->putJson("/api/orders/{$orderId}", ['status' => 'preparing'])->assertOk();
    expect(Order::find($orderId)->payment_status)->toBeNull();

    $this->putJson("/api/orders/{$orderId}", ['status' => 'completed'])->assertOk();
    $order = Order::find($orderId);
    expect($order->payment_status)->toBe(Order::PAYMENT_STATUS_PAID);
    expect($order->paid_at)->not->toBeNull();
});

it('advertises the cash option on the public restaurant info only when it is usable', function () {
    $this->getJson("/api/v1/public/{$this->tenant->slug}/info")
        ->assertJsonPath('data.payment_options', ['online' => true, 'cash' => false]);

    $this->tenant->update(['cash_payments_enabled' => true]);

    $this->getJson("/api/v1/public/{$this->tenant->slug}/info")
        ->assertJsonPath('data.payment_options', ['online' => true, 'cash' => true]);
});

it('lets the owner turn cash payments on from settings', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $settings = $this->getJson('/api/settings')->assertOk()->json();
    expect($settings['cash_payments_enabled'])->toBeFalse();

    $this->putJson('/api/settings', array_merge(
        collect($settings)->only(['name', 'timezone', 'default_currency', 'default_locale', 'supported_locales'])->all(),
        ['cash_payments_enabled' => true],
    ))->assertOk();

    expect($this->tenant->fresh()->cash_payments_enabled)->toBeTrue();
});

it('records cash or card when a table bill is closed', function (string $method) {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T1']);

    Sanctum::actingAs($this->owner, ['*']);
    $order = $this->postJson("/api/tables/{$table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->postJson("/api/tables/{$table->id}/close", ['payment_method' => $method])
        ->assertOk()
        ->assertJsonPath('order.payment_method', $method);

    $this->getJson("/api/orders/{$order['id']}/invoice")->assertJsonPath('order.payment_method', $method);
})->with(['cash', 'card']);

it('rejects an unknown payment method when closing a table', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T1']);

    Sanctum::actingAs($this->owner, ['*']);
    $order = $this->postJson("/api/tables/{$table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->postJson("/api/tables/{$table->id}/close", ['payment_method' => 'bitcoin'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('payment_method');
});
