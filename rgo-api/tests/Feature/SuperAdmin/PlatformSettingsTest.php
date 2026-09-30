<?php

use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
});

it('lets platform staff update and read back the marketing site\'s per-locale SEO settings', function () {
    Sanctum::actingAs($this->admin, ['*']);

    $update = $this->putJson('/api/admin/platform-settings', [
        'seo_title'                => ['en' => 'RestaurantGo — Restaurant Management Platform', 'ar' => 'RestaurantGo — منصة إدارة المطاعم'],
        'seo_description'          => ['en' => 'Everything a restaurant needs to run online ordering.'],
        'seo_og_image'             => 'https://example.com/platform-og.jpg',
        'google_site_verification' => 'platform-verify-code',
    ]);
    $update->assertOk();
    $update->assertJsonPath('seo_title.en', 'RestaurantGo — Restaurant Management Platform');
    $update->assertJsonPath('seo_title.ar', 'RestaurantGo — منصة إدارة المطاعم');

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
        'name' => 'Support', 'email' => 'support-noperm@restaurantgo.com', 'password' => bcrypt('password'), 'is_active' => true,
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
