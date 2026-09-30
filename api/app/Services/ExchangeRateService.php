<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExchangeRateService
{
    /**
     * Currencies offered in the tenant/expense/revenue currency picker.
     * USD is the base the free API quotes against.
     */
    private const BASE = 'USD';
    private const TARGETS = ['EUR', 'GBP', 'SAR', 'AED', 'EGP'];

    /**
     * Fetch today's USD rates and upsert them into exchange_rates.
     * Returns the number of rates stored.
     */
    public function updateDailyRates(): int
    {
        $response = Http::timeout(10)->get('https://open.er-api.com/v6/latest/'.self::BASE);

        if (! $response->successful() || $response->json('result') !== 'success') {
            Log::warning('ExchangeRateService: failed to fetch rates', ['status' => $response->status()]);
            return 0;
        }

        $rates = $response->json('rates', []);
        $date  = now()->toDateString();
        $stored = 0;

        foreach (self::TARGETS as $currency) {
            if (! isset($rates[$currency])) {
                continue;
            }

            ExchangeRate::updateOrCreate(
                [
                    'base_currency'   => self::BASE,
                    'target_currency' => $currency,
                    'date'            => $date,
                ],
                [
                    'rate'   => $rates[$currency],
                    'source' => 'api',
                ]
            );

            $stored++;
        }

        return $stored;
    }

    /**
     * Latest known rate per target currency (USD base), most recent date first.
     */
    public function latestRates(): array
    {
        return ExchangeRate::where('base_currency', self::BASE)
            ->orderByDesc('date')
            ->get()
            ->unique('target_currency')
            ->values()
            ->keyBy('target_currency')
            ->map(fn (ExchangeRate $rate) => [
                'rate' => (float) $rate->rate,
                'date' => $rate->date->toDateString(),
            ])
            ->toArray();
    }
}
