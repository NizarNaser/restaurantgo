<?php

use App\Models\Staff;
use App\Models\StaffPayrollRun;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('creates a staff member without a login by default', function () {
    $response = $this->postJson('/api/admin/staff', [
        'name' => 'Rana Accountant', 'position' => 'Accountant', 'base_salary' => 2000,
        'hire_date' => now()->toDateString(), 'status' => 'active',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('has_login', false);
    expect(Staff::where('name', 'Rana Accountant')->exists())->toBeTrue();
});

it('creates a staff member with a gated login when requested', function () {
    $response = $this->postJson('/api/admin/staff', [
        'name' => 'Karim Finance', 'position' => 'Finance Manager', 'base_salary' => 3000,
        'hire_date' => now()->toDateString(), 'status' => 'active',
        'create_login' => true, 'login_email' => 'karim@restaurantgo.com',
        'login_password' => 'Passw0rd123', 'role' => 'finance_manager',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('has_login', true);

    $user = User::where('email', 'karim@restaurantgo.com')->firstOrFail();
    expect($user->tenant_id)->toBeNull();
    expect($user->hasRole('finance_manager'))->toBeTrue();
});

it('tracks staff attendance and computes hours worked', function () {
    $staff = Staff::create(['name' => 'Nour', 'position' => 'Support', 'base_salary' => 1500, 'hire_date' => now()->subMonth()]);

    $this->postJson('/api/admin/staff-attendance/checkin', ['staff_id' => $staff->id])->assertCreated();
    $this->postJson('/api/admin/staff-attendance/checkin', ['staff_id' => $staff->id])->assertStatus(422);

    $response = $this->postJson('/api/admin/staff-attendance/checkout', ['staff_id' => $staff->id]);
    $response->assertOk();
    expect($response->json('hours_worked'))->toBeGreaterThanOrEqual(0);
});

it('generates, approves and pays a staff payroll run', function () {
    Staff::create(['name' => 'Nour', 'position' => 'Support', 'base_salary' => 1760, 'hire_date' => now()->subMonths(2), 'status' => 'active']);

    $from = now()->subMonth()->startOfMonth()->toDateString();
    $to = now()->subMonth()->endOfMonth()->toDateString();

    $store = $this->postJson('/api/admin/staff-payroll/run', ['period_start' => $from, 'period_end' => $to]);
    $store->assertCreated();
    $runId = $store->json('id');

    $this->postJson("/api/admin/staff-payroll/{$runId}/approve")->assertOk()->assertJsonPath('status', 'approved');
    $this->postJson("/api/admin/staff-payroll/{$runId}/pay")->assertOk()->assertJsonPath('status', 'paid');

    expect(StaffPayrollRun::find($runId)->status)->toBe('paid');
});
