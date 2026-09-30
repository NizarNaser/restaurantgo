<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscription
{
    public function handle(Request $request, Closure $next, string $feature = null): Response
    {
        $tenant = app('tenant');

        // Super admin bypass
        if ($request->user()?->isSuperAdmin()) {
            return $next($request);
        }

        // Trial is still valid
        if ($tenant->onTrial()) {
            return $next($request);
        }

        $subscription = $tenant->subscription;

        // No active subscription
        if (! $subscription || $subscription->status !== 'active') {
            return response()->json([
                'message' => 'Your subscription has expired. Please renew to continue.',
                'code'    => 'SUBSCRIPTION_EXPIRED',
            ], 402);
        }

        // Feature gate
        if ($feature && ! $tenant->canUse($feature)) {
            return response()->json([
                'message' => "Your current plan does not include '{$feature}'. Please upgrade.",
                'code'    => 'FEATURE_NOT_AVAILABLE',
                'upgrade_url' => url('/billing'),
            ], 403);
        }

        return $next($request);
    }
}
