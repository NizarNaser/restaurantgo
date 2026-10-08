<?php

use App\Services\StripeService;

/**
 * toMinorUnits() is private (no Stripe API call involved, pure arithmetic),
 * so these call it via reflection rather than standing up a full checkout
 * flow just to exercise one conversion.
 */
function callToMinorUnits(float $amount, string $currency): int
{
    $service = new StripeService();
    $method = new ReflectionMethod(StripeService::class, 'toMinorUnits');
    $method->setAccessible(true);

    return $method->invoke($service, $amount, $currency);
}

it('converts ordinary 2-decimal currencies to cents', function () {
    expect(callToMinorUnits(19.99, 'USD'))->toBe(1999);
    expect(callToMinorUnits(19.99, 'EUR'))->toBe(1999);
});

it('converts 3-decimal Gulf currencies to their true minor unit instead of undercharging 10x', function () {
    expect(callToMinorUnits(19.990, 'KWD'))->toBe(19990);
    expect(callToMinorUnits(19.990, 'BHD'))->toBe(19990);
    expect(callToMinorUnits(19.990, 'OMR'))->toBe(19990);
    expect(callToMinorUnits(19.990, 'JOD'))->toBe(19990);
    expect(callToMinorUnits(19.990, 'TND'))->toBe(19990);
});

it('leaves zero-decimal currencies unmultiplied instead of overcharging 100x', function () {
    expect(callToMinorUnits(1500, 'JPY'))->toBe(1500);
    expect(callToMinorUnits(1500, 'KRW'))->toBe(1500);
    expect(callToMinorUnits(1500, 'VND'))->toBe(1500);
});

it('is case-insensitive on the currency code', function () {
    expect(callToMinorUnits(19.990, 'kwd'))->toBe(19990);
});
