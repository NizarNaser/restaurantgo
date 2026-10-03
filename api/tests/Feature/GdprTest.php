<?php

use App\Jobs\GenerateGdprExport;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use App\Notifications\GdprExportReady;
use App\Services\StripeService;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
});

it('queues the export instead of building it in the request', function () {
    Queue::fake();
    Sanctum::actingAs($this->owner, ['*']);

    $response = $this->getJson('/api/gdpr/export');

    $response->assertStatus(202);
    Queue::assertPushed(GenerateGdprExport::class);
    expect(AuditLog::where('action', 'tenant.gdpr_export_requested')->count())->toBe(1);
});

it('writes the export file and emails a download link when the job runs', function () {
    Storage::fake('local');
    Notification::fake();

    (new GenerateGdprExport($this->owner->tenant_id, $this->owner->id))->handle();

    $files = Storage::disk('local')->files("gdpr-exports/{$this->owner->tenant_id}");
    expect($files)->toHaveCount(1);

    $contents = json_decode(Storage::disk('local')->get($files[0]), true);
    expect($contents['tenant']['id'])->toBe($this->owner->tenant_id);

    Notification::assertSentTo($this->owner, GdprExportReady::class);
});

it('serves the export only through a validly signed link', function () {
    Storage::fake('local');
    $tenant   = Tenant::find($this->owner->tenant_id);
    $filename = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.json';
    Storage::disk('local')->put("gdpr-exports/{$tenant->id}/{$filename}", json_encode(['ok' => true]));

    $signedUrl = URL::temporarySignedRoute('gdpr.export.download', now()->addHour(), [
        'tenant' => $tenant->id, 'filename' => $filename,
    ]);

    $this->get($signedUrl)->assertOk();

    // Tampering with the signature is rejected.
    $this->get($signedUrl.'&tampered=1')->assertForbidden();

    // An unsigned request to the same path is rejected outright.
    $this->get("/api/gdpr/export/{$tenant->id}/{$filename}")->assertForbidden();
});

it('rejects an erasure request when the confirmation slug does not match', function () {
    Sanctum::actingAs($this->owner, ['*']);

    $this->postJson('/api/gdpr/erasure-request', ['confirm_slug' => 'wrong-slug'])
        ->assertStatus(422);

    expect(Tenant::find($this->owner->tenant_id))->not->toBeNull();
});

it('rejects an erasure request from a non-owner', function () {
    $staff = User::create([
        'tenant_id' => $this->owner->tenant_id,
        'name'      => 'Staff Member',
        'email'     => 'staff@demo.com',
        'password'  => bcrypt('password'),
        'is_active' => true,
    ]);
    $staff->assignRole(Role::firstOrCreate(['name' => 'staff']));
    Sanctum::actingAs($staff, ['*']);

    $tenant = Tenant::find($this->owner->tenant_id);

    $this->postJson('/api/gdpr/erasure-request', ['confirm_slug' => $tenant->slug])
        ->assertForbidden();
});

it('anonymizes personal data and deactivates the tenant on a confirmed erasure request', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $tenant = Tenant::find($this->owner->tenant_id);

    $employee = Employee::create([
        'tenant_id'    => $tenant->id,
        'name'         => 'Real Name',
        'phone'        => '+1234567890',
        'email'        => 'employee@demo.com',
        'position'     => 'Chef',
        'base_salary'  => 3000,
        'currency'     => 'USD',
        'hire_date'    => now()->subYear(),
        'bank_account' => 'IBAN123456',
    ]);

    $response = $this->postJson('/api/gdpr/erasure-request', ['confirm_slug' => $tenant->slug]);

    $response->assertOk();

    $this->owner->refresh();
    expect($this->owner->name)->toBe('Deleted User');
    expect($this->owner->email)->toContain('@'.$tenant->slug.'.invalid');
    expect($this->owner->is_active)->toBeFalse();

    $employee->refresh();
    expect($employee->name)->toBe('Deleted Employee');
    expect($employee->bank_account)->toBeNull();

    expect(Tenant::withTrashed()->find($tenant->id)->status)->toBe('cancelled');
    expect(Tenant::find($tenant->id))->toBeNull(); // soft-deleted, excluded from default queries
    expect(AuditLog::where('action', 'tenant.gdpr_erasure_requested')->count())->toBe(1);
});

it('cancels a live Stripe subscription before erasing the tenant', function () {
    Sanctum::actingAs($this->owner, ['*']);
    $tenant = Tenant::find($this->owner->tenant_id);

    $subscription = Subscription::create([
        'tenant_id'              => $tenant->id,
        'plan_id'                => $tenant->plan_id,
        'stripe_subscription_id' => 'sub_test123',
        'status'                 => Subscription::STATUS_ACTIVE,
        'billing_interval'       => 'monthly',
        'current_period_start'   => now(),
    ]);

    $this->mock(StripeService::class, function ($mock) use ($subscription) {
        $mock->shouldReceive('cancel')
            ->once()
            ->withArgs(fn (Subscription $s, bool $atPeriodEnd) => $s->is($subscription) && $atPeriodEnd === false);
    });

    $this->postJson('/api/gdpr/erasure-request', ['confirm_slug' => $tenant->slug])->assertOk();
});
