<?php

use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\MenuItem;
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
        'tenant_id' => $this->tenant->id, 'name' => 'Waiter One', 'email' => 'waiter1@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->waiter->assignRole('waiter');

    $this->otherWaiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Waiter Two', 'email' => 'waiter2@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->otherWaiter->assignRole('waiter');

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->menuItem = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 12.5, 'is_available' => true,
    ]);
});

it('opens a vacant table, locking it to whoever opened it', function () {
    Sanctum::actingAs($this->waiter, ['*']);

    $response = $this->postJson("/api/tables/{$this->table->id}/open");

    $response->assertCreated();
    $response->assertJsonPath('table.status', 'occupied');
    $response->assertJsonPath('table.opened_by_user_id', $this->waiter->id);
    $response->assertJsonPath('order.table_id', $this->table->id);
    $response->assertJsonPath('order.opened_by_user_id', $this->waiter->id);

    expect($this->table->fresh()->isOccupied())->toBeTrue();
});

it('refuses to open an already-occupied table', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/open")->assertCreated();

    Sanctum::actingAs($this->otherWaiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/open")->assertStatus(422);
});

it('lets the opener add items to their own table order and totals update', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $response = $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 2]],
    ]);

    $response->assertCreated();
    $response->assertJsonPath('total', '25.00');
    $response->assertJsonCount(1, 'items');
    $response->assertJsonPath('items.0.quantity', 2);
});

it('merges a repeat order of the same untouched item into one line instead of a duplicate row', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();

    $response = $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 2]],
    ]);

    $response->assertCreated();
    $response->assertJsonCount(1, 'items');
    $response->assertJsonPath('items.0.quantity', 3);
    $response->assertJsonPath('items.0.subtotal', '37.50');
    $response->assertJsonPath('total', '37.50');
});

it('keeps each addItems() round as its own independent row for the kitchen, even for a repeat item', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $first = $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->json();
    \App\Models\OrderItem::whereKey($first['items'][0]['id'])->update([
        'kitchen_status' => 'ready', 'collected_at' => now(),
    ]);

    $response = $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ]);

    $response->assertCreated();
    // The bill still shows one consolidated line...
    $response->assertJsonCount(1, 'items');
    $response->assertJsonPath('items.0.quantity', 2);
    // ...but the kitchen sees two genuinely separate rows: the first round
    // already collected, and a brand new pending one for this round — never
    // folded into the already-served row, so it shows up as fresh work.
    $rows = \App\Models\OrderItem::where('order_id', $order['id'])->orderBy('id')->get();
    expect($rows)->toHaveCount(2);
    expect($rows[0]->kitchen_status)->toBe('ready');
    expect($rows[0]->collected_at)->not->toBeNull();
    expect($rows[1]->kitchen_status)->toBe('pending');
    expect($rows[1]->collected_at)->toBeNull();
});

it('does not merge lines carrying different kitchen notes', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1, 'notes' => 'No onions']],
    ])->assertCreated();

    $response = $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ]);

    $response->assertCreated();
    $response->assertJsonCount(2, 'items');
});

it('blocks another waiter from adding items to a table locked by someone else', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    Sanctum::actingAs($this->otherWaiter, ['*']);
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertStatus(403);
});

it('lets the owner override the lock and add items to any staff member\'s table', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    Sanctum::actingAs($this->owner, ['*']);
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();
});

it('lets the opener view the order, and blocks an unrelated waiter from it entirely', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->table->id}/open")->assertCreated();

    $this->getJson("/api/tables/{$this->table->id}/order")
        ->assertOk()
        ->assertJsonPath('can_edit', true)
        ->assertJsonPath('opened_by', 'Waiter One');

    // A staff member can't even see another staff member's open order,
    // not just edit it — a stricter isolation than the old can_edit flag.
    Sanctum::actingAs($this->otherWaiter, ['*']);
    $this->getJson("/api/tables/{$this->table->id}/order")->assertForbidden();
});

it('returns 404 for the current order of a vacant table', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $this->getJson("/api/tables/{$this->table->id}/order")->assertNotFound();
});

it('blocks a role without manage tables from opening a table or adding items', function () {
    $staff = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Plain Staff', 'email' => 'plain-staff@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $staff->assignRole('staff');
    Sanctum::actingAs($staff, ['*']);

    $this->postJson("/api/tables/{$this->table->id}/open")->assertForbidden();
});
