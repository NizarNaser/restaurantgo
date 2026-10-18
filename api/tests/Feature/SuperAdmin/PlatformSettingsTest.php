<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restoatlas.com')->firstOrFail();
});

it('lets platform staff update and read back the marketing site\'s per-locale SEO settings', function () {
    Sanctum::actingAs($this->admin, ['*']);

    $update = $this->putJson('/api/admin/platform-settings', [
        'seo_title'                => ['en' => 'RestoAtlas — Restaurant Management Platform', 'ar' => 'RestoAtlas — منصة إدارة المطاعم'],
        'seo_description'          => ['en' => 'Everything a restaurant needs to run online ordering.'],
        'seo_og_image'             => 'https://example.com/platform-og.jpg',
        'google_site_verification' => 'platform-verify-code',
    ]);
    $update->assertOk();
    $update->assertJsonPath('seo_title.en', 'RestoAtlas — Restaurant Management Platform');
    $update->assertJsonPath('seo_title.ar', 'RestoAtlas — منصة إدارة المطاعم');

    $show = $this->getJson('/api/admin/platform-settings');
    $show->assertOk();
    $show->assertJsonPath('google_site_verification', 'platform-verify-code');
});

it('rejects a plain string for a platform SEO field — it must be per-locale', function () {
    Sanctum::actingAs($this->admin, ['*']);

    $this->putJson('/api/admin/platform-settings', ['seo_title' => 'Not an object'])
        ->assertStatus(422);
});

it('blocks platform staff without the right permission from the platform settings', function () {
    $supportAgent = User::create([
        'name' => 'Support', 'email' => 'support-noperm@restoatlas.com', 'password' => bcrypt('password'), 'is_active' => true,
    ]);
    $supportAgent->assignRole('support_agent');
    Sanctum::actingAs($supportAgent, ['*']);

    $this->getJson('/api/admin/platform-settings')->assertForbidden();
    $this->putJson('/api/admin/platform-settings', ['seo_title' => ['en' => 'Hacked']])->assertForbidden();
});

it('serves the platform SEO settings, for every configured locale, on the public unauthenticated endpoint', function () {
    Sanctum::actingAs($this->admin, ['*']);
    $this->putJson('/api/admin/platform-settings', [
        'seo_title' => ['en' => 'Public Title', 'ar' => 'عنوان عام'],
        'seo_description' => ['en' => 'Public description'],
    ])->assertOk();

    // This route carries no auth middleware at all, unlike /admin/platform-settings above.
    $response = $this->getJson('/api/v1/platform/seo');
    $response->assertOk();
    $response->assertJsonPath('seo_title.en', 'Public Title');
    $response->assertJsonPath('seo_title.ar', 'عنوان عام');
    $response->assertJsonPath('seo_description.en', 'Public description');
});

it('shows the announcement bar with the default text until platform staff change it', function () {
    $this->getJson('/api/v1/platform/seo')
        ->assertOk()
        ->assertJsonPath('announcement.enabled', true)
        ->assertJsonPath('announcement.message', null);
});

it('lets platform staff hide the announcement bar and set its text per locale', function () {
    Sanctum::actingAs($this->admin, ['*']);

    $this->putJson('/api/admin/platform-settings', [
        'announcement_enabled' => false,
        'announcement_message' => ['en' => 'Maintenance tonight', 'ar' => 'صيانة الليلة'],
    ])->assertOk();

    $this->getJson('/api/v1/platform/seo')
        ->assertJsonPath('announcement.enabled', false)
        ->assertJsonPath('announcement.message.en', 'Maintenance tonight')
        ->assertJsonPath('announcement.message.ar', 'صيانة الليلة');
});

it('leaves the SEO settings alone when only the announcement bar is saved', function () {
    Sanctum::actingAs($this->admin, ['*']);
    $this->putJson('/api/admin/platform-settings', ['seo_title' => ['en' => 'Kept title']])->assertOk();

    $this->putJson('/api/admin/platform-settings', ['announcement_enabled' => false])->assertOk();

    $this->getJson('/api/v1/platform/seo')->assertJsonPath('seo_title.en', 'Kept title');
});

it('rejects an announcement message longer than 300 characters', function () {
    Sanctum::actingAs($this->admin, ['*']);

    $this->putJson('/api/admin/platform-settings', ['announcement_message' => ['en' => str_repeat('a', 301)]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('announcement_message.en');
});
