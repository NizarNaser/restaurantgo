<?php

use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\MenuItem;
use App\Models\Shift;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    $this->hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);
    $this->menuItem = MenuItem::create(['tenant_id' => $this->tenant->id, 'menu_category_id' => $category->id, 'base_price' => 10, 'is_available' => true]);
});

function closeTableWithSale(Table $table, User $owner, $menuItem): int
{
    Sanctum::actingAs($owner, ['*']);
    $order = test()->postJson("/api/tables/{$table->id}/open")->json('order');
    test()->postJson("/api/orders/{$order['id']}/items", [
        'items' => [['menu_item_id' => $menuItem->id, 'quantity' => 1]],
    ])->assertCreated();
    test()->postJson("/api/tables/{$table->id}/close")->assertOk();

    return $order['id'];
}

it('filters the invoices list to just the orders completed during one shift', function () {
    $tableOne = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);
    $tableTwo = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T2']);
    $tableThree = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T3']);

    Sanctum::actingAs($this->owner, ['*']);
    $shiftOne = $this->postJson('/api/shifts/open')->json();
    $orderOne = closeTableWithSale($tableOne, $this->owner, $this->menuItem);

    Sanctum::actingAs($this->owner, ['*']);
    $this->postJson("/api/shifts/{$shiftOne['id']}/close")->assertOk();
    $shiftTwo = $this->postJson('/api/shifts/open')->json();
    $orderTwo = closeTableWithSale($tableTwo, $this->owner, $this->menuItem);
    $orderThree = closeTableWithSale($tableThree, $this->owner, $this->menuItem);

    Sanctum::actingAs($this->owner, ['*']);

    $shiftOneOrders = $this->getJson("/api/orders?status=completed&shift_id={$shiftOne['id']}")->json('data');
    expect(collect($shiftOneOrders)->pluck('id')->all())->toBe([$orderOne]);

    $shiftTwoOrders = $this->getJson("/api/orders?status=completed&shift_id={$shiftTwo['id']}")->json('data');
    expect(collect($shiftTwoOrders)->pluck('id')->sort()->values()->all())->toBe(collect([$orderTwo, $orderThree])->sort()->values()->all());

    $allOrders = $this->getJson('/api/orders?status=completed')->json('data');
    expect(collect($allOrders)->pluck('id')->all())->toContain($orderOne, $orderTwo, $orderThree);
});
