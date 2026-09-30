import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import api from '../../api/axios';

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: string | number;
  price_yearly: string | number;
  currency: string;
  max_branches: number | null;
  max_menu_items: number | null;
  max_users: number | null;
  has_custom_domain: boolean;
  has_white_label: boolean;
  has_advanced_reports: boolean;
  has_api_access: boolean;
  has_qr_ordering: boolean;
  is_active: boolean;
  sort_order: number | null;
}

type FormState = Omit<Plan, 'id' | 'slug'>;

const emptyForm: FormState = {
  name: '',
  description: '',
  price_monthly: '',
  price_yearly: '',
  currency: 'USD',
  max_branches: null,
  max_menu_items: null,
  max_users: null,
  has_custom_domain: false,
  has_white_label: false,
  has_advanced_reports: false,
  has_api_access: false,
  has_qr_ordering: false,
  is_active: true,
  sort_order: 0,
};

const FEATURE_FLAGS: { key: keyof FormState; label: string }[] = [
  { key: 'has_custom_domain', label: 'نطاق مخصص' },
  { key: 'has_white_label', label: 'علامة تجارية بيضاء' },
  { key: 'has_advanced_reports', label: 'تقارير متقدمة' },
  { key: 'has_api_access', label: 'وصول API' },
  { key: 'has_qr_ordering', label: 'طلب عبر QR' },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchPlans = () => {
    setLoading(true);
    api.get('/admin/plans').then((res) => setPlans(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      currency: plan.currency,
      max_branches: plan.max_branches,
      max_menu_items: plan.max_menu_items,
      max_users: plan.max_users,
      has_custom_domain: plan.has_custom_domain,
      has_white_label: plan.has_white_label,
      has_advanced_reports: plan.has_advanced_reports,
      has_api_access: plan.has_api_access,
      has_qr_ordering: plan.has_qr_ordering,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
    setModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/admin/plans/${editingId}`, form);
      } else {
        await api.post('/admin/plans', form);
      }
      setModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ الخطة.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`حذف خطة "${plan.name}"؟`)) return;
    try {
      await api.delete(`/admin/plans/${plan.id}`);
      fetchPlans();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حذف الخطة.');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">خطط الاشتراك</h1>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={18} className="ml-2" /> إضافة خطة</button>
      </div>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">الاسم</th>
              <th className="px-6 py-3">السعر الشهري</th>
              <th className="px-6 py-3">السعر السنوي</th>
              <th className="px-6 py-3">الحدود</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">لا توجد خطط بعد.</td></tr>
            ) : plans.map((plan) => (
              <tr key={plan.id}>
                <td className="px-6 py-4 font-medium text-gray-900">{plan.name}</td>
                <td className="px-6 py-4 text-gray-600">{plan.price_monthly} {plan.currency}</td>
                <td className="px-6 py-4 text-gray-600">{plan.price_yearly} {plan.currency}</td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                  {plan.max_branches ?? '∞'} فروع · {plan.max_menu_items ?? '∞'} صنف · {plan.max_users ?? '∞'} مستخدم
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {plan.is_active ? 'فعّالة' : 'متوقفة'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(plan)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(plan)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingId ? 'تعديل الخطة' : 'إضافة خطة'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <input name="name" required placeholder="اسم الخطة" className="input" value={form.name} onChange={handleChange} />
              <textarea name="description" placeholder="وصف مختصر (اختياري)" rows={2} className="input" value={form.description ?? ''} onChange={handleChange} />
              <div className="grid grid-cols-3 gap-3">
                <input name="price_monthly" type="number" step="0.01" required placeholder="السعر الشهري" className="input" value={form.price_monthly} onChange={handleChange} />
                <input name="price_yearly" type="number" step="0.01" required placeholder="السعر السنوي" className="input" value={form.price_yearly} onChange={handleChange} />
                <input name="currency" required maxLength={3} placeholder="USD" className="input uppercase" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input name="max_branches" type="number" placeholder="حد الفروع" className="input" value={form.max_branches ?? ''} onChange={handleChange} />
                <input name="max_menu_items" type="number" placeholder="حد الأصناف" className="input" value={form.max_menu_items ?? ''} onChange={handleChange} />
                <input name="max_users" type="number" placeholder="حد المستخدمين" className="input" value={form.max_users ?? ''} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_FLAGS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(form[f.key])}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} /> فعّالة
              </label>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : 'حفظ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
