<?php

use App\Jobs\UpdateExchangeRatesJob;
use App\Models\ExchangeRate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

it('queues the exchange rate update instead of fetching inline', function () {
    Queue::fake();

    $this->artisan('exchange-rates:update')->assertExitCode(0);

    Queue::assertPushed(UpdateExchangeRatesJob::class);
});

it('stores the fetched rates when the job runs', function () {
    Http::fake([
        'open.er-api.com/*' => Http::response([
            'result' => 'success',
            'rates'  => ['EUR' => 0.92, 'GBP' => 0.79, 'SAR' => 3.75, 'AED' => 3.67, 'EGP' => 48.5],
        ]),
    ]);

    (new UpdateExchangeRatesJob())->handle(app(\App\Services\ExchangeRateService::class));

    expect(ExchangeRate::where('target_currency', 'EUR')->exists())->toBeTrue();
});
