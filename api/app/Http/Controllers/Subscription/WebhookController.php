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
        $secret    = config('services.stripe.webhook_secret');
        $signature = $request->header('Stripe-Signature');

        // Fail closed, not open: without a configured secret there is no way
        // to verify this payload actually came from Stripe, so it must be
        // rejected — never parsed and trusted as-is.
        if (! $secret) {
            Log::warning('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.');

            return response('Webhook not configured.', 500);
        }

        try {
            $event = Webhook::constructEvent($payload, $signature, $secret);
        } catch (SignatureVerificationException $e) {
            Log::warning('Stripe webhook signature verification failed', ['error' => $e->getMessage()]);

            return response('Invalid signature.', 400);
        } catch (\Throwable $e) {
            Log::warning('Stripe webhook payload could not be parsed', ['error' => $e->getMessage()]);

            return response('Invalid payload.', 400);
        }

        $this->stripe->handleWebhookEvent($event);

        return response('OK', 200);
    }
}
