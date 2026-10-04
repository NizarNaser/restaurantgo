<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\Tenant\ArticleController;
use App\Http\Controllers\Tenant\AttendanceController;
use App\Http\Controllers\Tenant\DashboardController;
use App\Http\Controllers\Tenant\MenuCategoryController;
use App\Http\Controllers\Tenant\MenuItemController;
use App\Http\Controllers\Tenant\EmployeeController;
use App\Http\Controllers\Tenant\PayrollController;
use App\Http\Controllers\Tenant\SettingsController;
use App\Http\Controllers\Tenant\FinancialController;
use App\Http\Controllers\Tenant\GdprController;
use App\Http\Controllers\Tenant\OrderController;
use App\Http\Controllers\Tenant\ReservationController;
use App\Http\Controllers\Tenant\QrCodeController;
use App\Http\Controllers\Subscription\PlanController;
use App\Http\Controllers\Subscription\SubscriptionController;
use App\Http\Controllers\Subscription\WebhookController;
use App\Http\Controllers\SuperAdmin\AdvertisementController as AdminAdvertisementController;
use App\Http\Controllers\SuperAdmin\AuditLogController as AdminAuditLogController;
use App\Http\Controllers\SuperAdmin\ContactMessageController;
use App\Http\Controllers\SuperAdmin\CouponController as AdminCouponController;
use App\Http\Controllers\SuperAdmin\PaymentController;
use App\Http\Controllers\SuperAdmin\PlanController as AdminPlanController;
use App\Http\Controllers\SuperAdmin\StaffAttendanceController;
use App\Http\Controllers\SuperAdmin\StaffController;
use App\Http\Controllers\SuperAdmin\StaffPayrollController;
use App\Http\Controllers\SuperAdmin\TenantController as AdminTenantController;
use App\Http\Controllers\Public\AdvertisementController as PublicAdvertisementController;
use App\Http\Controllers\Public\ContactController;
use App\Http\Controllers\Public\DirectoryController;
use App\Http\Controllers\Public\ReservationController as PublicReservationController;
use App\Http\Controllers\Public\QrCodeController as PublicQrCodeController;
use Illuminate\Support\Facades\Route;

// ── Auth ──────────────────────────────────────────────────────────────────────
Route::prefix('/auth')->group(function () {
    Route::post('/register', RegisterController::class)->middleware('throttle:register');
    Route::post('/login',    [LoginController::class, 'login'])->middleware('throttle:login');

    // Completes a login that LoginController::login deferred with `requires_2fa` —
    // no session yet, so this can't sit behind auth:sanctum.
    Route::post('/2fa/verify', [TwoFactorController::class, 'verify'])->middleware('throttle:login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me',         [LoginController::class, 'me']);
        Route::post('/logout',    [LoginController::class, 'logout']);

        Route::post('/2fa/enroll',  [TwoFactorController::class, 'enroll']);
        Route::post('/2fa/confirm', [TwoFactorController::class, 'confirm']);
        Route::post('/2fa/disable', [TwoFactorController::class, 'disable']);

        Route::put('/profile/email',    [\App\Http\Controllers\Auth\ProfileController::class, 'updateEmail']);
        Route::put('/profile/password', [\App\Http\Controllers\Auth\ProfileController::class, 'updatePassword']);
    });
});

// ── Plans (public pricing) ────────────────────────────────────────────────────
Route::get('/plans', [PlanController::class, 'index']);

// Unauthenticated visitor chat on the marketing site — a distinct path from
// the tenant-scoped /assistant/chat below: Laravel's route collection keys
// routes by method+URI, so an identical path here would silently overwrite
// (not coexist with) that one instead of 404ing or erroring loudly.
Route::post('/v1/assistant/chat', [\App\Http\Controllers\Public\AssistantController::class, 'chat'])
    ->middleware('throttle:public-assistant');

