<?php

namespace App\Http\Controllers\Tenant;

use App\Http\Controllers\Controller;
use App\Services\PayPalService;
use App\Services\StripeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConnectController extends Controller
{
    public function __construct(
        private readonly StripeService $stripe,
        private readonly PayPalService $paypal,
    ) {
    }

    public function status(): JsonResponse
    {
        $tenant = app('tenant');

        return response()->json([
            'connected'          => (bool) $tenant->stripe_connect_account_id,
            'charges_enabled'    => $tenant->stripe_connect_charges_enabled,
            'details_submitted'  => $tenant->stripe_connect_details_submitted,
            'paypal'             => [
                'connected'            => (bool) $tenant->paypal_merchant_id,
                'payments_receivable'  => $tenant->paypal_payments_receivable,
                'email_confirmed'      => $tenant->paypal_email_confirmed,
            ],
        ]);
    }

    public function onboard(Request $request): JsonResponse
    {
        $data = $request->validate([
            'return_url'  => ['required', 'url'],
            'refresh_url' => ['required', 'url'],
        ]);

        $url = $this->stripe->createConnectAccountLink(app('tenant'), $data['return_url'], $data['refresh_url']);

        return response()->json(['url' => $url]);
    }

    public function onboardPaypal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'return_url' => ['required', 'url'],
        ]);

        $url = $this->paypal->createPartnerReferral(app('tenant'), $data['return_url']);

        return response()->json(['url' => $url]);
    }

    /**
     * Called once the merchant lands back on our return_url with PayPal's
     * `merchantIdInPayPal` query param — PayPal has no simple immediate
     * webhook for this, so the frontend triggers this sync itself.
     */
    public function syncPaypalStatus(Request $request): JsonResponse
    {
        $data = $request->validate([
            'merchant_id' => ['required', 'string'],
        ]);

        $tenant = app('tenant');
        $status = $this->paypal->fetchMerchantStatus($data['merchant_id']);

        $tenant->update([
            'paypal_merchant_id'          => $data['merchant_id'],
            'paypal_payments_receivable'  => $status['payments_receivable'],
            'paypal_email_confirmed'      => $status['email_confirmed'],
        ]);

        return response()->json([
            'connected'           => true,
            'payments_receivable' => $tenant->paypal_payments_receivable,
            'email_confirmed'     => $tenant->paypal_email_confirmed,
        ]);
    }
}
