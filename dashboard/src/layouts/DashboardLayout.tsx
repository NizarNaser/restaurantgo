import { useEffect, useState } from 'react';
import { Outlet, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChefHat, LayoutDashboard, Utensils, Newspaper, CalendarCheck, ClipboardList, QrCode, Receipt, ReceiptText, Users, CreditCard, Percent, Settings, LogOut, Armchair, LayoutGrid, Warehouse, Clock, TrendingUp, Soup, Menu, X, Languages } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import LanguageSwitcher from '../components/LanguageSwitcher';
import AssistantWidget from '../components/AssistantWidget';
import ShiftGate from '../components/ShiftGate';

// Halls, Reservations, and Kitchen Display are the day-to-day operational
// surface — every staff role that reaches the sidebar can use them (Halls
// and Kitchen Display still keyed to their specific capability permission,
// which every non-admin operational role already holds). Everything else
// here is a back-office/management concern, restricted to owner/manager —
// see the `adminOnly` items below and their matching <RequireRole> route
// guards in App.tsx, which is what actually blocks direct-URL access, not
// just the nav link.
const navItems = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/menu', key: 'menu', icon: Utensils, adminOnly: true },
  { to: '/articles', key: 'articles', icon: Newspaper, adminOnly: true },
  { to: '/reservations', key: 'reservations', icon: CalendarCheck },
  { to: '/halls', key: 'halls', icon: LayoutGrid, permission: 'manage tables' },
  { to: '/orders', key: 'orders', icon: ClipboardList, adminOnly: true },
  { to: '/invoices', key: 'invoices', icon: ReceiptText, adminOnly: true },
  { to: '/shifts', key: 'shifts', icon: Clock, adminOnly: true },
  { to: '/discount-cards', key: 'discountCards', icon: Percent, adminOnly: true },
  { to: '/reports/sales', key: 'salesReports', icon: TrendingUp, adminOnly: true },
  { to: '/kds', key: 'kitchenDisplay', icon: Soup, permission: 'use kitchen display' },
  { to: '/qr-codes', key: 'qrCodes', icon: QrCode, adminOnly: true },
  { to: '/financial', key: 'financial', icon: Receipt, adminOnly: true },
  { to: '/hr', key: 'hr', icon: Users, adminOnly: true },
  { to: '/billing', key: 'billing', icon: CreditCard, adminOnly: true },
  { to: '/restaurant-setup', key: 'restaurantSetup', icon: Armchair, adminOnly: true },
  { to: '/translations', key: 'translations', icon: Languages, adminOnly: true },
  { to: '/inventory', key: 'inventory', icon: Warehouse, adminOnly: true },
  { to: '/settings', key: 'settings', icon: Settings, adminOnly: true },
] as const;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const { logout, hasPermission, hasRole } = useAuthStore();
  const isAdmin = hasRole('owner') || hasRole('manager');
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <div className="p-6 flex items-center gap-3 border-b border-gray-100">
        <div className="bg-[#ff4757] p-2 rounded-lg text-white">
          <ChefHat size={24} />
        </div>
        <span className="text-xl font-bold text-gray-800 flex-1">RestaurantGo</span>
        {onNavigate && (
          <button onClick={onNavigate} className="text-gray-400 hover:text-gray-700" aria-label="Close menu">
            <X size={22} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if ('adminOnly' in item && item.adminOnly && !isAdmin) return null;
          if ('permission' in item && item.permission && !hasPermission(item.permission)) return null;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-red-50 text-[#ff4757]'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-[#ff4757]' : 'text-gray-500'} />
              {t(`nav.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-3">
        <LanguageSwitcher />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-600 hover:bg-red-50 font-medium transition-colors"
        >
          <LogOut size={20} />
          {t('nav.logout')}
        </button>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const { user, isAuthenticated, fetchUser, hasRole } = useAuthStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // A token can persist in localStorage across app restarts, but `user`
  // (name, permissions) only ever lives in memory — without this, a
  // returning session shows a logged-in shell with every permission-gated
  // nav item (Halls, Restaurant Setup) silently hidden.
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // A dedicated kitchen-display login has no business in the admin
  // dashboard at all — send it straight to its own standalone screen.
  if (hasRole('kitchen_display')) {
    return <Navigate to="/kds" replace />;
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar (desktop/tablet) */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-col hidden md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile nav drawer — phones and narrow tablets have no room for a
          permanent sidebar, so it's a slide-out overlay instead. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col shadow-xl">
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden text-gray-500 hover:text-gray-800 shrink-0"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 truncate">
              {user?.name || 'RestaurantGo Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-orange-400 rounded-full flex items-center justify-center text-sm font-medium text-white">
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      <AssistantWidget />
      <ShiftGate />
    </div>
  );
}
