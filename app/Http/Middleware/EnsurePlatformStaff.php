<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates the company admin API (/api/admin/*) to users with no tenant_id —
 * i.e. internal platform accounts, as opposed to a restaurant's own users.
 * Fine-grained authorization per endpoint is then handled by Spatie's
 * `permission:` middleware (manage staff, manage payments, ...).
 */
class EnsurePlatformStaff
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_if(! $user || $user->tenant_id !== null, 403, 'This area is restricted to platform staff.');

        return $next($request);
    }
}
