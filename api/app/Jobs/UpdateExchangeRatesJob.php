<?php

namespace App\Jobs;

use App\Services\ExchangeRateService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * The scheduled command used to call the upstream HTTP fetch inline, so a
 * slow or flaky exchange-rate API meant the command process (and its cron
 * slot) just hung or failed with no retry. Queuing it gets Laravel's normal
 * job retry/backoff instead.
 */
class UpdateExchangeRatesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function handle(ExchangeRateService $service): void
    {
        $stored = $service->updateDailyRates();

        if ($stored === 0) {
            Log::warning('UpdateExchangeRatesJob: no rates were stored — the upstream API may be unavailable.');
        }
    }
}
