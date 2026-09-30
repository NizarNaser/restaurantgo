<?php

use App\Models\AuditLog;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('lists audit logs across tenants for platform staff', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    AuditLog::create(['tenant_id' => $tenant->id, 'action' => 'revenue.created', 'model_type' => 'App\\Models\\Revenue', 'model_id' => 1]);
    AuditLog::create(['tenant_id' => null, 'action' => 'tenant.suspended', 'model_type' => 'App\\Models\\Tenant', 'model_id' => $tenant->id]);

    $response = $this->getJson('/api/admin/audit-logs')->assertOk();

    expect($response->json('total'))->toBeGreaterThanOrEqual(2);
});

it('filters audit logs by tenant and action', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    AuditLog::create(['tenant_id' => $tenant->id, 'action' => 'revenue.created', 'model_type' => 'App\\Models\\Revenue', 'model_id' => 1]);
    AuditLog::create(['tenant_id' => $tenant->id, 'action' => 'expense.created', 'model_type' => 'App\\Models\\Expense', 'model_id' => 1]);

    $response = $this->getJson("/api/admin/audit-logs?tenant_id={$tenant->id}&action=revenue")->assertOk();

    $actions = collect($response->json('data'))->pluck('action')->unique();
    expect($actions->all())->toBe(['revenue.created']);
});

it('rejects audit log access from a non-platform user', function () {
    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($owner, ['*']);

    $this->getJson('/api/admin/audit-logs')->assertForbidden();
});
