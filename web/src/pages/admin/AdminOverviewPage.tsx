import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import api from '../../api/axios';

interface Metrics {
  tenants_total: number;
  tenants_active: number;
  tenants_suspended: number;
  tenants_on_trial: number;
  subscriptions_active: number;
  mrr: number;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api.get('/admin/metrics').then((res) => setMetrics(res.data)).catch(() => {});
  }, []);

  const cards = metrics ? [
    { label: 'إجمالي المطاعم', value: metrics.tenants_total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'مطاعم نشطة', value: metrics.tenants_active, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'في الفترة التجريبية', value: metrics.tenants_on_trial, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'الإيراد الشهري المتكرر (MRR)', value: `$${metrics.mrr.toLocaleString()}`, icon: DollarSign, color: 'text-[var(--color-primary)]', bg: 'bg-red-50' },
  ] : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">نظرة عامة</h1>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-6">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">{c.label}</p>
              <div className={`p-2.5 rounded-xl ${c.bg} ${c.color}`}>
                <c.icon size={20} />
              </div>
            </div>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
