<?php

use App\Models\Coupon;
use App\Models\Plan;
use App\Models\Tenant;

function makeCoupon(?int $maxUses, int $usedCount = 0): Coupon
{
    $tenant = Tenant::create([
        'name' => 'Coupon Test Tenant', 'slug' => 'coupon-test-' . uniqid(),
        'subdomain' => 'coupon-test-' . uniqid(),
        'plan_id' => Plan::firstOrCreate(['slug' => 'test-plan'], ['name' => 'Test Plan'])->id,
        'status' => 'active', 'default_locale' => 'en',
    ]);

    return Coupon::create([
        'tenant_id' => $tenant->id, 'code' => 'TEST-' . uniqid(), 'type' => Coupon::TYPE_PERCENT,
        'value' => 10, 'max_uses' => $maxUses, 'used_count' => $usedCount, 'is_active' => true,
    ]);
}

it('reserves a use when under the limit', function () {
    $coupon = makeCoupon(maxUses: 5, usedCount: 3);

    expect($coupon->tryReserve())->toBeTrue();
    expect($coupon->fresh()->used_count)->toBe(4);
});

it('refuses to reserve once the limit is already reached', function () {
    $coupon = makeCoupon(maxUses: 5, usedCount: 5);

    expect($coupon->tryReserve())->toBeFalse();
    expect($coupon->fresh()->used_count)->toBe(5);
});

it('never lets concurrent reservations push used_count past max_uses', function () {
    $coupon = makeCoupon(maxUses: 1, usedCount: 0);

    // Two "concurrent" callers both holding a copy of the same pre-reservation
    // state — this is exactly the race the fix closes: both see used_count=0
    // against max_uses=1, but only one may actually succeed.
    $first  = Coupon::find($coupon->id);
    $second = Coupon::find($coupon->id);

    $firstResult  = $first->tryReserve();
    $secondResult = $second->tryReserve();

    expect([$firstResult, $secondResult])->toContain(true);
    expect([$firstResult, $secondResult])->toContain(false);
    expect($coupon->fresh()->used_count)->toBe(1);
});

it('always reserves when max_uses is unlimited', function () {
    $coupon = makeCoupon(maxUses: null, usedCount: 100);

    expect($coupon->tryReserve())->toBeTrue();
    expect($coupon->fresh()->used_count)->toBe(101);
});
