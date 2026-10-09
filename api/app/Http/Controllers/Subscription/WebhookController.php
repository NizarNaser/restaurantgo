<?php

namespace App\Http\Controllers\Subscription;

use App\Http\Controllers\Controller;
use App\Services\StripeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class WebhookController extends Controller
{
    public function __construct(private readonly StripeService $stripe) {}

    /**
     * Stripe posts here on every billing event. No auth, no tenant
     * middleware — the tenant is resolved from event metadata instead — and
     * the payload must be read raw, since signature verification hashes the
     * exact bytes Stripe sent.
     */
    public function handle(Request $request): Response
    {
        $payload   = $request->getContent();
        $signature = $request->header('Stripe-Signature');

        // Two possible secrets: the main account's webhook endpoint, and —
        // since Connect delivers account.updated etc. to a separate
        // "Connected Accounts" endpoint with its own signing secret — an
        // optional second one for that.
        $secrets = array_filter([
            config('services.stripe.webhook_secret'),
            config('services.stripe.connect_webhook_secret'),
        ]);

        // Fail closed, not open: without a configured secret there is no way
        // to verify this payload actually came from Stripe, so it must be
        // rejected — never parsed and trusted as-is.
        if (! $secrets) {
            Log::warning('Stripe webhook rejected: no webhook secret is configured.');

            return response('Webhook not configured.', 500);
        }

        $event          = null;
        $signatureError = null;

        foreach ($secrets as $secret) {
            try {
                $event = Webhook::constructEvent($payload, $signature, $secret);
                break;
            } catch (SignatureVerificationException $e) {
                $signatureError = $e;
                continue;
            } catch (\Throwable $e) {
                Log::warning('Stripe webhook payload could not be parsed', ['error' => $e->getMessage()]);

                return response('Invalid payload.', 400);
            }
        }

        if (! $event) {
            Log::warning('Stripe webhook signature verification failed', ['error' => $signatureError?->getMessage()]);

            return response('Invalid signature.', 400);
        }

        $this->stripe->handleWebhookEvent($event);

        return response('OK', 200);
    }
}
