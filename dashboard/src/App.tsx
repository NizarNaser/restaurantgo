import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import DashboardLayout from './layouts/DashboardLayout';
import AuthLayout from './layouts/AuthLayout';
import PublicI18nLayout from './layouts/PublicI18nLayout';
import RequirePermission from './components/RequirePermission';
import RequireRole from './components/RequireRole';
import { getTenantHostSlug } from './lib/publicSite';
import adminI18n from './i18n';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MenuPage = lazy(() => import('./pages/MenuPage'));
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'));
const HRPage = lazy(() => import('./pages/HRPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const QrCodesPage = lazy(() => import('./pages/QrCodesPage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RestaurantSetupPage = lazy(() => import('./pages/RestaurantSetupPage'));
const TranslationsPage = lazy(() => import('./pages/TranslationsPage'));
const HallsPage = lazy(() => import('./pages/HallsPage'));
const TableOrderPage = lazy(() => import('./pages/TableOrderPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'));
const DiscountCardsPage = lazy(() => import('./pages/DiscountCardsPage'));
const SalesDashboardPage = lazy(() => import('./pages/SalesDashboardPage'));
const KitchenDisplayPage = lazy(() => import('./pages/KitchenDisplayPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ImpersonatePage = lazy(() => import('./pages/ImpersonatePage'));

const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'));
const PublicHallsPage = lazy(() => import('./pages/PublicHallsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const OrderStatusPage = lazy(() => import('./pages/OrderStatusPage'));
const PublicBlogPage = lazy(() => import('./pages/PublicBlogPage').then((m) => ({ default: m.PublicBlogPage })));
const PublicArticlePage = lazy(() => import('./pages/PublicBlogPage').then((m) => ({ default: m.PublicArticlePage })));
const PublicLegalPage = lazy(() => import('./pages/PublicLegalPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={32} className="animate-spin text-gray-400" />
    </div>
  );
}

// Computed once from the browser's hostname (never changes within a single
// page load): a tenant subdomain or connected custom domain renders ONLY
// the public site, at clean root paths — never the staff dashboard, which
// only ever lives at the platform's own host. See lib/publicSite.ts.
const tenantHostSlug = getTenantHostSlug();

function TenantPublicSiteRoutes() {
  return (
    <Routes>
      <Route element={<PublicI18nLayout />}>
        <Route path="/" element={<PublicMenuPage />} />
        <Route path="/halls" element={<PublicHallsPage />} />
        <Route path="/item/:itemId" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/order/:orderId" element={<OrderStatusPage />} />
        <Route path="/blog" element={<PublicBlogPage />} />
        <Route path="/blog/:articleSlug" element={<PublicArticlePage />} />
        <Route path="/privacy" element={<PublicLegalPage kind="privacy" />} />
        <Route path="/terms" element={<PublicLegalPage kind="terms" />} />
        <Route path="/accessibility" element={<PublicLegalPage kind="accessibility" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function PlatformRoutes() {
  return (
    <Routes>
      {/* Kept for local dev (no VITE_BASE_DOMAIN / wildcard DNS available)
          and as a permanent fallback for a tenant with no subdomain yet. */}
      <Route element={<PublicI18nLayout />}>
        <Route path="/p/:slug" element={<PublicMenuPage />} />
        <Route path="/p/:slug/halls" element={<PublicHallsPage />} />
        <Route path="/p/:slug/item/:itemId" element={<ProductDetailPage />} />
        <Route path="/p/:slug/cart" element={<CartPage />} />
        <Route path="/p/:slug/order/:orderId" element={<OrderStatusPage />} />
        <Route path="/p/:slug/blog" element={<PublicBlogPage />} />
        <Route path="/p/:slug/blog/:articleSlug" element={<PublicArticlePage />} />
        <Route path="/p/:slug/privacy" element={<PublicLegalPage kind="privacy" />} />
        <Route path="/p/:slug/terms" element={<PublicLegalPage kind="terms" />} />
        <Route path="/p/:slug/accessibility" element={<PublicLegalPage kind="accessibility" />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Standalone screen — no dashboard sidebar/header, and reachable by
          a dedicated kitchen-display login that has no dashboard access
          at all (see DashboardLayout's own redirect for that role). */}
      <Route path="/kds" element={<KitchenDisplayPage />} />

      {/* Standalone handoff screen for the company admin's "open dashboard"
          impersonation action — see ImpersonatePage.tsx. */}
      <Route path="/impersonate" element={<ImpersonatePage />} />

      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/menu" element={<RequireRole roles={['owner', 'manager']}><MenuPage /></RequireRole>} />
        <Route path="/articles" element={<RequireRole roles={['owner', 'manager']}><ArticlesPage /></RequireRole>} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/orders" element={<RequireRole roles={['owner', 'manager']}><OrdersPage /></RequireRole>} />
        <Route path="/qr-codes" element={<RequireRole roles={['owner', 'manager']}><QrCodesPage /></RequireRole>} />
        <Route path="/financial" element={<RequireRole roles={['owner', 'manager']}><FinancialPage /></RequireRole>} />
        <Route path="/hr" element={<RequireRole roles={['owner', 'manager']}><HRPage /></RequireRole>} />
        <Route path="/billing" element={<RequireRole roles={['owner', 'manager']}><BillingPage /></RequireRole>} />
        <Route path="/settings" element={<RequireRole roles={['owner', 'manager']}><SettingsPage /></RequireRole>} />
        <Route path="/restaurant-setup" element={<RequireRole roles={['owner', 'manager']}><RestaurantSetupPage /></RequireRole>} />
        <Route path="/translations" element={<RequireRole roles={['owner', 'manager']}><TranslationsPage /></RequireRole>} />
        <Route path="/halls" element={<HallsPage />} />
        <Route path="/tables/:tableId/order" element={<RequirePermission permission="manage tables"><TableOrderPage /></RequirePermission>} />
        <Route path="/inventory" element={<RequireRole roles={['owner', 'manager']}><InventoryPage /></RequireRole>} />
        <Route path="/invoices" element={<RequireRole roles={['owner', 'manager']}><InvoicesPage /></RequireRole>} />
        <Route path="/shifts" element={<RequireRole roles={['owner', 'manager']}><ShiftsPage /></RequireRole>} />
        <Route path="/discount-cards" element={<RequireRole roles={['owner', 'manager']}><DiscountCardsPage /></RequireRole>} />
        <Route path="/reports/sales" element={<RequireRole roles={['owner', 'manager']}><SalesDashboardPage /></RequireRole>} />
        {/* Add more routes here as we build them */}
      </Route>
    </Routes>
  );
}

function App() {
  return (
    // Explicit, rather than relying on react-i18next's implicit "last
    // initialized instance wins" global default: PublicI18nLayout is
    // imported eagerly (it sits in the route tree, not behind React.lazy)
    // and initializes its own separate `publicI18n` instance as a side
    // effect of module evaluation. Without this provider, that happens to
    // overwrite the global default react-i18next hands to every
    // unguarded useTranslation() call — including every admin/staff page,
    // which then silently renders raw keys ("nav.menu", "login.welcomeBack")
    // instead of translated text, since publicI18n has none of the admin
    // dashboard's own translation keys loaded. Nested public routes still
    // get the correct `publicI18n` via PublicI18nLayout's own (closer)
    // <I18nextProvider>, which always wins over this outer one.
    <I18nextProvider i18n={adminI18n}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          {tenantHostSlug ? <TenantPublicSiteRoutes /> : <PlatformRoutes />}
        </Suspense>
      </BrowserRouter>
    </I18nextProvider>
  );
}

export default App;
