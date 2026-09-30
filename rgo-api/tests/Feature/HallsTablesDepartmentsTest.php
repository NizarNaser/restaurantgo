<?php

use App\Models\Department;
use App\Models\Hall;
use App\Models\MenuCategory;
use App\Models\Table;
use App\Models\Tenant;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
});

it('seeds the new halls/tables permissions and waiter/bartender roles', function () {
    foreach (['manage tables', 'manage halls', 'transfer tables'] as $perm) {
        expect(Permission::where('name', $perm)->exists())->toBeTrue();
    }
    foreach (['waiter', 'bartender'] as $role) {
        expect(Role::where('name', $role)->exists())->toBeTrue();
    }

    expect(Role::findByName('waiter')->hasPermissionTo('manage tables'))->toBeTrue();
    expect(Role::findByName('bartender')->hasPermissionTo('manage tables'))->toBeTrue();
    expect(Role::findByName('owner')->hasPermissionTo('manage tables'))->toBeTrue();
    expect(Role::findByName('manager')->hasPermissionTo('manage tables'))->toBeTrue();
});

it('creates a hall with tables scoped to the tenant, and a table starts vacant', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create([
        'tenant_id' => $this->tenant->id, 'hall_id' => $hall->id,
        'table_number' => 'T1', 'pos_x' => 10, 'pos_y' => 20,
    ]);

    expect($table->isVacant())->toBeTrue();
    expect($table->isOccupied())->toBeFalse();
    expect($table->hall->id)->toBe($hall->id);
    expect($hall->tables()->count())->toBe(1);
});

it('locks a table to whoever opened it, but not to other staff', function () {
    $hall = Hall::create(['tenant_id' => $this->tenant->id, 'name' => 'Main Hall']);
    $table = Table::create(['tenant_id' => $this->tenant->id, 'hall_id' => $hall->id, 'table_number' => 'T2']);

    $waiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'W1', 'email' => 'w1@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $otherWaiter = User::create([
        'tenant_id' => $this->tenant->id, 'name' => 'W2', 'email' => 'w2@demo.com',
        'password' => bcrypt('password'), 'is_active' => true,
    ]);

    expect($table->canBeManagedBy($waiter))->toBeTrue(); // vacant — anyone can open it

    $table->update(['status' => Table::STATUS_OCCUPIED, 'opened_by_user_id' => $waiter->id, 'opened_at' => now()]);

    expect($table->fresh()->canBeManagedBy($waiter))->toBeTrue();
    expect($table->fresh()->canBeManagedBy($otherWaiter))->toBeFalse();
});

it('assigns a menu category to a department', function () {
    $department = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Kitchen']);
    $category = MenuCategory::create(['tenant_id' => $this->tenant->id, 'sort_order' => 0, 'is_active' => true, 'department_id' => $department->id]);

    expect($category->department->name)->toBe('Kitchen');
    expect($department->categories()->count())->toBe(1);
});
