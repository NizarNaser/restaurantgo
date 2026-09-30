<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Onboards a tenant as a PayPal "connected" merchant via the Partner
 * Referrals API — the PayPal counterpart to StripeService's Connect
 * account/account-link methods. Actually charging a split payment through
 * the connected merchant (Orders API v2 + platform fees) is a later phase;
 * this service only gets a tenant to a state where PayPal says it can
 * receive payments.
 */
class PayPalService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.paypal.client_id') && (bool) config('services.paypal.secret');
    }

    private function assertConfigured(): void
    {
        abort_if(! $this->isConfigured(), 422, 'PayPal is not configured for this platform yet.');
    }

    private function baseUrl(): string
    {
        return rtrim(config('services.paypal.base_url'), '/');
    }

    /**
     * PayPal has no static secret key to send per-request like Stripe — every
     * call needs a short-lived OAuth2 token, cached for its own lifetime so
     * we're not round-tripping for a token on every request.
     */
    private function accessToken(): string
    {
        return Cache::remember('paypal_access_token', now()->addMinutes(8 * 60), function () {
            $response = Http::asForm()
                ->withBasicAuth(config('services.paypal.client_id'), config('services.paypal.secret'))
                ->post("{$this->baseUrl()}/v1/oauth2/token", ['grant_type' => 'client_credentials']);

            abort_if(! $response->successful(), 422, 'Could not authenticate with PayPal.');

            return $response->json('access_token');
        });
    }

    /**
     * Returns the hosted onboarding URL a tenant's owner is redirected to,
     * the PayPal counterpart of Stripe's Account Link.
     */
    public function createPartnerReferral(Tenant $tenant, string $returnUrl): string
    {
        $this->assertConfigured();

        $response = Http::withToken($this->accessToken())
            ->post("{$this->baseUrl()}/v2/customer/partner-referrals", [
                'tracking_id'     => (string) $tenant->id,
                'partner_config_override' => ['return_url' => $returnUrl],
                'legal_consents'  => [['type' => 'SHARE_DATA_CONSENT', 'granted' => true]],
                'operations'      => [[
                    'operation' => 'API_INTEGRATION',
                    'api_integration_preference' => [
                        'rest_api_integration' => [
                            'integration_method' => 'PAYPAL',
                            'integration_type'   => 'THIRD_PARTY',
                            'third_party_details' => ['features' => ['PAYMENT', 'REFUND']],
                        ],
                    ],
                ]],
            ]);

        abort_if(! $response->successful(), 422, 'Could not start PayPal onboarding.');

        $actionUrl = collect($response->json('links'))->firstWhere('rel', 'action_url')['href'] ?? null;
        abort_if(! $actionUrl, 422, 'PayPal did not return an onboarding link.');

        return $actionUrl;
    }

    /**
     * Reads whether a connected merchant can actually receive payments yet —
     * the PayPal counterpart of Stripe's charges_enabled/details_submitted.
     */
    public function fetchMerchantStatus(string $merchantId): array
    {
        $this->assertConfigured();

        $partnerId = config('services.paypal.partner_id');

        $response = Http::withToken($this->accessToken())
            ->get("{$this->baseUrl()}/v1/customer/partners/{$partnerId}/merchant-integrations/{$merchantId}");

        abort_if(! $response->successful(), 422, 'Could not check PayPal account status.');

        return [
            'payments_receivable' => (bool) $response->json('payments_receivable'),
            'email_confirmed'     => (bool) $response->json('primary_email_confirmed'),
        ];
    }
}
