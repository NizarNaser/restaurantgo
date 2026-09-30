<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Flip scheduled articles to published as their publish_at passes.
Schedule::command('articles:publish-scheduled')->everyFiveMinutes()->withoutOverlapping();

// Refresh USD exchange rates used by the financial module.
Schedule::command('exchange-rates:update')->dailyAt('01:00')->withoutOverlapping();
