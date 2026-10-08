<?php

use App\Models\Department;
use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    $this->hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $this->table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);

    $this->waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Waiter One', 'email' => 'inv-waiter1@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->waiter->assignRole('waiter');

    $this->otherWaiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Waiter Two', 'email' => 'inv-waiter2@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->otherWaiter->assignRole('waiter');

    $this->kitchen = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen']);
    $this->bar = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Bar']);

    $kitchenCategory = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true, 'department_id' => $this->kitchen->id]);
    $barCategory = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true, 'department_id' => $this->bar->id]);

    $this->salad = MenuItem::create(['tenant_id' => $this->tenant->id, 'menu_category_id' => $kitchenCategory->id, 'base_price' => 10, 'is_available' => true]);
    $this->cola = MenuItem::create(['tenant_id' => $this->tenant->id, 'menu_category_id' => $barCategory->id, 'base_price' => 3, 'is_available' => true]);
});

it('splits an invoice by department for kitchen/bar ticket printing', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [
            ['menu_item_id' => $this->salad->id, 'quantity' => 1],
            ['menu_item_id' => $this->cola->id, 'quantity' => 2],
        ],
    ])->assertCreated();

    $response = $this->getJson("/api/orders/{$order['id']}/invoice");

    $response->assertOk();
    $response->assertJsonPath('order.total', '16.000');
    $response->assertJsonPath('table.table_number', 'T1');
    $response->assertJsonPath('opened_by', 'Waiter One');
    $response->assertJsonCount(2, 'departments');

    $departments = collect($response->json('departments'));
    $kitchenTicket = $departments->firstWhere('name', 'Kitchen');
    $barTicket = $departments->firstWhere('name', 'Bar');
    expect($kitchenTicket['items'])->toHaveCount(1);
    expect($barTicket['items'])->toHaveCount(1);
});

it('applies the tenant\'s tax rate to the invoice total and snapshots each item\'s weight', function () {
    $this->tenant->update(['tax_rate' => 10]);
    $this->salad->update(['weight' => '350g']);

    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $response = $this->getJson("/api/orders/{$order['id']}/invoice");

    $response->assertOk();
    $response->assertJsonPath('order.subtotal', '10.000');
    $response->assertJsonPath('order.tax_rate', 10);
    $response->assertJsonPath('order.tax_amount', 1);
    $response->assertJsonPath('order.grand_total', 11);
    $response->assertJsonPath('items.0.weight', '350g');
});

it('defaults to a 0% tax rate when the tenant has none configured', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->getJson("/api/orders/{$order['id']}/invoice")
        ->assertJsonPath('order.tax_amount', 0)
        ->assertJsonPath('order.grand_total', 10);
});

it('applies the service charge to the dine-in invoice when enabled', function () {
    $this->tenant->update(['service_charge_rate' => 10, 'service_charge_apply_to_invoice' => true]);

    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->getJson("/api/orders/{$order['id']}/invoice")
        ->assertJsonPath('order.service_charge_rate', 10)
        ->assertJsonPath('order.service_charge_amount', 1)
        ->assertJsonPath('order.grand_total', 11);
});

it('does not apply the service charge rate to the invoice when the apply toggle is off', function () {
    $this->tenant->update(['service_charge_rate' => 10, 'service_charge_apply_to_invoice' => false]);

    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->getJson("/api/orders/{$order['id']}/invoice")
        ->assertJsonPath('order.service_charge_rate', 0)
        ->assertJsonPath('order.service_charge_amount', 0)
        ->assertJsonPath('order.grand_total', 10);
});

it('combines tax and service charge on the same invoice', function () {
    $this->tenant->update([
        'tax_rate' => 5,
        'service_charge_rate' => 10,
        'service_charge_apply_to_invoice' => true,
    ]);

    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $this->getJson("/api/orders/{$order['id']}/invoice")
        ->assertJsonPath('order.tax_amount', 0.5)
        ->assertJsonPath('order.service_charge_amount', 1)
        ->assertJsonPath('order.grand_total', 11.5);
});

it('releases a table opened by mistake (no items) back to vacant, cancelling the empty order', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $response = $this->postJson("/api/tables/{$this->table->id}/close");

    $response->assertOk();
    $response->assertJsonPath('table.status', 'vacant');
    $response->assertJsonPath('order.status', 'cancelled');
    $response->assertJsonPath('order.payment_status', null);

    expect($this->table->fresh()->isVacant())->toBeTrue();
    expect(Order::find($order['id'])->paid_at)->toBeNull();
});

it('closes a table on payment: marks the order paid and frees the table', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();

    $response = $this->postJson("/api/tables/{$this->table->id}/close");

    $response->assertOk();
    $response->assertJsonPath('table.status', 'vacant');
    $response->assertJsonPath('table.opened_by_user_id', null);
    $response->assertJsonPath('order.status', 'completed');
    $response->assertJsonPath('order.payment_status', 'paid');

    expect($this->table->fresh()->isVacant())->toBeTrue();
    expect(Order::find($order['id'])->paid_at)->not->toBeNull();
});

it('refuses to close an already-vacant table', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/close")->assertStatus(422);
});

it('blocks another waiter from closing a table locked to someone else', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/open")->assertCreated();

    Sanctum::actingAs($this->otherWaiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/close")->assertStatus(403);
});

it('lets the owner close a table locked to another staff member', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/open")->assertCreated();

    Sanctum::actingAs($this->owner, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/close")->assertOk();
});

it('reopening a table after closing starts a fresh empty order', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $firstOrder = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');
    $this->postJson("/api/orders/{$firstOrder['id']}/items", [
        'items' => [['menu_item_id' => $this->salad->id, 'quantity' => 1]],
    ])->assertCreated();
    $this->postJson("/api/tables/{$this->table->id}/close")->assertOk();

    $secondOrder = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    expect($secondOrder['id'])->not->toBe($firstOrder['id']);
    expect($secondOrder['items'])->toBe([]);
});
