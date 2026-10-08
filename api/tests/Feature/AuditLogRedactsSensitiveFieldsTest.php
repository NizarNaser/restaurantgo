<?php

use App\Models\Employee;
use App\Models\Plan;
use App\Models\Tenant;
use App\Services\AuditService;

function makeEmployeeForAuditTest(): Employee
{
    $tenant = Tenant::create([
        'name' => 'Audit Test Tenant', 'slug' => 'audit-test-' . uniqid(),
        'subdomain' => 'audit-test-' . uniqid(),
        'plan_id' => Plan::firstOrCreate(['slug' => 'test-plan'], ['name' => 'Test Plan'])->id,
        'status' => 'active', 'default_locale' => 'en',
    ]);

    return Employee::create([
        'tenant_id' => $tenant->id, 'name' => 'Jane Doe', 'position' => 'Waiter',
        'base_salary' => 2000, 'hire_date' => now()->toDateString(),
        'bank_account' => 'SECRET-IBAN-DE00123456789',
    ]);
}

it('never writes a hidden field like bank_account into old_values/new_values', function () {
    $employee = makeEmployeeForAuditTest();
    // Re-fetched to mirror route-model binding in the real controller
    // (EmployeeController::update()) — a freshly-created in-memory instance
    // stays `wasRecentlyCreated` for the rest of the request, which would
    // make AuditService treat this update as a creation and skip new_values
    // entirely; that's not what's under test here.
    $employee = Employee::find($employee->id);
    $employee->update(['position' => 'Head Waiter', 'bank_account' => 'SECRET-IBAN-DE99999999999']);

    app(AuditService::class)->log('employee.updated', $employee);

    $log = $employee->tenant->auditLogs()->latest('id')->first();

    expect($log->new_values)->toHaveKey('position');
    expect($log->new_values)->not->toHaveKey('bank_account');
});

it('redacts an explicitly-passed old/new payload the same way', function () {
    $employee = makeEmployeeForAuditTest();

    app(AuditService::class)->log('employee.updated', $employee, [
        'old' => ['position' => 'Waiter', 'bank_account' => 'SECRET-OLD'],
        'new' => ['position' => 'Head Waiter', 'bank_account' => 'SECRET-NEW'],
    ]);

    $log = $employee->tenant->auditLogs()->latest('id')->first();

    expect($log->old_values)->not->toHaveKey('bank_account');
    expect($log->new_values)->not->toHaveKey('bank_account');
    expect($log->new_values['position'])->toBe('Head Waiter');
});
