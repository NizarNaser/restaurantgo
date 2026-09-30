import { useEffect } from 'react';
import { Outlet, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, LayoutDashboard, Building2, CreditCard, Layers, Ticket, UserCog, Clock, Wallet, Megaphone, Mail, ScrollText, LogOut, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAdminAuthStore } from '../store/adminAuthStore';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout, hasPermission, fetchUser } = useAdminAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { to: '/admin', label: t('adminNav.overview'), icon: LayoutDashboard, permission: null },
    { to: '/admin/tenants', label: t('adminNav.tenants'), icon: Building2, permission: 'manage tenants' },
    { to: '/admin/payments', label: t('adminNav.payments'), icon: CreditCard, permission: 'manage payments' },
    { to: '/admin/plans', label: t('adminNav.plans'), icon: Layers, permission: 'manage plans' },
    { to: '/admin/coupons', label: t('adminNav.coupons'), icon: Ticket, permission: 'manage coupons' },
    { to: '/admin/staff', label: t('adminNav.staff'), icon: UserCog, permission: 'manage staff' },
    { to: '/admin/staff/attendance', label: t('adminNav.attendance'), icon: Clock, permission: 'manage staff' },
    { to: '/admin/staff/payroll', label: t('adminNav.payroll'), icon: Wallet, permission: 'manage staff' },
    { to: '/admin/advertisements', label: t('adminNav.advertisements'), icon: Megaphone, permission: 'manage advertisements' },
    { to: '/admin/contact-messages', label: t('adminNav.contactMessages'), icon: Mail, permission: 'manage contact messages' },
    { to: '/admin/audit-logs', label: t('adminNav.auditLogs'), icon: ScrollText, permission: 'view audit logs' },
    { to: '/admin/seo', label: t('adminNav.seo'), icon: Globe, permission: 'manage platform settings' },
  ];

  // The zustand store only holds `user` (roles/permissions) in memory — it
  // reads the token from localStorage on init but not the profile behind it,
  // so a hard refresh leaves `isAuthenticated` true with `user` still null.
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchUser();
    }
  }, [isAuthenticated, user, fetchUser]);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const visibleNavItems = navItems.filter((item) => !item.permission || hasPermission(item.permission));

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white border-e border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="bg-[var(--color-primary)] p-2 rounded-lg text-white">
            <ChefHat size={24} />
          </div>
          <div>
            <span className="block text-lg font-bold text-gray-800">RestaurantGo</span>
            <span className="block text-xs text-gray-500">{t('adminNav.panelSubtitle')}</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isActive ? 'bg-red-50 text-[var(--color-primary)]' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-[var(--color-primary)]' : 'text-gray-500'} />
                {item.label}
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
            {t('adminNav.logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-lg font-semibold text-gray-800">{user?.name || t('adminNav.panelSubtitle')}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-orange-400 rounded-full flex items-center justify-center text-sm font-medium text-white">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
