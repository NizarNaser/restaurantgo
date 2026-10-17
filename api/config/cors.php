<?php

// Production domain the marketing site, dashboard and tenant subdomains are
// served from (APP_BASE_DOMAIN). Falls back to the platform's own domain so
// CORS keeps working on a server whose .env leaves APP_BASE_DOMAIN empty.
$baseDomain = env('APP_BASE_DOMAIN') ?: 'restoatlas.com';

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_merge([
        // Production: marketing site + dashboard/public restaurant pages.
        "https://{$baseDomain}", "https://www.{$baseDomain}",
        "https://app.{$baseDomain}",
        // Legacy domain from before the RestoAtlas rebrand (2026-10). nginx
        // 301-redirects these hosts to the new domain, so they only matter
        // for the DNS cutover window — remove once restaurantgo.org lapses.
        'https://restaurantgo.org', 'https://www.restaurantgo.org',
        'https://app.restaurantgo.org',
        'http://localhost:5173', 'http://127.0.0.1:5173', // dashboard (tenant admin + public restaurant pages)
        'http://localhost:5174', 'http://127.0.0.1:5174', // web (main marketing site + company admin)
        'https://dashboard-rouge-sigma-47.vercel.app', // dashboard — Vercel trial deploy
        'https://web-nine-wheat-36.vercel.app', // web — Vercel trial deploy
        'https://localhost', // RestoAtlas POS Android app (Capacitor's default WebView origin)
    ],
        // Extra origins without a code change (e.g. a restaurant's custom
        // domain): comma-separated list in CORS_ALLOWED_ORIGINS.
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
    ))),

    // Lets a phone on the same WiFi reach the API when the dev servers are
    // opened via the dev machine's LAN IP instead of localhost (see dev.sh
    // --host). Restricted to the private IP ranges + dev ports only.
    'allowed_origins_patterns' => [
        // Per-restaurant subdomains ({slug}.{APP_BASE_DOMAIN}), plus the
        // legacy {slug}.restaurantgo.org ones during the rebrand transition.
        '#^https://[a-z0-9-]+\\.' . preg_quote($baseDomain, '#') . '$#',
        '#^https://[a-z0-9-]+\\.restaurantgo\\.org$#',
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
        '#^https?://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
