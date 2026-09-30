<?php

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

    'allowed_origins' => [
        'http://localhost:5173', 'http://127.0.0.1:5173', // dashboard (tenant admin + public restaurant pages)
        'http://localhost:5174', 'http://127.0.0.1:5174', // web (main marketing site + company admin)
        'https://dashboard-rouge-sigma-47.vercel.app', // dashboard — Vercel trial deploy
        'https://web-nine-wheat-36.vercel.app', // web — Vercel trial deploy
        'https://localhost', // RestaurantGo POS Android app (Capacitor's default WebView origin)
    ],

    // Lets a phone on the same WiFi reach the API when the dev servers are
    // opened via the dev machine's LAN IP instead of localhost (see dev.sh
    // --host). Restricted to the private IP ranges + dev ports only.
    'allowed_origins_patterns' => [
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
        '#^https?://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:(5173|5174))?$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
