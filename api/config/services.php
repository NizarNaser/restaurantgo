<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'stripe' => [
        'key'            => env('STRIPE_KEY'),
        'secret'         => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        // Connect sends account.updated (and other connected-account events)
        // to a separate "Connected Accounts" webhook endpoint in the Stripe
        // dashboard, signed with its own secret — distinct from the main
        // account webhook's STRIPE_WEBHOOK_SECRET above.
        'connect_webhook_secret' => env('STRIPE_CONNECT_WEBHOOK_SECRET'),
        'order_commission_percent' => (float) env('STRIPE_ORDER_COMMISSION_PERCENT', 0),
        // Country a new Connect account is created in — Stripe fixes this
        // permanently at account creation, so it must match where the
        // tenant actually operates. Falls back to this when the tenant has
        // no country of its own to read.
        'connect_country' => env('STRIPE_CONNECT_COUNTRY', 'DE'),
    ],

    'paypal' => [
        'client_id'  => env('PAYPAL_CLIENT_ID'),
        'secret'     => env('PAYPAL_SECRET'),
        // Our own platform's PayPal merchant id, assigned by PayPal when we
        // registered as a partner — not a per-tenant value.
        'partner_id' => env('PAYPAL_PARTNER_ID'),
        'base_url'   => env('PAYPAL_BASE_URL', 'https://api-m.sandbox.paypal.com'),
    ],

    'openai' => [
        'key'   => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-4o-mini'),
    ],

];