// ── Subscription / Billing ────────────────────────────────────────────────────
// Deliberately excludes check.subscription: a tenant whose subscription has
// lapsed must still be able to reach checkout and the billing portal to fix it.
Route::middleware(['auth:sanctum', 'identify.tenant'])->group(function () {
    Route::get('/subscription',            [SubscriptionController::class, 'show']);
    Route::post('/subscription/checkout',  [SubscriptionController::class, 'checkout'])->middleware('throttle:billing');
    Route::post('/subscription/switch-to-free', [SubscriptionController::class, 'switchToFree'])->middleware('throttle:billing');
    Route::post('/subscription/portal',    [SubscriptionController::class, 'portal'])->middleware('throttle:billing');
    Route::post('/subscription/cancel',    [SubscriptionController::class, 'cancel'])->middleware('throttle:billing');
    Route::post('/subscription/resume',    [SubscriptionController::class, 'resume'])->middleware('throttle:billing');
    Route::post('/coupons/validate',       [SubscriptionController::class, 'validateCoupon'])->middleware('throttle:coupon');

    // Stripe Connect — lets a tenant receive delivery/takeout order payments
    // directly. Same reasoning as above: reachable regardless of subscription state.
    Route::get('/connect/status',   [\App\Http\Controllers\Tenant\ConnectController::class, 'status']);
    Route::post('/connect/onboard', [\App\Http\Controllers\Tenant\ConnectController::class, 'onboard'])->middleware('throttle:billing');
    Route::post('/connect/paypal/onboard', [\App\Http\Controllers\Tenant\ConnectController::class, 'onboardPaypal'])->middleware('throttle:billing');
    Route::post('/connect/paypal/sync',    [\App\Http\Controllers\Tenant\ConnectController::class, 'syncPaypalStatus'])->middleware('throttle:billing');

    Route::post('/assistant/chat', [\App\Http\Controllers\Tenant\AssistantController::class, 'chat'])
        ->middleware('throttle:assistant');
});

// Stripe calls this directly — no session, no auth, verified by signature instead.
Route::post('/webhooks/stripe', [WebhookController::class, 'handle']);

