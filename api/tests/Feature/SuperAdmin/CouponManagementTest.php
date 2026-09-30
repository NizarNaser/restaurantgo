<?php

use App\Models\Coupon;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed();
    $this->admin = User::where('email', 'admin@restaurantgo.com')->firstOrFail();
    Sanctum::actingAs($this->admin, ['*']);
});

it('creates a platform-wide coupon', function () {
    $response = $this->postJson('/api/admin/coupons', [
        'code'      => 'LAUNCH25',
        'type'      => 'percent',
        'value'     => 25,
        'max_uses'  => 100,
        'is_active' => true,
    ]);

    $response->assertCreated();
    expect(Coupon::where('code', 'LAUNCH25')->whereNull('tenant_id')->exists())->toBeTrue();
});

it('rejects a duplicate coupon code', function () {
    Coupon::create(['code' => 'DUPE10', 'type' => 'percent', 'value' => 10, 'is_active' => true]);

    $this->postJson('/api/admin/coupons', [
        'code'  => 'DUPE10',
        'type'  => 'percent',
        'value' => 15,
    ])->assertStatus(422);
});

it('updates and deletes a coupon', function () {
    $coupon = Coupon::create(['code' => 'TEMP5', 'type' => 'fixed', 'value' => 5, 'currency' => 'USD', 'is_active' => true]);

    $this->putJson("/api/admin/coupons/{$coupon->id}", [
        'code' => 'TEMP5', 'type' => 'fixed', 'value' => 5, 'currency' => 'USD', 'is_active' => false,
    ])->assertOk();
    expect($coupon->fresh()->is_active)->toBeFalse();

    $this->deleteJson("/api/admin/coupons/{$coupon->id}")->assertOk();
    expect(Coupon::find($coupon->id))->toBeNull();
});
