<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Crawler documents (sitemap.xml, robots.txt) — no middleware group.
            Route::group([], __DIR__.'/../routes/seo.php');
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'identify.tenant'    => \App\Http\Middleware\IdentifyTenant::class,
            'check.subscription' => \App\Http\Middleware\CheckSubscription::class,
            'platform.staff'     => \App\Http\Middleware\EnsurePlatformStaff::class,
            'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);

        // IdentifyTenant isn't in Laravel's default priority list, so it would
        // otherwise run AFTER SubstituteBindings (route-model binding resolves
        // route params before any route-specific middleware runs) — which meant
        // the tenant global scope wasn't bound yet when a {model} route param
        // was resolved, silently defeating it for every implicit-bound route.
        // Forcing this order is what lets a cross-tenant {id} 404 at the
        // binding stage instead of only being caught later by hand in the
        // controller.
        $middleware->prependToPriorityList(
            before: \Illuminate\Routing\Middleware\SubstituteBindings::class,
            prepend: \App\Http\Middleware\IdentifyTenant::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // No-op until SENTRY_LARAVEL_DSN is set — the SDK simply doesn't send without a DSN.
        \Sentry\Laravel\Integration::handles($exceptions);
    })->create();