// ── Authenticated + Tenant Routes ─────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'identify.tenant', 'check.subscription'])->group(function () {

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // Menu & Categories
    Route::prefix('/menu')->group(function () {
        Route::apiResource('/categories', MenuCategoryController::class);
        Route::apiResource('/items', MenuItemController::class);
        Route::post('/items/{menuItem}/media',        [MenuItemController::class, 'uploadMedia']);
        Route::post('/items/{menuItem}/translations', [MenuItemController::class, 'syncTranslations']);
        Route::put('/items/{menuItem}/prices',        [MenuItemController::class, 'syncPrices']);
        Route::post('/items/translate', [MenuItemController::class, 'autoTranslate'])->middleware('throttle:assistant');
        Route::post('/categories/translate', [MenuCategoryController::class, 'autoTranslate'])->middleware('throttle:assistant');

        // Recipe/BOM card — which ingredients/semi-finished goods prepare this item.
        Route::get('/items/{item}/recipe', [MenuItemController::class, 'showRecipe'])->middleware('permission:manage menus');
        Route::put('/items/{item}/recipe', [MenuItemController::class, 'syncRecipe'])->middleware('permission:manage menus');
    });

    // Warehouse: raw ingredients, semi-finished (manufactured) goods, their
    // recipes/BOMs, and the stock in/out ledger.
    Route::middleware('permission:manage inventory')->group(function () {
        Route::apiResource('/ingredients', \App\Http\Controllers\Tenant\IngredientController::class)->except(['show']);
        Route::post('/ingredients/{ingredient}/stock-in', [\App\Http\Controllers\Tenant\IngredientController::class, 'stockIn']);

        Route::apiResource('/semi-finished-goods', \App\Http\Controllers\Tenant\SemiFinishedGoodController::class)->except(['show']);
        Route::get('/semi-finished-goods/{semiFinishedGood}/recipe', [\App\Http\Controllers\Tenant\SemiFinishedGoodController::class, 'showRecipe']);
        Route::put('/semi-finished-goods/{semiFinishedGood}/recipe', [\App\Http\Controllers\Tenant\SemiFinishedGoodController::class, 'syncRecipe']);
        Route::post('/semi-finished-goods/{semiFinishedGood}/produce', [\App\Http\Controllers\Tenant\SemiFinishedGoodController::class, 'produce']);

        Route::get('/stock-movements', [\App\Http\Controllers\Tenant\StockMovementController::class, 'index']);
    });

    // Articles / Blog
    Route::apiResource('/articles', ArticleController::class);
    Route::post('/articles/{article}/publish',        [ArticleController::class, 'publish']);
    Route::post('/articles/{article}/unpublish',      [ArticleController::class, 'unpublish']);
    Route::post('/articles/{article}/featured-image', [ArticleController::class, 'uploadFeaturedImage']);
    Route::post('/articles/content-image', [ArticleController::class, 'uploadContentImage']);
    Route::post('/articles/translate', [ArticleController::class, 'autoTranslate'])->middleware('throttle:assistant');

    // Translations — how complete each supported language is across the
    // menu/blog, AI-translating a whole new language at once, and marking a
    // machine translation as reviewed.
    Route::prefix('/translations')->group(function () {
        Route::get('/summary',        [\App\Http\Controllers\Tenant\TranslationController::class, 'summary']);
        Route::post('/bulk',          [\App\Http\Controllers\Tenant\TranslationController::class, 'bulkTranslate'])->middleware('throttle:assistant');
        Route::post('/mark-reviewed', [\App\Http\Controllers\Tenant\TranslationController::class, 'markReviewed']);
    });

    // HR: Attendance
    Route::get('/attendance',           [AttendanceController::class, 'index']);
    Route::post('/attendance/checkin',  [AttendanceController::class, 'checkin']);
    Route::post('/attendance/checkout', [AttendanceController::class, 'checkout']);
    
    // HR: Employees
    Route::apiResource('/employees', EmployeeController::class);

    // Staff login accounts (name/role/branch) — distinct from the Employee
    // payroll record above; this is who can log in and what they can do.
    Route::middleware('permission:manage users')->group(function () {
        Route::get('/staff-accounts',            [\App\Http\Controllers\Tenant\StaffAccountController::class, 'index']);
        Route::post('/staff-accounts',           [\App\Http\Controllers\Tenant\StaffAccountController::class, 'store']);
        Route::put('/staff-accounts/{user}',     [\App\Http\Controllers\Tenant\StaffAccountController::class, 'update']);

        // Physical staff cards (attendance swipe + reservation access code) — the admin/owner registers them.
        Route::get('/staff-cards',                [\App\Http\Controllers\Tenant\StaffCardController::class, 'index']);
        Route::post('/staff-cards',               [\App\Http\Controllers\Tenant\StaffCardController::class, 'store']);
        Route::put('/staff-cards/{staffCard}',    [\App\Http\Controllers\Tenant\StaffCardController::class, 'update']);
        Route::delete('/staff-cards/{staffCard}', [\App\Http\Controllers\Tenant\StaffCardController::class, 'destroy']);
    });

    // Called by the card reader / phone-tablet app — any authenticated
    // terminal session in the tenant, not gated to a management permission.
    Route::post('/staff-cards/swipe', [\App\Http\Controllers\Tenant\StaffCardController::class, 'swipe']);
    Route::post('/pin/verify',        [\App\Http\Controllers\Tenant\StaffCardController::class, 'verify']);

    // Halls & Tables (dine-in floor setup) — layout editing, distinct from
    // "manage tables" (working a table during service, see Phase 4).
    Route::middleware('permission:manage halls')->group(function () {
        Route::get('/halls',             [\App\Http\Controllers\Tenant\HallController::class, 'index']);
        Route::post('/halls',            [\App\Http\Controllers\Tenant\HallController::class, 'store']);
        Route::put('/halls/{hall}',      [\App\Http\Controllers\Tenant\HallController::class, 'update']);
        Route::delete('/halls/{hall}',   [\App\Http\Controllers\Tenant\HallController::class, 'destroy']);

        Route::get('/tables',            [\App\Http\Controllers\Tenant\TableController::class, 'index']);
        Route::post('/tables',           [\App\Http\Controllers\Tenant\TableController::class, 'store']);
        Route::put('/tables/{table}',    [\App\Http\Controllers\Tenant\TableController::class, 'update']);
        Route::delete('/tables/{table}', [\App\Http\Controllers\Tenant\TableController::class, 'destroy']);

        Route::apiResource('/departments', \App\Http\Controllers\Tenant\DepartmentController::class)
            ->except(['show']);
        Route::apiResource('/printers', \App\Http\Controllers\Tenant\PrinterController::class)
            ->except(['show']);
    });

    // Live kitchen/bar order screens — open to whoever works a department
    // (staff/waiter/bartender), not just floor-layout/menu managers.
    Route::middleware('permission:use kitchen display')->group(function () {
        Route::get('/kds/departments', [\App\Http\Controllers\Tenant\KitchenDisplayController::class, 'departments']);
        Route::get('/kds/departments/{department}/tickets', [\App\Http\Controllers\Tenant\KitchenDisplayController::class, 'index']);
        Route::post('/kds/departments/{department}/orders/{order}/start',   [\App\Http\Controllers\Tenant\KitchenDisplayController::class, 'start']);
        Route::post('/kds/departments/{department}/orders/{order}/finish',  [\App\Http\Controllers\Tenant\KitchenDisplayController::class, 'finish']);
        Route::post('/kds/departments/{department}/orders/{order}/collect', [\App\Http\Controllers\Tenant\KitchenDisplayController::class, 'collect']);
    });

    // Staff floor view (read-only) — working a table during service, open
    // to whoever can work a table (waiter/bartender and above), not just
    // whoever can edit the floor layout.
    Route::middleware('permission:manage tables')->group(function () {
        Route::get('/floor/halls',       [\App\Http\Controllers\Tenant\HallController::class, 'index']);
        Route::get('/floor/tables',      [\App\Http\Controllers\Tenant\TableController::class, 'floor']);
        Route::get('/floor/printers',    [\App\Http\Controllers\Tenant\PrinterController::class, 'index']);
        Route::get('/floor/departments', [\App\Http\Controllers\Tenant\DepartmentController::class, 'index']);

        Route::post('/tables/{table}/open',  [\App\Http\Controllers\Tenant\TableController::class, 'open']);
        Route::post('/tables/{table}/close', [\App\Http\Controllers\Tenant\TableController::class, 'close']);
        Route::get('/tables/{table}/order',  [\App\Http\Controllers\Tenant\TableController::class, 'currentOrder']);
        Route::post('/orders/{order}/items', [\App\Http\Controllers\Tenant\OrderController::class, 'addItems']);
        Route::get('/orders/{order}/invoice', [\App\Http\Controllers\Tenant\OrderController::class, 'invoice']);
    });

    // Move an open order to a different table — admin/manager-only.
    Route::middleware('permission:transfer tables')->group(function () {
        Route::post('/tables/{table}/transfer', [\App\Http\Controllers\Tenant\TableController::class, 'transfer']);
    });

    // Cancel an unpaid order ("delete a reservation") — admin/manager-only,
    // distinct from deleting an already-paid invoice below.
    Route::middleware('permission:delete orders')->group(function () {
        Route::post('/orders/{order}/cancel', [\App\Http\Controllers\Tenant\OrderController::class, 'cancel']);
    });

    // Permanently delete a paid invoice — owner-only ("super admin" per the spec).
    Route::middleware('permission:delete invoices')->group(function () {
        Route::delete('/orders/{order}', [\App\Http\Controllers\Tenant\OrderController::class, 'destroy']);
    });

    // Customer discount/loyalty cards — registering a card, looking one up,
    // and requesting/rejecting/redeeming a discount are ALL admin/owner-only;
    // regular staff have no discount permission at all. Approving still goes
    // through the same credential check as a second confirmation.
    Route::middleware('permission:manage discount cards')->group(function () {
        Route::apiResource('/discount-cards', \App\Http\Controllers\Tenant\DiscountCardController::class)->except(['show']);
        Route::get('/discount-cards/lookup', [\App\Http\Controllers\Tenant\DiscountCardController::class, 'lookup']);
        Route::post('/orders/{order}/discount-requests', [\App\Http\Controllers\Tenant\DiscountApplicationController::class, 'store']);
        Route::post('/discount-requests/{discountApplication}/approve', [\App\Http\Controllers\Tenant\DiscountApplicationController::class, 'approve']);
        Route::post('/discount-requests/{discountApplication}/reject', [\App\Http\Controllers\Tenant\DiscountApplicationController::class, 'reject']);
        Route::post('/orders/{order}/redeem-card-balance', [\App\Http\Controllers\Tenant\DiscountApplicationController::class, 'redeem']);
    });

    // Shift open/close — any authenticated staff member can check whether one
    // is open; only owner/manager can actually open/close/review them.
    Route::get('/shifts/current', [\App\Http\Controllers\Tenant\ShiftController::class, 'current']);
    Route::middleware('permission:manage shifts')->group(function () {
        Route::get('/shifts',                 [\App\Http\Controllers\Tenant\ShiftController::class, 'index']);
        Route::post('/shifts/open',           [\App\Http\Controllers\Tenant\ShiftController::class, 'open']);
        Route::post('/shifts/{shift}/close',  [\App\Http\Controllers\Tenant\ShiftController::class, 'close']);
        Route::get('/shifts/{shift}/summary', [\App\Http\Controllers\Tenant\ShiftController::class, 'summary']);
    });

    // HR: Payroll
    Route::get('/payroll',                    [PayrollController::class, 'index']);
    Route::post('/payroll/run',               [PayrollController::class, 'store']);
    Route::get('/payroll/{payrollRun}',       [PayrollController::class, 'show']);
    Route::post('/payroll/{payrollRun}/approve',    [PayrollController::class, 'approve']);
    Route::post('/payroll/{payrollRun}/pay',        [PayrollController::class, 'pay']);
    Route::get('/payroll/{payrollRun}/export/pdf',  [PayrollController::class, 'exportPdf']);

    // Tenant Settings
    Route::get('/settings',  [SettingsController::class, 'show']);
    Route::put('/settings',  [SettingsController::class, 'update']);
    Route::post('/settings/images/{type}', [SettingsController::class, 'uploadImage']);
    Route::post('/settings/custom-domain', [SettingsController::class, 'setCustomDomain']);
    Route::delete('/settings/custom-domain', [SettingsController::class, 'removeCustomDomain']);

    // Sales &amp; warehouse reporting dashboards
    Route::middleware('permission:view reports')->group(function () {
        Route::get('/reports/sales/summary',     [\App\Http\Controllers\Tenant\SalesReportController::class, 'summary']);
        Route::get('/reports/sales/by-staff',    [\App\Http\Controllers\Tenant\SalesReportController::class, 'byStaff']);
        Route::get('/reports/sales/chart-data',  [\App\Http\Controllers\Tenant\SalesReportController::class, 'chartData']);
        Route::get('/reports/tables',            [\App\Http\Controllers\Tenant\SalesReportController::class, 'tables']);
    });

    // Financials
    Route::get('/financial/summary',   [FinancialController::class, 'summary']);
    Route::get('/financial/revenues',  [FinancialController::class, 'indexRevenues']);
    Route::post('/financial/revenues', [FinancialController::class, 'storeRevenue']);
    Route::delete('/financial/revenues/{revenue}', [FinancialController::class, 'destroyRevenue']);
    Route::get('/financial/expenses',  [FinancialController::class, 'indexExpenses']);
    Route::post('/financial/expenses', [FinancialController::class, 'storeExpense']);
    Route::delete('/financial/expenses/{expense}', [FinancialController::class, 'destroyExpense']);
    Route::get('/financial/chart-data',         [FinancialController::class, 'chartData']);
    Route::get('/financial/reports/profit-loss', [FinancialController::class, 'profitLoss']);
    Route::get('/financial/exchange-rates',     [FinancialController::class, 'exchangeRates']);
    Route::get('/financial/export/{type}',      [FinancialController::class, 'exportExcel']);

    // GDPR: tenant-scoped data portability + erasure
    Route::get('/gdpr/export',            [GdprController::class, 'export']);
    Route::post('/gdpr/erasure-request',  [GdprController::class, 'requestErasure'])->middleware('throttle:gdpr-erasure');

    // Reservations coming in from the public directory/booking form
    Route::get('/reservations',            [ReservationController::class, 'index']);
    Route::put('/reservations/{reservation}', [ReservationController::class, 'update']);

    // Dine-in orders placed via a table QR code, or entered by staff on a
    // customer's behalf — gated to roles that work customer-facing service.
    Route::middleware('permission:manage orders')->group(function () {
        Route::get('/orders',         [OrderController::class, 'index']);
        Route::post('/orders',        [OrderController::class, 'store']);
        Route::put('/orders/{order}', [OrderController::class, 'update']);
    });

    // Minimal branch picker — used when creating a table QR code
    Route::get('/branches', [\App\Http\Controllers\Tenant\BranchController::class, 'index']);
    Route::get('/branch', [\App\Http\Controllers\Tenant\BranchController::class, 'show']);
    Route::put('/branch', [\App\Http\Controllers\Tenant\BranchController::class, 'update']);
    Route::post('/branch/resolve-maps-url', [\App\Http\Controllers\Tenant\BranchController::class, 'resolveMapsUrl'])->middleware('throttle:30,1');

    // QR codes — tracked, not just rendered client-side
    Route::get('/qr-codes',            [QrCodeController::class, 'index']);
    Route::post('/qr-codes',           [QrCodeController::class, 'store']);
    Route::delete('/qr-codes/{qrCode}', [QrCodeController::class, 'destroy']);
});

