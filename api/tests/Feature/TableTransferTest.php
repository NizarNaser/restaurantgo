<?php

use App\Models\AuditLog;
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
    $this->source = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);
    $this->destination = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T2']);

    $this->manager = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Manager One', 'email' => 'manager1@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->manager->assignRole('manager');

    $this->waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Waiter One', 'email' => 'waiter1@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $this->waiter->assignRole('waiter');

    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->menuItem = MenuItem::create([
        'tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id,
        'base_price' => 10, 'is_available' => true,
    ]);
});

function openTableWithOrder(Table $table, User $opener): Order
{
    Sanctum::actingAs($opener, ['*']);
    $order = test()->postJson("/api/tables/{$table->id}/open")->json('order');

    return Order::findOrFail($order['id']);
}

it('moves every open order on a table to the destination, not just the latest', function () {
    $orderOne = openTableWithOrder($this->source, $this->waiter);
    // A second, independent open order on the same table (e.g. a split tab).
    $orderTwo = Order::create([
        'tenant_id' => $this->tenant->id, 'branch_id' => $orderOne->branch_id,
        'table_id' => $this->source->id, 'opened_by_user_id' => $this->waiter->id,
        'type' => Order::TYPE_DINE_IN, 'source' => 'staff', 'status' => 'pending',
        'subtotal' => 0, 'total' => 0, 'currency' => 'USD', 'tracking_code' => 'ABCDEFGH',
    ]);

    Sanctum::actingAs($this->manager, ['*']);
    $response = $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
        'password'    => 'password',
    ]);

    $response->assertOk();
    expect($orderOne->fresh()->table_id)->toBe($this->destination->id);
    expect($orderTwo->fresh()->table_id)->toBe($this->destination->id);
    expect($this->source->fresh()->isVacant())->toBeTrue();
    expect($this->destination->fresh()->isOccupied())->toBeTrue();
});

it('rejects a transfer with a wrong password', function () {
    openTableWithOrder($this->source, $this->waiter);

    Sanctum::actingAs($this->manager, ['*']);
    $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
        'password'    => 'not-the-password',
    ])->assertStatus(401);

    expect($this->source->fresh()->isOccupied())->toBeTrue();
});

it('rejects a transfer with no credential at all', function () {
    openTableWithOrder($this->source, $this->waiter);

    Sanctum::actingAs($this->manager, ['*']);
    $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
    ])->assertStatus(401);
});

it('still enforces the "transfer tables" permission gate before the credential check', function () {
    openTableWithOrder($this->source, $this->waiter);

    // The waiter has no "transfer tables" permission at all — blocked by the
    // route middleware before the controller's own credential check runs.
    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
        'password'    => 'password',
    ])->assertForbidden();
});

it("rejects approval from someone with the permission but without the owner/manager role", function () {
    openTableWithOrder($this->source, $this->waiter);

    // Grant the route-level permission directly (bypassing the owner/manager
    // roles) to isolate the controller's own role check from the middleware.
    $this->waiter->givePermissionTo('transfer tables');

    Sanctum::actingAs($this->waiter, ['*']);
    $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
        'password'    => 'password',
    ])->assertForbidden();

    expect($this->source->fresh()->isOccupied())->toBeTrue();
});

it('records the approver, not just the requester, on the audit log', function () {
    openTableWithOrder($this->source, $this->waiter);

    Sanctum::actingAs($this->manager, ['*']);
    $this->postJson("/api/tables/{$this->source->id}/transfer", [
        'to_table_id' => $this->destination->id,
        'password'    => 'password',
    ])->assertOk();

    $log = AuditLog::where('action', 'table.transferred')->latest()->first();
    expect($log)->not->toBeNull();
    expect($log->user_id)->toBe($this->manager->id);
});
