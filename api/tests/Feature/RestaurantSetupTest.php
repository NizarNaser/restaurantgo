<?php

use App\Models\Hall;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

it('creates a hall', function () {
    $this->postJson('/api/halls', ['name' => 'Main Hall'])
        ->assertCreated()
        ->assertJsonPath('name', 'Main Hall')
        ->assertJsonPath('is_active', true);
});

it('creates a table inside a hall, positioned on the floor', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);

    $response = $this->postJson('/api/tables', [
        'hall_id' => $hall->id, 'table_number' => 'T1', 'pos_x' => 120, 'pos_y' => 80, 'capacity' => 4,
    ]);

    $response->assertCreated();
    $response->assertJsonPath('table_number', 'T1');
    $response->assertJsonPath('pos_x', 120);
    $response->assertJsonPath('status', 'vacant');
});

it('rejects creating a table in a hall belonging to another tenant', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other Setup Tenant', 'slug' => 'other-setup-tenant', 'subdomain' => 'other-setup-tenant',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    $otherHall = Hall::create(['tenant_id' => $otherTenant->id, 'name' => 'Their Hall']);

    $this->postJson('/api/tables', ['hall_id' => $otherHall->id, 'table_number' => 'T1'])
        ->assertNotFound();
});

it('updates a table\'s position via drag-and-drop save', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T1']);

    $this->putJson("/api/tables/{$table->id}", ['pos_x' => 300, 'pos_y' => 150])
        ->assertOk()
        ->assertJsonPath('pos_x', 300)
        ->assertJsonPath('pos_y', 150);
});

it('refuses to delete an occupied table', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create([
        'tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T1',
        'status' => Table::STATUS_OCCUPIED, 'opened_by_user_id' => $this->owner->id, 'opened_at' => now(),
    ]);

    $this->deleteJson("/api/tables/{$table->id}")->assertStatus(422);
});

it('creates a department and assigns it to a menu category', function () {
    $department = $this->postJson('/api/departments', ['name' => 'Kitchen'])->assertCreated()->json();

    $category = \App\Models\MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true]);

    $this->putJson("/api/menu/categories/{$category->id}", ['department_id' => $department['id']])
        ->assertOk()
        ->assertJsonPath('data.department_id', $department['id']);
});

it('creates a printer with wifi connection details', function () {
    $department = \App\Models\Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen']);

    $response = $this->postJson('/api/printers', [
        'name' => 'Kitchen Printer', 'department_id' => $department->id,
        'connection_type' => 'wifi', 'address' => '192.168.1.50', 'is_primary' => false,
    ]);

    $response->assertCreated();
    $response->assertJsonPath('address', '192.168.1.50');
    $response->assertJsonPath('connection_type', 'wifi');
});

it('blocks a waiter (no manage halls permission) from the restaurant-setup endpoints', function () {
    $waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'W', 'email' => 'w-setup@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $waiter->assignRole('waiter');
    Sanctum::actingAs($waiter, ['*']);

    $this->getJson('/api/halls')->assertForbidden();
    $this->postJson('/api/halls', ['name' => 'X'])->assertForbidden();
    $this->getJson('/api/departments')->assertForbidden();
    $this->getJson('/api/printers')->assertForbidden();
});
