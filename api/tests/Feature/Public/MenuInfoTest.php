<?php

use App\Models\Tenant;

beforeEach(function () {
    $this->seed();
});

it('exposes the tenant\'s analytics ids on the public info endpoint', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    $tenant->update(['google_analytics_id' => 'G-TEST123', 'facebook_pixel_id' => '123456789']);

    $response = $this->getJson('/api/v1/public/demo-restaurant/info')->assertOk();

    $response->assertJsonPath('data.analytics.google_analytics_id', 'G-TEST123');
    $response->assertJsonPath('data.analytics.facebook_pixel_id', '123456789');
});

it('returns null analytics ids when the tenant has none configured', function () {
    $response = $this->getJson('/api/v1/public/demo-restaurant/info')->assertOk();

    $response->assertJsonPath('data.analytics.google_analytics_id', null);
    $response->assertJsonPath('data.analytics.facebook_pixel_id', null);
});

it('exposes the service charge message when the owner enabled showing it', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    $tenant->update([
        'service_charge_rate' => 10,
        'service_charge_message' => 'A 10% service charge applies to dine-in orders.',
        'service_charge_show_message' => true,
    ]);

    $response = $this->getJson('/api/v1/public/demo-restaurant/info')->assertOk();

    $response->assertJsonPath('data.service_charge_rate', 10);
    $response->assertJsonPath('data.service_charge_message', 'A 10% service charge applies to dine-in orders.');
});

it('hides the service charge message when the owner has not enabled showing it', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    $tenant->update([
        'service_charge_rate' => 10,
        'service_charge_message' => 'A 10% service charge applies to dine-in orders.',
        'service_charge_show_message' => false,
    ]);

    $response = $this->getJson('/api/v1/public/demo-restaurant/info')->assertOk();

    $response->assertJsonPath('data.service_charge_message', null);
});

it('serves a per-tenant web app manifest so Add to Home Screen uses the restaurant\'s own name', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();

    $response = $this->getJson('/api/v1/public/demo-restaurant/manifest.webmanifest')->assertOk();

    $response->assertHeader('Content-Type', 'application/manifest+json');
    $response->assertJsonPath('name', $tenant->name);
    $response->assertJsonPath('display', 'standalone');
    expect($response->json('start_url'))->toStartWith($response->json('id'));
    expect($response->json('scope'))->toStartWith($response->json('id'));
});

it('falls back to the bundled app icons when the tenant has no logo or favicon', function () {
    $tenant = Tenant::where('slug', 'demo-restaurant')->firstOrFail();
    $tenant->update(['logo_path' => null, 'favicon_path' => null]);

    $response = $this->getJson('/api/v1/public/demo-restaurant/manifest.webmanifest')->assertOk();

    $icons = $response->json('icons');
    expect($icons)->toHaveCount(2);
    expect(collect($icons)->pluck('src')->all())->toBe(['/icons/icon-192.png', '/icons/icon-512.png']);
});