// The link GdprExportReady's email points at — opened from an email client
// with no Sanctum token, so it's authenticated by Laravel's signed-URL
// verification instead of the usual auth:sanctum + identify.tenant pair.
Route::get('/gdpr/export/{tenant}/{filename}', [GdprController::class, 'downloadExport'])
    ->name('gdpr.export.download')
    ->middleware('signed')
    ->where('filename', '[0-9a-f-]{36}\.json');

// ── Company Admin (platform staff, not tied to any tenant) ────────────────────
Route::middleware(['auth:sanctum', 'platform.staff'])->prefix('/admin')->group(function () {
    Route::get('/metrics', [AdminTenantController::class, 'metrics']);

    Route::middleware('permission:manage tenants')->group(function () {
        Route::get('/tenants',                  [AdminTenantController::class, 'index']);
        Route::post('/tenants',                 [AdminTenantController::class, 'store']);
        Route::get('/tenants/{tenant}',         [AdminTenantController::class, 'show']);
        Route::put('/tenants/{tenant}/suspend', [AdminTenantController::class, 'suspend']);
        Route::put('/tenants/{tenant}/activate',[AdminTenantController::class, 'activate']);
        Route::put('/tenants/{tenant}/plan',    [AdminTenantController::class, 'updatePlan']);
        Route::post('/tenants/{tenant}/impersonate', [AdminTenantController::class, 'impersonate']);
        Route::delete('/tenants/{tenant}',      [AdminTenantController::class, 'destroy']);
    });

    Route::middleware('permission:manage payments')->group(function () {
        Route::get('/payments', [PaymentController::class, 'index']);
    });

    Route::middleware('permission:manage plans')->group(function () {
        Route::apiResource('/plans', AdminPlanController::class)->except(['show']);
    });

    Route::middleware('permission:manage coupons')->group(function () {
        Route::apiResource('/coupons', AdminCouponController::class)->except(['show']);
    });

    Route::middleware('permission:manage staff')->group(function () {
        Route::apiResource('/staff', StaffController::class)->parameters(['staff' => 'staffMember']);

        Route::get('/staff-attendance',           [StaffAttendanceController::class, 'index']);
        Route::post('/staff-attendance/checkin',  [StaffAttendanceController::class, 'checkin']);
        Route::post('/staff-attendance/checkout', [StaffAttendanceController::class, 'checkout']);

        Route::get('/staff-payroll',                       [StaffPayrollController::class, 'index']);
        Route::post('/staff-payroll/run',                  [StaffPayrollController::class, 'store']);
        Route::get('/staff-payroll/{staffPayrollRun}',     [StaffPayrollController::class, 'show']);
        Route::post('/staff-payroll/{staffPayrollRun}/approve', [StaffPayrollController::class, 'approve']);
        Route::post('/staff-payroll/{staffPayrollRun}/pay',     [StaffPayrollController::class, 'pay']);
    });

    Route::middleware('permission:manage advertisements')->group(function () {
        Route::apiResource('/advertisements', AdminAdvertisementController::class)->except(['show']);
    });

    Route::middleware('permission:manage contact messages')->group(function () {
        Route::get('/contact-messages',                [ContactMessageController::class, 'index']);
        Route::put('/contact-messages/{contactMessage}/read', [ContactMessageController::class, 'markRead']);
        Route::delete('/contact-messages/{contactMessage}',   [ContactMessageController::class, 'destroy']);
    });

    Route::middleware('permission:view audit logs')->group(function () {
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
    });

    // The platform's own marketing site (the `web` app) — separate from any
    // tenant's restaurant SEO, which each owner manages in their own settings.
    Route::middleware('permission:manage platform settings')->group(function () {
        Route::get('/platform-settings', [\App\Http\Controllers\SuperAdmin\PlatformSettingsController::class, 'show']);
        Route::put('/platform-settings', [\App\Http\Controllers\SuperAdmin\PlatformSettingsController::class, 'update']);
    });
});

