<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // laravel/telescope is a --dev dependency; a `composer install --no-dev`
        // production build won't have the class, so this guard keeps that build
        // from fatal-erroring on a provider it can't resolve.
        if (class_exists(\Laravel\Telescope\TelescopeServiceProvider::class)) {
            $this->app->register(\Laravel\Telescope\TelescopeServiceProvider::class);
            $this->app->register(TelescopeServiceProvider::class);
        }
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Keyed by email+IP rather than IP alone, so one attacker can't lock a
        // shared office/NAT IP out of every account by spraying random emails.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        // Self-service tenant signup — throttled per IP to blunt spam/bulk account creation.
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));

        // Stripe checkout/portal/cancel/resume — authenticated, but each hop is a real Stripe API call.
        RateLimiter::for('billing', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        // Guards against brute-forcing coupon codes one guess at a time.
        RateLimiter::for('coupon', fn (Request $request) => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        // Erasure is destructive and rare by nature; a low ceiling costs nothing legitimate.
        RateLimiter::for('gdpr-erasure', fn (Request $request) => Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()));

        // Each message is a paid external API call — a conversational feature needs a higher
        // but still bounded ceiling compared to the one-shot actions above.
        RateLimiter::for('assistant', fn (Request $request) => Limit::perMinute(15)->by($request->user()?->id ?: $request->ip()));

        // Unauthenticated and open to anyone on the internet — a tighter ceiling than the
        // logged-in dashboard assistant, keyed by IP since there's no user to key on.
        RateLimiter::for('public-assistant', fn (Request $request) => Limit::perMinute(6)->by($request->ip()));
    }
}
