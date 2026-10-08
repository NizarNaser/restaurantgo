<?php

namespace App\Services;

/**
 * Centralizes ISO 4217 decimal-place handling so every money calculation in
 * the app (orders, discounts, payroll, Stripe minor units, report
 * aggregates) agrees on how many decimals a given currency actually has.
 * Most currencies use 2 (cents); a handful used in the Gulf/Maghreb use 3
 * (e.g. a Kuwaiti Dinar's fils); a few have none at all (e.g. Japanese Yen).
 * A flat `round($amount, 2)` silently truncates real money for any tenant
 * billing in one of the 3-decimal currencies below.
 */
class Currency
{
    /** ISO 4217 currencies with 3 decimal places — offered in Settings' currency picker. */
    private const THREE_DECIMAL_CURRENCIES = ['BHD', 'JOD', 'KWD', 'OMR', 'TND'];

    /** ISO 4217 currencies with no decimal places — offered in Settings' currency picker. */
    private const ZERO_DECIMAL_CURRENCIES = ['JPY', 'KRW', 'VND'];

    public static function decimals(string $currency): int
    {
        $code = strtoupper($currency);

        if (in_array($code, self::THREE_DECIMAL_CURRENCIES, true)) {
            return 3;
        }

        if (in_array($code, self::ZERO_DECIMAL_CURRENCIES, true)) {
            return 0;
        }

        return 2;
    }

    /** Rounds a money amount to the number of decimals its currency actually has. */
    public static function round(float $amount, string $currency): float
    {
        return round($amount, self::decimals($currency));
    }

    /**
     * Converts a major-unit amount (e.g. 1.234 KWD) to the integer minor
     * unit Stripe's API expects (e.g. 1234 fils) for that currency.
     */
    public static function toMinorUnits(float $amount, string $currency): int
    {
        return (int) round($amount * (10 ** self::decimals($currency)));
    }

    /** The inverse of toMinorUnits() — an integer minor-unit amount back to major units. */
    public static function fromMinorUnits(int $amount, string $currency): float
    {
        return $amount / (10 ** self::decimals($currency));
    }
}
