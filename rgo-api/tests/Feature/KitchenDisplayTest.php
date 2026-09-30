<?php

use App\Models\Department;
use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\OrderItem;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    $this->hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $this->department = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen', 'sort_order' => 0]);
    $this->category = MenuCategory::create([
        'tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true, 'department_id' => $this->department->id,
    ]);
    $this->menuItem = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $this->category->id,
        'base_price' => 10, 'is_available' => true,
    ]);
    $this->table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);

    $this->waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'KDS Waiter', 'email' => 'kds-waiter@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->waiter->assignRole('waiter');
});

it('shows a fresh, independent ticket for a re-ordered item after the earlier round was collected', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();

    $firstBatchId = $this->getJson("/api/kds/departments/{$this->department->id}/tickets")->json('0.batch_id');

    // Kitchen picks up and serves the first round.
    $this->postJson("/api/kds/departments/{$this->department->id}/orders/{$order['id']}/start?batch_id={$firstBatchId}")->assertOk();
    $this->postJson("/api/kds/departments/{$this->department->id}/orders/{$order['id']}/finish?batch_id={$firstBatchId}")->assertOk();
    $this->postJson("/api/kds/departments/{$this->department->id}/orders/{$order['id']}/collect?batch_id={$firstBatchId}")->assertOk();

    // The ticket is gone from the screen once collected.
    $this->getJson("/api/kds/departments/{$this->department->id}/tickets")
        ->assertOk()
        ->assertJsonCount(0);

    // The table orders the same dish again.
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();

    // It must reappear as its own fresh, untouched ticket — not silently
    // stay hidden because it shares an order/table with already-collected
    // work, and not show a stale "ready"/"collected" status, and not get
    // merged into the earlier round's (already-collected) ticket.
    $response = $this->getJson("/api/kds/departments/{$this->department->id}/tickets");
    $response->assertOk();
    $response->assertJsonCount(1);
    $response->assertJsonPath('0.order_id', $order['id']);
    $response->assertJsonPath('0.status', 'new');
    $response->assertJsonCount(1, '0.items');
    $response->assertJsonPath('0.items.0.kitchen_status', 'pending');
    $response->assertJsonPath('0.items.0.quantity', 1);
    expect($response->json('0.batch_id'))->not->toBe($firstBatchId);

    // And the underlying row for the first, already-served round is
    // untouched (still collected) — the two rounds never got conflated.
    expect(OrderItem::where('order_id', $order['id'])->where('kitchen_status', 'ready')->whereNotNull('collected_at')->count())->toBe(1);
});

it('lets the kitchen act on one round without touching a different, concurrently open round', function () {
    Sanctum::actingAs($this->waiter, ['*']);
    $order = $this->postJson("/api/tables/{$this->table->id}/open")->json('order');

    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();
    $this->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $this->menuItem->id, 'quantity' => 1]],
    ])->assertCreated();

    $tickets = $this->getJson("/api/kds/departments/{$this->department->id}/tickets")->json();
    expect($tickets)->toHaveCount(2);
    [$firstBatchId, $secondBatchId] = [$tickets[0]['batch_id'], $tickets[1]['batch_id']];
    expect($firstBatchId)->not->toBe($secondBatchId);

    $this->postJson("/api/kds/departments/{$this->department->id}/orders/{$order['id']}/start?batch_id={$firstBatchId}")->assertOk();

    $tickets = collect($this->getJson("/api/kds/departments/{$this->department->id}/tickets")->json());
    expect($tickets->firstWhere('batch_id', $firstBatchId)['status'])->toBe('preparing');
    expect($tickets->firstWhere('batch_id', $secondBatchId)['status'])->toBe('new');
});