// ── Public Routes ─────────────────────────────────────────────────────────────
Route::prefix('/v1/public/{slug}')->group(function () {
    Route::get('/info', [\App\Http\Controllers\Public\MenuController::class, 'getInfo']);
    Route::get('/manifest.webmanifest', [\App\Http\Controllers\Public\MenuController::class, 'manifest']);
    Route::get('/menu', [\App\Http\Controllers\Public\MenuController::class, 'getMenu']);
    Route::get('/menu/items/{itemId}', [\App\Http\Controllers\Public\MenuController::class, 'getItem']);

    Route::get('/articles',                [\App\Http\Controllers\Public\ArticleController::class, 'index']);
    Route::get('/articles/{articleSlug}',  [\App\Http\Controllers\Public\ArticleController::class, 'show']);

    Route::get('/reviews', [\App\Http\Controllers\Public\ReviewController::class, 'index']);

    // Rate-limited: unauthenticated write endpoints open to the public.
    Route::post('/reviews', [\App\Http\Controllers\Public\ReviewController::class, 'store'])
        ->middleware('throttle:5,1');
    Route::post('/reservations', [PublicReservationController::class, 'store'])
        ->middleware('throttle:10,1');
    Route::post('/orders', [\App\Http\Controllers\Public\OrderController::class, 'store'])
        ->middleware('throttle:20,1');
    Route::get('/orders/{order}', [\App\Http\Controllers\Public\OrderController::class, 'show']);

    // Delivery/takeout orders — paid online, routed to the tenant's own
    // Stripe Connect account (see StripeService::createOrderCheckoutSession).
    Route::post('/orders/checkout', [\App\Http\Controllers\Public\OrderCheckoutController::class, 'store'])
        ->middleware('throttle:20,1');

    Route::post('/assistant/chat', [\App\Http\Controllers\Public\MenuAssistantController::class, 'chat'])
        ->middleware('throttle:public-assistant');

    // Read-only floor view for a customer who chose "dine-in" — helps them
    // find their table by its real position; no auth, no bill/staff info.
    Route::get('/halls',  [\App\Http\Controllers\Public\HallController::class, 'index']);
    Route::get('/tables', [\App\Http\Controllers\Public\HallController::class, 'tables']);
});

// ── Main marketing site (company services, restaurant directory, contact) ────
Route::prefix('/v1/directory')->group(function () {
    Route::get('/restaurants', [DirectoryController::class, 'index']);
    Route::get('/top-rated',   [DirectoryController::class, 'topRated']);
    Route::get('/filters',     [DirectoryController::class, 'filters']);
});

// The marketing site's own SEO (title/description/OG image/Google
// verification) — distinct from any one tenant's restaurant SEO.
Route::get('/v1/platform/seo', [\App\Http\Controllers\Public\PlatformController::class, 'seo']);

Route::get('/v1/ads', [PublicAdvertisementController::class, 'active']);
Route::post('/v1/ads/{advertisement}/click', [PublicAdvertisementController::class, 'click']);

// What a printed QR code actually points at — tracks the scan, then redirects.
Route::get('/v1/qr/{qrCode}', [PublicQrCodeController::class, 'scan']);

Route::post('/v1/contact', [ContactController::class, 'store'])
    ->middleware('throttle:5,1');
