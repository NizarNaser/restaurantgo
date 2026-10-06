<?php

use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

it('ignores a client-sent X-Tenant-Id header and always resolves the authenticated user\'s own tenant', function () {
    $this->seed();
    $owner = User::where('email', 'owner@demo.com')->firstOrFail();
    $ownTenant = Tenant::find($owner->tenant_id);

    $otherTenant = Tenant::create([
        'name' => 'Someone Else\'s Restaurant', 'slug' => 'someone-elses-restaurant',
        'subdomain' => 'someone-elses-restaurant', 'plan_id' => $ownTenant->plan_id,
        'status' => 'active', 'default_locale' => 'en', 'service_charge_message' => ['en' => 'Private note'],
    ]);

    Sanctum::actingAs($owner, ['*']);

    // Spoofing another tenant's ID must not grant access to that tenant's data —
    // the response should reflect the authenticated user's own tenant regardless.
    $response = $this->getJson('/api/settings', ['X-Tenant-Id' => (string) $otherTenant->id]);

    $response->assertOk();
    $response->assertJsonPath('name', $ownTenant->name);
    expect($response->json('name'))->not->toBe($otherTenant->name);
});
