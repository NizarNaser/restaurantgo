<?php

use App\Models\Branch;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Plan;
use App\Models\QrCode;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->item = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 10.00, 'is_available' => true,
    ]);
    $this->qrCode = QrCode::create([
        'tenant_id' => $this->tenant->id, 'type' => QrCode::TYPE_TABLE,
        'table_number' => '7', 'target_url' => 'https://x.test',
    ]);
});

it('places a dine-in order and computes the total server-side, ignoring any client-sent price', function () {
    $response = $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [
            ['menu_item_id' => $this->item->id, 'quantity' => 3, 'price' => 0.01],
        ],
        'customer_name' => 'Nadia', 'customer_phone' => '+96170000000',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('total', '30.00');

    $order = Order::findOrFail($response->json('order_id'));
    expect($order->table_number)->toBe('7');
    expect($order->status)->toBe('pending');
    expect($order->items()->sum('quantity'))->toBe(3);
});

it('rejects an order referencing an unavailable menu item', function () {
    $this->item->update(['is_available' => false]);

    $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        'customer_name' => 'Nadia', 'customer_phone' => '+96170000000',
    ])->assertStatus(422);
});

it('rejects placing an order without the customer\'s name and phone', function () {
    $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ])->assertStatus(422);
});

it('lets a logged-in staff member place a dine-in order without a customer name or phone', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $response = $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ]);

    $response->assertCreated();

    $order = Order::findOrFail($response->json('order_id'));
    expect($order->source)->toBe('staff');
    expect($order->opened_by_user_id)->toBe($this->owner->id);
    expect($order->customer_name)->toBe($this->owner->name);
    expect($order->customer_phone)->toBeNull();
});

it('still requires a customer name and phone for staff of another tenant', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other Staff', 'slug' => 'other-staff', 'subdomain' => 'other-staff',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);
    $otherStaff = User::create([
        'tenant_id' => $otherTenant->id, 'name' => 'Other Staff', 'email' => 'other-staff@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    Sanctum::actingAs($otherStaff, ['*']);

    $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ])->assertStatus(422);
});

it('rejects an order against a QR code belonging to another tenant', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other', 'slug' => 'other-order', 'subdomain' => 'other-order',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);
    $otherQr = QrCode::create([
        'tenant_id' => $otherTenant->id, 'type' => QrCode::TYPE_TABLE,
        'table_number' => '1', 'target_url' => 'https://x.test',
    ]);

    $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $otherQr->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        'customer_name' => 'Nadia', 'customer_phone' => '+96170000000',
    ])->assertStatus(404);
});

it('lets a customer poll their own order status with the correct tracking code, but not without it', function () {
    $create = $this->postJson('/api/v1/public/demo-restaurant/orders', [
        'qr_code_id' => $this->qrCode->id,
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
        'customer_name' => 'Nadia', 'customer_phone' => '+96170000000',
    ])->assertCreated();

    $orderId = $create->json('order_id');
    $code = $create->json('tracking_code');

    $this->getJson("/api/v1/public/demo-restaurant/orders/{$orderId}?code={$code}")
        ->assertOk()
        ->assertJsonPath('status', 'pending');

    $this->getJson("/api/v1/public/demo-restaurant/orders/{$orderId}?code=wrong")
        ->assertNotFound();
});

it('lets the tenant owner see and progress incoming orders', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $order = Order::create([
        'tenant_id' => $this->tenant->id, 'status' => 'pending',
        'subtotal' => 10, 'total' => 10, 'currency' => 'USD', 'tracking_code' => 'ABC123',
    ]);

    $this->getJson('/api/orders')->assertOk()->assertJsonFragment(['id' => $order->id]);

    $this->putJson("/api/orders/{$order->id}", ['status' => 'preparing'])
        ->assertOk()
        ->assertJsonPath('status', 'preparing');
});

it('lets staff enter an order on a customer\'s behalf without a QR code', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $branch = Branch::create(['tenant_id' => $this->tenant->id, 'name' => 'Test Branch', 'is_active' => true]);

    $response = $this->postJson('/api/orders', [
        'branch_id' => $branch->id,
        'table_number' => '12',
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 2]],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('source', 'staff');
    $response->assertJsonPath('table_number', '12');
    $response->assertJsonPath('total', '20.00');
});

it('blocks a tenant user without the "manage orders" permission from touching orders', function () {
    $plainUser = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'No Permissions', 'email' => 'noperm@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    Sanctum::actingAs($plainUser, ['*']);

    $this->getJson('/api/orders')->assertForbidden();
    $this->postJson('/api/orders', [
        'table_number' => '1',
        'items' => [['menu_item_id' => $this->item->id, 'quantity' => 1]],
    ])->assertForbidden();
});

it('rejects updating an order belonging to another tenant', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $otherTenant = Tenant::create([
        'name' => 'Other 2', 'slug' => 'other-order-2', 'subdomain' => 'other-order-2',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);
    $order = Order::create([
        'tenant_id' => $otherTenant->id, 'status' => 'pending',
        'subtotal' => 10, 'total' => 10, 'currency' => 'USD', 'tracking_code' => 'XYZ999',
    ]);

    $this->putJson("/api/orders/{$order->id}", ['status' => 'preparing'])->assertNotFound();
});

it('hides delivery orders awaiting payment from the kitchen queue by default, but shows them with include_unpaid', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $unpaid = Order::create([
        'tenant_id' => $this->tenant->id, 'type' => 'delivery', 'status' => 'pending',
        'payment_status' => Order::PAYMENT_STATUS_PENDING,
        'subtotal' => 10, 'total' => 10, 'currency' => 'USD', 'tracking_code' => 'PAY001',
    ]);

    $response = $this->getJson('/api/orders');
    $response->assertOk();
    expect(collect($response->json('data'))->pluck('id'))->not->toContain($unpaid->id);

    $this->getJson('/api/orders?include_unpaid=1')
        ->assertOk()
        ->assertJsonFragment(['id' => $unpaid->id]);
});

it('blocks staff from progressing a delivery order that has not been paid yet', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $unpaid = Order::create([
        'tenant_id' => $this->tenant->id, 'type' => 'delivery', 'status' => 'pending',
        'payment_status' => Order::PAYMENT_STATUS_PENDING,
        'subtotal' => 10, 'total' => 10, 'currency' => 'USD', 'tracking_code' => 'PAY002',
    ]);

    $this->putJson("/api/orders/{$unpaid->id}", ['status' => 'preparing'])->assertStatus(422);
});
