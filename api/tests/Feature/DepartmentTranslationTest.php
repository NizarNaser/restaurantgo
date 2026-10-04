<?php

use App\Jobs\TranslateTenantContentJob;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
    $this->owner->tenant->update(['default_locale' => 'en', 'supported_locales' => ['en', 'ar', 'fr']]);
});

it('stores a new department\'s name under the tenant default locale, not the admin\'s browser locale', function () {
    $this->postJson('/api/departments', ['name' => 'Kitchen'])
        ->assertCreated()
        ->assertJsonPath('name', 'Kitchen');

    $department = Department::latest('id')->first();
    expect($department->translations()->where('locale', 'en')->first()->name)->toBe('Kitchen');
});

it('auto-dispatches missing-locale translations when creating a department', function () {
    Queue::fake();

    $this->postJson('/api/departments', ['name' => 'Kitchen'])->assertCreated();

    Queue::assertPushed(TranslateTenantContentJob::class, 2);
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'fr');
});

it('resolves a department\'s listed name to the Accept-Language locale', function () {
    $department = Department::create(['tenant_id' => $this->owner->tenant_id, 'name' => 'Kitchen']);
    $department->translations()->createMany([
        ['locale' => 'en', 'name' => 'Kitchen'],
        ['locale' => 'ar', 'name' => 'المطبخ'],
    ]);

    $this->getJson('/api/departments', ['Accept-Language' => 'ar'])
        ->assertOk()
        ->assertJsonPath('0.name', 'المطبخ');
});

it('falls back to the raw name column for a department with no translation rows at all', function () {
    // Mirrors a department created before this feature existed, or any
    // write path that bypasses DepartmentController (e.g. direct Eloquent
    // creation in a seeder/console command) — it should never show up blank.
    Department::create(['tenant_id' => $this->owner->tenant_id, 'name' => 'Legacy Kitchen']);

    $this->getJson('/api/departments')
        ->assertOk()
        ->assertJsonPath('0.name', 'Legacy Kitchen');
});

it('exposes a department\'s translated name on the public menu, not the admin locale', function () {
    $department = Department::create(['tenant_id' => $this->owner->tenant_id, 'name' => 'Kitchen']);
    $department->translations()->createMany([
        ['locale' => 'en', 'name' => 'Kitchen'],
        ['locale' => 'ar', 'name' => 'المطبخ'],
    ]);

    $tenant = $this->owner->tenant;

    $this->getJson("/api/v1/public/{$tenant->slug}/menu?lang=ar")
        ->assertOk()
        ->assertJsonFragment(['name' => 'المطبخ']);
});
