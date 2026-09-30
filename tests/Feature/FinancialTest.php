<?php

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\Revenue;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('creates a revenue and records an audit log entry', function () {
    $response = $this->postJson('/api/financial/revenues', [
        'amount'      => 500,
        'currency'    => 'USD',
        'description' => 'Catering event',
        'date'        => now()->toDateString(),
    ]);

    $response->assertCreated();
    expect(Revenue::count())->toBe(1);
    expect(Revenue::first()->created_by)->toBe($this->owner->id);
    expect(AuditLog::where('action', 'revenue.created')->count())->toBe(1);
});

it('creates an expense and records an audit log entry', function () {
    $response = $this->postJson('/api/financial/expenses', [
        'amount'      => 120,
        'currency'    => 'USD',
        'description' => 'Ingredients',
        'date'        => now()->toDateString(),
        'vendor'      => 'Sysco',
    ]);

    $response->assertCreated();
    expect(Expense::count())->toBe(1);
    expect(AuditLog::where('action', 'expense.created')->count())->toBe(1);
});

it('deletes a revenue and records an audit log entry', function () {
    $revenue = Revenue::create([
        'tenant_id'   => $this->owner->tenant_id,
        'amount'      => 300,
        'currency'    => 'USD',
        'description' => 'Old sale',
        'date'        => now()->toDateString(),
        'created_by'  => $this->owner->id,
    ]);

    $this->deleteJson("/api/financial/revenues/{$revenue->id}")->assertOk();

    expect(Revenue::count())->toBe(0);
    expect(AuditLog::where('action', 'revenue.deleted')->count())->toBe(1);
});

it('rejects a revenue belonging to another tenant', function () {
    $otherTenant = \App\Models\Tenant::create([
        'name'      => 'Other Restaurant',
        'slug'      => 'other-restaurant',
        'subdomain' => 'other',
        'plan_id'   => \App\Models\Plan::first()->id,
        'status'    => 'active',
    ]);
    $revenue = Revenue::create([
        'tenant_id'   => $otherTenant->id,
        'amount'      => 300,
        'currency'    => 'USD',
        'description' => 'Not yours',
        'date'        => now()->toDateString(),
        'created_by'  => $this->owner->id,
    ]);

    // The tenant global scope makes another tenant's revenue invisible to route-model
    // binding itself, so the request 404s before the controller's own guard ever runs.
    $this->deleteJson("/api/financial/revenues/{$revenue->id}")->assertNotFound();
});

it('summarizes revenue vs. expense totals per month for the chart', function () {
    Revenue::create(['tenant_id' => $this->owner->tenant_id, 'amount' => 1000, 'currency' => 'USD', 'description' => 'Sales', 'date' => now(), 'created_by' => $this->owner->id]);
    Expense::create(['tenant_id' => $this->owner->tenant_id, 'amount' => 400, 'currency' => 'USD', 'description' => 'Supplies', 'date' => now(), 'created_by' => $this->owner->id]);

    $response = $this->getJson('/api/financial/chart-data?months=3')->assertOk();

    $currentMonth = collect($response->json())->firstWhere('month', now()->format('Y-m'));
    expect($currentMonth['revenue'])->toEqual(1000.0);
    expect($currentMonth['expense'])->toEqual(400.0);
    expect($currentMonth['profit'])->toEqual(600.0);
});

it('builds a profit and loss report with totals', function () {
    Revenue::create(['tenant_id' => $this->owner->tenant_id, 'amount' => 1000, 'currency' => 'USD', 'description' => 'Sales', 'date' => now(), 'created_by' => $this->owner->id]);
    Expense::create(['tenant_id' => $this->owner->tenant_id, 'amount' => 400, 'currency' => 'USD', 'description' => 'Supplies', 'date' => now(), 'created_by' => $this->owner->id]);

    $response = $this->getJson('/api/financial/reports/profit-loss')->assertOk();

    expect($response->json('totals.revenue'))->toEqual(1000.0);
    expect($response->json('totals.expense'))->toEqual(400.0);
    expect($response->json('totals.profit'))->toEqual(600.0);
});

it('exports revenues as a downloadable spreadsheet', function () {
    Revenue::create(['tenant_id' => $this->owner->tenant_id, 'amount' => 1000, 'currency' => 'USD', 'description' => 'Sales', 'date' => now(), 'created_by' => $this->owner->id]);

    $response = $this->get('/api/financial/export/revenues');

    $response->assertOk();
    $response->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('returns the latest USD exchange rates', function () {
    \App\Models\ExchangeRate::create([
        'base_currency'   => 'USD',
        'target_currency' => 'SAR',
        'rate'            => 3.75,
        'date'            => now()->toDateString(),
        'source'          => 'api',
    ]);

    $response = $this->getJson('/api/financial/exchange-rates')->assertOk();

    expect($response->json('rates.SAR.rate'))->toBe(3.75);
});
