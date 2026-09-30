import { useEffect, useState } from 'react';
import { Loader2, Ban, CheckCircle2, LogIn } from 'lucide-react';
import api from '../../api/axios';

interface Tenant {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  trial_ends_at: string | null;
  plan?: { name: string };
}

const RESTAURANT_SITE_URL = import.meta.env.VITE_RESTAURANT_SITE_URL || 'http://localhost:5173';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);

  const fetchTenants = () => {
    setLoading(true);
    api.get('/admin/tenants').then((res) => setTenants(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTenants(); }, []);

  const toggleStatus = async (tenant: Tenant) => {
    setBusyId(tenant.id);
    try {
      const action = tenant.status === 'suspended' ? 'activate' : 'suspend';
      await api.put(`/admin/tenants/${tenant.id}/${action}`);
      fetchTenants();
    } finally {
      setBusyId(null);
    }
  };

  const openDashboard = async (tenant: Tenant) => {
    setImpersonatingId(tenant.id);
    try {
      const res = await api.post(`/admin/tenants/${tenant.id}/impersonate`);
      const { token } = res.data;
      window.open(`${RESTAURANT_SITE_URL}/impersonate?token=${encodeURIComponent(token)}`, '_blank');
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر الدخول إلى لوحة تحكم هذا المطعم.');
    } finally {
      setImpersonatingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">المطاعم المشتركة</h1>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">المطعم</th>
              <th className="px-6 py-3">الخطة</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">نهاية التجربة</th>
              <th className="px-6 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.subdomain}</p>
                </td>
                <td className="px-6 py-4 text-gray-600">{t.plan?.name ?? '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    t.status === 'active' ? 'bg-green-50 text-green-700' :
                    t.status === 'suspended' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
                  }`}>{t.status}</span>
                </td>
                <td className="px-6 py-4 text-gray-500">{t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-4 flex items-center gap-2">
                  <button
                    onClick={() => openDashboard(t)}
                    disabled={impersonatingId === t.id}
                    className="btn btn-outline"
                    title="الدخول إلى لوحة تحكم هذا المطعم"
                  >
                    {impersonatingId === t.id ? <Loader2 size={16} className="ml-2 animate-spin" /> : <LogIn size={16} className="ml-2" />}
                    الدخول للوحة التحكم
                  </button>
                  <button
                    onClick={() => toggleStatus(t)}
                    disabled={busyId === t.id}
                    className={`btn ${t.status === 'suspended' ? 'btn-outline' : 'btn-outline text-red-600'}`}
                  >
                    {t.status === 'suspended'
                      ? <><CheckCircle2 size={16} className="ml-2" /> تفعيل</>
                      : <><Ban size={16} className="ml-2" /> تعليق</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
