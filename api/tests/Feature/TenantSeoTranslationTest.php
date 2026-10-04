<?php

use App\Jobs\TranslateTenantContentJob;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use App\Services\OpenAiService;
use App\Services\SeoService;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $this->tenant = Tenant::find($this->owner->tenant_id);
    Sanctum::actingAs($this->owner, ['*']);
});

function baseSettingsPayload(Tenant $tenant, array $overrides = []): array
{
    return array_merge([
        'name'              => $tenant->name,
        'timezone'          => $tenant->timezone ?? 'UTC',
        'default_currency'  => $tenant->default_currency ?? 'USD',
        'default_locale'    => 'en',
        'supported_locales' => ['en', 'ar'],
    ], $overrides);
}

it('auto-dispatches a translation job for a supported locale missing the tenant\'s own SEO copy', function () {
    Queue::fake();

    $this->putJson('/api/settings', baseSettingsPayload($this->tenant, [
        'seo_title'       => ['en' => 'My Restaurant'],
        'seo_description' => ['en' => 'The best food in town.'],
    ]))->assertOk();

    Queue::assertPushed(TranslateTenantContentJob::class, fn ($job) => $job->targetLocale === 'ar');
});

it('does not dispatch once every supported locale already has both a title and a description', function () {
    Queue::fake();

    $this->putJson('/api/settings', baseSettingsPayload($this->tenant, [
        'seo_title'       => ['en' => 'My Restaurant', 'ar' => 'مطعمي'],
        'seo_description' => ['en' => 'The best food in town.', 'ar' => 'ألذ طعام في المدينة.'],
    ]))->assertOk();

    Queue::assertNotPushed(TranslateTenantContentJob::class);
});

it('fills in the missing locale\'s title and description when the job runs', function () {
    // A bare tenant with no menu/blog content at all — handle() also walks
    // items, categories, departments and articles, and the demo-seeded
    // tenant used above already carries plenty of those, which would call
    // the mocked chat() far more than once and break this test's
    // expectation. Isolating the SEO path needs a tenant with nothing else
    // for those other loops to find.
    $tenant = Tenant::create([
        'name' => 'Bare Tenant', 'slug' => 'bare-tenant', 'subdomain' => 'bare-tenant',
        'plan_id' => Plan::first()->id, 'status' => 'active',
        'default_locale' => 'en', 'supported_locales' => ['en', 'ar'],
        'seo_title' => ['en' => 'My Restaurant'], 'seo_description' => ['en' => 'The best food in town.'],
    ]);

    $this->mock(OpenAiService::class, function ($mock) {
        $mock->shouldReceive('isConfigured')->andReturn(true);
        $mock->shouldReceive('chat')->once()
            ->andReturn(json_encode(['title' => 'مطعمي', 'description' => 'ألذ طعام في المدينة.']));
    });

    (new TranslateTenantContentJob($tenant->id, 'ar'))->handle(app(OpenAiService::class), app(SeoService::class));

    $fresh = $tenant->fresh();
    expect($fresh->seo_title['ar'])->toBe('مطعمي');
    expect($fresh->seo_description['ar'])->toBe('ألذ طعام في المدينة.');
    // The already-present English copy is untouched.
    expect($fresh->seo_title['en'])->toBe('My Restaurant');
});

it('leaves the tenant\'s SEO copy alone once the target locale already has both fields', function () {
    $tenant = Tenant::create([
        'name' => 'Bare Tenant', 'slug' => 'bare-tenant', 'subdomain' => 'bare-tenant',
        'plan_id' => Plan::first()->id, 'status' => 'active',
        'default_locale' => 'en', 'supported_locales' => ['en', 'ar'],
        'seo_title' => ['en' => 'My Restaurant', 'ar' => 'مطعمي'],
        'seo_description' => ['en' => 'The best food in town.', 'ar' => 'ألذ طعام في المدينة.'],
    ]);

    $this->mock(OpenAiService::class, function ($mock) {
        $mock->shouldReceive('isConfigured')->andReturn(true);
        $mock->shouldReceive('chat')->never();
    });

    (new TranslateTenantContentJob($tenant->id, 'ar'))->handle(app(OpenAiService::class), app(SeoService::class));

    expect($tenant->fresh()->seo_title['ar'])->toBe('مطعمي');
});
