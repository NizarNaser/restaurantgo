<?php

use App\Models\MenuCategory;
use App\Models\Plan;
use App\Models\Tenant;

beforeEach(function () {
    $this->seed();

    $this->tenantA = Tenant::create([
        'name' => 'Tenant A', 'slug' => 'tenant-a', 'subdomain' => 'tenant-a',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);
    $this->tenantB = Tenant::create([
        'name' => 'Tenant B', 'slug' => 'tenant-b', 'subdomain' => 'tenant-b',
        'plan_id' => Plan::first()->id, 'status' => 'active',
    ]);

    $this->categoryA = MenuCategory::create(['tenant_id' => $this->tenantA->id, 'sort_order' => 0]);
    $this->categoryB = MenuCategory::create(['tenant_id' => $this->tenantB->id, 'sort_order' => 0]);
});

it('hides other tenants\' rows from a plain query once a tenant is bound, with no explicit where() needed', function () {
    app()->instance('tenant', $this->tenantA);

    // No `where('tenant_id', ...)` anywhere here — this is exactly the query a
    // controller would write if it forgot to scope it by hand.
    expect(MenuCategory::pluck('id'))->toEqual(collect([$this->categoryA->id]));
});

it('stays unscoped when no tenant is bound, for platform/console contexts', function () {
    expect(app()->bound('tenant'))->toBeFalse();
    expect(MenuCategory::whereIn('id', [$this->categoryA->id, $this->categoryB->id])->count())->toBe(2);
});

it('auto-fills tenant_id on create from the bound tenant', function () {
    app()->instance('tenant', $this->tenantB);

    $category = MenuCategory::create(['sort_order' => 1]);

    expect($category->tenant_id)->toBe($this->tenantB->id);
});
