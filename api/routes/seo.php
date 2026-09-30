<?php

use App\Http\Controllers\Public\SeoController;
use App\Http\Controllers\Public\SeoRenderController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SEO Routes
|--------------------------------------------------------------------------
|
| Crawler-facing documents, registered with no middleware group: they are
| stateless, must live at the root of a tenant's domain (so they can't sit
| behind the /api prefix), and have no business setting session cookies.
|
| On a custom domain or subdomain the edge rewrites /sitemap.xml to
| /p/{slug}/sitemap.xml; the explicit path is also what local development
| and the shared fallback domain use.
|
*/

Route::get('/p/{slug}/sitemap.xml', [SeoController::class, 'sitemap'])->name('seo.sitemap');
Route::get('/p/{slug}/robots.txt',  [SeoController::class, 'robots'])->name('seo.robots');

// One sitemap index covering every active tenant — see
// SeoService::platformSitemapIndex() for why this matters specifically for
// the path-based (no wildcard subdomain) deployment.
Route::get('/sitemap.xml', [SeoController::class, 'sitemapIndex'])->name('seo.sitemap-index');

// Pure server-rendered menu page for non-JS search/AI crawlers — see
// SeoRenderController for why this exists and how it's reached.
Route::get('/p/{slug}/preview', [SeoRenderController::class, 'menu'])->name('seo.menu-preview');
