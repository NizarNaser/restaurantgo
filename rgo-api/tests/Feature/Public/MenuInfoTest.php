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
