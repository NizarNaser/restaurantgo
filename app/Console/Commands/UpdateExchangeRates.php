<?php

namespace App\Console\Commands;

use App\Jobs\UpdateExchangeRatesJob;
use Illuminate\Console\Command;

class UpdateExchangeRates extends Command
{
    protected $signature = 'exchange-rates:update';

    protected $description = 'Queue a job to fetch today\'s currency exchange rates into exchange_rates.';

    public function handle(): int
    {
        UpdateExchangeRatesJob::dispatch();

        $this->info('Exchange rate update queued.');
        return self::SUCCESS;
    }
}
