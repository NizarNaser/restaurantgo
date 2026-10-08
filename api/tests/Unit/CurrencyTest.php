<?php

use App\Services\Currency;

it('reports 2 decimals for ordinary currencies', function () {
    expect(Currency::decimals('USD'))->toBe(2);
    expect(Currency::decimals('eur'))->toBe(2);
});

it('reports 3 decimals for Gulf/Maghreb currencies', function () {
    foreach (['BHD', 'JOD', 'KWD', 'OMR', 'TND'] as $currency) {
        expect(Currency::decimals($currency))->toBe(3);
    }
});

it('reports 0 decimals for zero-decimal currencies', function () {
    foreach (['JPY', 'KRW', 'VND'] as $currency) {
        expect(Currency::decimals($currency))->toBe(0);
    }
});

it('rounds to the right number of decimals per currency', function () {
    expect(Currency::round(1.23456, 'USD'))->toBe(1.23);
    expect(Currency::round(1.23456, 'KWD'))->toBe(1.235);
    expect(Currency::round(1500.4, 'JPY'))->toBe(1500.0);
});

it('converts to and from Stripe minor units consistently per currency', function () {
    expect(Currency::toMinorUnits(19.99, 'USD'))->toBe(1999);
    expect(Currency::toMinorUnits(19.990, 'KWD'))->toBe(19990);
    expect(Currency::toMinorUnits(1500, 'JPY'))->toBe(1500);

    expect(Currency::fromMinorUnits(1999, 'USD'))->toBe(19.99);
    expect(Currency::fromMinorUnits(19990, 'KWD'))->toBe(19.99);
    expect(Currency::fromMinorUnits(1500, 'JPY'))->toBe(1500.0);
});
