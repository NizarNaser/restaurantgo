<?php

use App\Models\Department;
use App\Models\Hall;
use App\Models\Order;
use App\Models\Printer;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    $this->hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
});

it('lets a waiter (manage tables, not manage halls) view the floor', function () {
    Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);

    $waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Floor Waiter', 'email' => 'floor-waiter@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $waiter->assignRole('waiter');
    Sanctum::actingAs($waiter, ['*']);

    $this->getJson('/api/floor/halls')->assertOk()->assertJsonCount(1);
    $this->getJson('/api/floor/tables')->assertOk()->assertJsonPath('0.table_number', 'T1');
});

it('shows a vacant table with no current order', function () {
    Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);
    Sanctum::actingAs($this->owner, ['*']);

    $this->getJson('/api/floor/tables')
        ->assertOk()
        ->assertJsonPath('0.status', 'vacant')
        ->assertJsonPath('0.current_order', null);
});

it('shows an occupied table\'s running order total and who opened it', function () {
    $table = Table::create([
        'tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1',
        'status' => Table::STATUS_OCCUPIED, 'opened_by_user_id' => $this->owner->id, 'opened_at' => now(),
    ]);
    Order::create([
        'tenant_id' => $this->tenant->id, 'table_id' => $table->id, 'opened_by_user_id' => $this->owner->id,
        'type' => Order::TYPE_DINE_IN, 'source' => 'staff', 'status' => 'preparing',
        'subtotal' => 45.5, 'total' => 45.5, 'currency' => 'USD', 'tracking_code' => 'FLOOR-TEST-1',
    ]);
    Sanctum::actingAs($this->owner, ['*']);

    $this->getJson('/api/floor/tables')
        ->assertOk()
        ->assertJsonPath('0.status', 'occupied')
        ->assertJsonPath('0.opened_by', 'Demo Owner')
        ->assertJsonPath('0.current_order.total', '45.50');
});

it('ignores a completed order when computing the running total', function () {
    $table = Table::create([
        'tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1',
        'status' => Table::STATUS_OCCUPIED, 'opened_by_user_id' => $this->owner->id, 'opened_at' => now(),
    ]);
    Order::create([
        'tenant_id' => $this->tenant->id, 'table_id' => $table->id, 'opened_by_user_id' => $this->owner->id,
        'type' => Order::TYPE_DINE_IN, 'source' => 'staff', 'status' => 'completed',
        'subtotal' => 45.5, 'total' => 45.5, 'currency' => 'USD', 'tracking_code' => 'FLOOR-TEST-2',
    ]);
    Sanctum::actingAs($this->owner, ['*']);

    $this->getJson('/api/floor/tables')->assertOk()->assertJsonPath('0.current_order', null);
});

it('filters the floor view by hall', function () {
    $otherHall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Terrace']);
    Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $this->hall->id, 'table_number' => 'T1']);
    Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $otherHall->id, 'table_number' => 'T2']);
    Sanctum::actingAs($this->owner, ['*']);

    $this->getJson("/api/floor/tables?hall_id={$this->hall->id}")
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.table_number', 'T1');
});

it('lets a waiter look up printers (for auto-print routing) without manage halls', function () {
    $department = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen']);
    Printer::create([
        'tenant_id' => $this->tenant->id, 'department_id' => $department->id,
        'name' => 'Kitchen Printer', 'connection_type' => 'wifi', 'address' => '192.168.1.50',
    ]);

    $waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Printer Waiter', 'email' => 'printer-waiter@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $waiter->assignRole('waiter');
    Sanctum::actingAs($waiter, ['*']);

    $this->getJson('/api/floor/printers')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.address', '192.168.1.50');
});

it('lets a waiter list departments (the POS "sections" bar) without manage halls', function () {
    Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen', 'sort_order' => 0]);
    Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Bar', 'sort_order' => 1]);

    $waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'Sections Waiter', 'email' => 'sections-waiter@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $waiter->assignRole('waiter');
    Sanctum::actingAs($waiter, ['*']);

    $this->getJson('/api/floor/departments')
        ->assertOk()
        ->assertJsonCount(2)
        ->assertJsonPath('0.name', 'Kitchen')
        ->assertJsonPath('1.name', 'Bar');
});

it('blocks a role with neither manage tables nor manage halls from the floor view', function () {
    $noRoleUser = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'No Role', 'email' => 'no-role-floor@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    Sanctum::actingAs($noRoleUser, ['*']);

    $this->getJson('/api/floor/halls')->assertForbidden();
    $this->getJson('/api/floor/tables')->assertForbidden();
    $this->getJson('/api/floor/departments')->assertForbidden();
});
