import { useEffect, useState } from 'react';
import { DollarSign, Users, Utensils, LayoutGrid, Loader2, QrCode, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

interface Stats {
  tenant_slug: string;
  tenant_name: string;
  public_url: string;
  menu_items_count: number;
  categories_count: number;
  active_employees: number;
  total_employees: number;
  monthly_salary_cost: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Straight to table selection, not the customer-facing menu root — a
  // logged-in staff member previewing their own site is always testing the
  // dine-in flow, so the delivery-vs-dine-in prompt (which only ever renders
  // on the menu root) would just be in the way here.
  const publicMenuUrl = stats?.public_url ? `${stats.public_url}/halls` : null;

  const cards = [
    {
      label: t('dashboard.menuItems'),
      value: stats?.menu_items_count ?? 0,
      icon: Utensils,
      color: 'text-[#ff4757]',
      bg: 'bg-red-50',
      sub: t('dashboard.inCategories', { count: stats?.categories_count ?? 0 }),
      link: '/menu',
    },
    {
      label: t('dashboard.activeEmployees'),
      value: stats?.active_employees ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: t('dashboard.outOfTotal', { count: stats?.total_employees ?? 0 }),
      link: '/hr',
    },
    {
      label: t('dashboard.categories'),
      value: stats?.categories_count ?? 0,
      icon: LayoutGrid,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      sub: t('dashboard.menuCategories'),
      link: '/menu',
    },
    {
      label: t('dashboard.monthlySalaries'),
      value: `$${(stats?.monthly_salary_cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
      sub: t('dashboard.activeStaffCost'),
      link: '/hr',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {stats?.tenant_name ?? 'Dashboard'}
          </h2>
          <p className="text-gray-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        {publicMenuUrl && (
          <a
            href={publicMenuUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff4757] text-white text-sm font-medium hover:bg-red-600 transition-colors"
          >
            <ExternalLink size={16} />
            {t('dashboard.viewPublicMenu')}
          </a>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => (
          <Link key={i} to={card.link} className="card p-6 flex flex-col gap-3 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{card.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
                <card.icon size={22} />
              </div>
            </div>
            <p className="text-xs text-gray-400">{card.sub}</p>
          </Link>
        ))}
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code Card */}
        <div className="card p-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded-xl">
            <QrCode size={48} className="text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-lg">{t('dashboard.yourMenuQr')}</h3>
            <p className="text-gray-500 text-sm mt-1">{t('dashboard.printQrDesc')}</p>
          </div>
          <Link to="/menu?qr=1" className="btn btn-primary w-full">
            {t('dashboard.viewQrCode')}
          </Link>
        </div>

        {/* Quick Links */}
        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('dashboard.quickActions')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('dashboard.addMenuItem'), desc: t('dashboard.addMenuItemDesc'), to: '/menu', color: 'bg-red-50 text-[#ff4757] hover:bg-red-100' },
              { label: t('dashboard.addEmployee'), desc: t('dashboard.addEmployeeDesc'), to: '/hr', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
              { label: t('dashboard.addCategory'), desc: t('dashboard.addCategoryDesc'), to: '/menu', color: 'bg-purple-50 text-purple-600 hover:bg-purple-100' },
              { label: t('dashboard.viewPublicMenu'), desc: t('dashboard.viewPublicMenuDesc'), to: publicMenuUrl ?? '/menu', color: 'bg-green-50 text-green-600 hover:bg-green-100', external: !!publicMenuUrl },
            ].map((item, i) => (
              item.external ? (
                <a
                  key={i}
                  href={item.to}
                  target="_blank"
                  rel="noreferrer"
                  className={`p-4 rounded-xl transition-colors ${item.color}`}
                >
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{item.desc}</p>
                </a>
              ) : (
                <Link key={i} to={item.to} className={`p-4 rounded-xl transition-colors ${item.color}`}>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{item.desc}</p>
                </Link>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
