<?php

use App\Models\QrCode;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->owner = User::where('email', 'owner@demo.com')->firstOrFail();
    Sanctum::actingAs($this->owner, ['*']);
});

it('creates a tracked QR code for the tenant\'s public menu', function () {
    $response = $this->postJson('/api/qr-codes', [
        'type'       => 'menu',
        'target_url' => 'https://restaurantgo.test/p/demo-restaurant',
    ]);

    $response->assertCreated();
    expect(QrCode::where('tenant_id', $this->owner->tenant_id)->count())->toBe(1);
});

it('lists only the tenant\'s own QR codes', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other', 'slug' => 'other-qr', 'subdomain' => 'other-qr',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    QrCode::create(['tenant_id' => $otherTenant->id, 'type' => 'menu', 'target_url' => 'https://x.test/p/other']);
    QrCode::create(['tenant_id' => $this->owner->tenant_id, 'type' => 'menu', 'target_url' => 'https://x.test/p/demo']);

    $response = $this->getJson('/api/qr-codes')->assertOk();
    expect($response->json())->toHaveCount(1);
});

it('deletes a QR code belonging to the tenant', function () {
    $qr = QrCode::create(['tenant_id' => $this->owner->tenant_id, 'type' => 'menu', 'target_url' => 'https://x.test/p/demo']);

    $this->deleteJson("/api/qr-codes/{$qr->id}")->assertOk();
    expect(QrCode::find($qr->id))->toBeNull();
});

it('rejects deleting another tenant\'s QR code', function () {
    $otherTenant = Tenant::create([
        'name' => 'Other 2', 'slug' => 'other-qr-2', 'subdomain' => 'other-qr-2',
        'plan_id' => \App\Models\Plan::first()->id, 'status' => 'active',
    ]);
    $qr = QrCode::create(['tenant_id' => $otherTenant->id, 'type' => 'menu', 'target_url' => 'https://x.test/p/other']);

    $this->deleteJson("/api/qr-codes/{$qr->id}")->assertNotFound();
});

it('creates a table QR code with a server-generated scan URL carrying its own id', function () {
    $branch = \App\Models\Branch::where('tenant_id', $this->owner->tenant_id)->firstOrFail();

    $response = $this->postJson('/api/qr-codes', [
        'type'         => 'table',
        'branch_id'    => $branch->id,
        'table_number' => '12',
    ]);

    $response->assertCreated();
    $qr = QrCode::where('tenant_id', $this->owner->tenant_id)->where('table_number', '12')->firstOrFail();
    expect($qr->target_url)->toContain('?qr=' . $qr->id);
});

it('requires a table number and branch when creating a table QR code', function () {
    $this->postJson('/api/qr-codes', ['type' => 'table'])->assertStatus(422);
});

it('increments the scan count and redirects when a QR code is scanned', function () {
    $qr = QrCode::create([
        'tenant_id'  => $this->owner->tenant_id,
        'type'       => 'menu',
        'target_url' => 'https://restaurantgo.test/p/demo-restaurant',
        'scan_count' => 3,
    ]);

    $response = $this->get("/api/v1/qr/{$qr->id}");

    $response->assertRedirect('https://restaurantgo.test/p/demo-restaurant');
    expect($qr->fresh()->scan_count)->toBe(4);
});
