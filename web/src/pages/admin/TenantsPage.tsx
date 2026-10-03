import { useEffect, useState } from 'react';
import { Loader2, Ban, CheckCircle2, LogIn, Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '../../api/axios';

interface Plan {
  id: number;
  name: string;
  is_active: boolean;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  subdomain: string;
  status: string;
  trial_ends_at: string | null;
  plan?: { id: number; name: string };
}

const RESTAURANT_SITE_URL = import.meta.env.VITE_RESTAURANT_SITE_URL || 'http://localhost:5173';

const emptyCreateForm = {
  restaurant_name: '',
  subdomain: '',
  plan_id: '',
  owner_name: '',
  owner_email: '',
  owner_password: '',
  owner_password_confirmation: '',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [planChangeTenant, setPlanChangeTenant] = useState<Tenant | null>(null);
  const [planChangeValue, setPlanChangeValue] = useState('');
  const [changingPlan, setChangingPlan] = useState(false);

  const [deleteTenant, setDeleteTenant] = useState<Tenant | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchTenants = () => {
    setLoading(true);
    api.get('/admin/tenants').then((res) => setTenants(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenants();
    api.get('/admin/plans').then((res) => setPlans(res.data.filter((p: Plan) => p.is_active)));
  }, []);

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

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/admin/tenants', createForm);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      fetchTenants();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'تعذر إنشاء المطعم.');
    } finally {
      setCreating(false);
    }
  };

  const openDelete = (tenant: Tenant) => {
    setDeleteTenant(tenant);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTenant) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/tenants/${deleteTenant.id}`, { data: { confirm_subdomain: deleteConfirmText } });
      setDeleteTenant(null);
      fetchTenants();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'تعذر حذف هذا المطعم.');
    } finally {
      setDeleting(false);
    }
  };

  const openPlanChange = (tenant: Tenant) => {
    setPlanChangeTenant(tenant);
    setPlanChangeValue(String(tenant.plan?.id ?? ''));
  };

  const handlePlanChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planChangeTenant || !planChangeValue) return;
    setChangingPlan(true);
    try {
      await api.put(`/admin/tenants/${planChangeTenant.id}/plan`, { plan_id: Number(planChangeValue) });
      setPlanChangeTenant(null);
      fetchTenants();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تغيير خطة هذا المطعم.');
    } finally {
      setChangingPlan(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">المطاعم المشتركة</h1>
        <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
          <Plus size={18} className="ml-2" /> إضافة مطعم
        </button>
      </div>

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
                    onClick={() => openPlanChange(t)}
                    className="btn btn-outline"
                    title="تبديل خطة هذا المطعم"
                  >
                    <RefreshCw size={16} className="ml-2" />
                    تبديل الخطة
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
                  <button
                    onClick={() => openDelete(t)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="حذف هذا المطعم نهائياً"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold">إضافة مطعم</h2>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-3">
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <input name="restaurant_name" required placeholder="اسم المطعم" className="input" value={createForm.restaurant_name} onChange={handleCreateChange} />
              <input name="subdomain" required placeholder="النطاق الفرعي (subdomain)" className="input" value={createForm.subdomain} onChange={handleCreateChange} />
              <select name="plan_id" required className="input" value={createForm.plan_id} onChange={handleCreateChange}>
                <option value="" disabled>اختر الخطة</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <hr className="border-gray-100" />
              <input name="owner_name" required placeholder="اسم صاحب المطعم" className="input" value={createForm.owner_name} onChange={handleCreateChange} />
              <input name="owner_email" type="email" required placeholder="البريد الإلكتروني" className="input" value={createForm.owner_email} onChange={handleCreateChange} />
              <input name="owner_password" type="password" required placeholder="كلمة المرور" className="input" value={createForm.owner_password} onChange={handleCreateChange} />
              <input name="owner_password_confirmation" type="password" required placeholder="تأكيد كلمة المرور" className="input" value={createForm.owner_password_confirmation} onChange={handleCreateChange} />
              <p className="text-xs text-gray-400">سيبدأ المطعم مفعّلاً مباشرة على الخطة المختارة دون الحاجة لعملية دفع.</p>
              <button type="submit" disabled={creating} className="btn btn-primary w-full">
                {creating ? <Loader2 size={18} className="animate-spin" /> : 'إنشاء المطعم'}
              </button>
            </form>
          </div>
        </div>
      )}

      {planChangeTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold">تبديل خطة {planChangeTenant.name}</h2>
              <button onClick={() => setPlanChangeTenant(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handlePlanChangeSubmit} className="p-6 space-y-3">
              <select required className="input" value={planChangeValue} onChange={(e) => setPlanChangeValue(e.target.value)}>
                <option value="" disabled>اختر الخطة الجديدة</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <p className="text-xs text-gray-400">سيتم تفعيل الخطة الجديدة فوراً دون الحاجة لعملية دفع.</p>
              <button type="submit" disabled={changingPlan} className="btn btn-primary w-full">
                {changingPlan ? <Loader2 size={18} className="animate-spin" /> : 'تأكيد التبديل'}
              </button>
            </form>
          </div>
        </div>
      )}

      {deleteTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-red-600">حذف {deleteTenant.name}</h2>
              <button onClick={() => setDeleteTenant(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleDeleteSubmit} className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                هذا إجراء نهائي لا يمكن التراجع عنه. سيتم إلغاء اشتراك الدفع الفعلي (إن وجد) وإلغاء تفعيل المطعم بالكامل.
              </p>
              <label className="block text-xs font-medium text-gray-700">
                اكتب <span className="font-mono">{deleteTenant.subdomain}</span> للتأكيد
              </label>
              <input
                type="text"
                required
                className="input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
              {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
              <button
                type="submit"
                disabled={deleting || deleteConfirmText !== deleteTenant.subdomain}
                className="btn w-full justify-center text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={18} className="animate-spin" /> : 'حذف المطعم نهائياً'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
