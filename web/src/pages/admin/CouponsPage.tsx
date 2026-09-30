import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import api from '../../api/axios';

interface Coupon {
  id: number;
  tenant_id: number | null;
  tenant: { id: number; name: string } | null;
  code: string;
  type: 'percent' | 'fixed';
  value: string | number;
  currency: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

interface FormState {
  code: string;
  type: 'percent' | 'fixed';
  value: string | number;
  currency: string;
  max_uses: string | number;
  expires_at: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  code: '',
  type: 'percent',
  value: '',
  currency: 'USD',
  max_uses: '',
  expires_at: '',
  is_active: true,
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchCoupons = () => {
    setLoading(true);
    api.get('/admin/coupons').then((res) => setCoupons(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCoupons(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      currency: coupon.currency ?? 'USD',
      max_uses: coupon.max_uses ?? '',
      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
      is_active: coupon.is_active,
    });
    setModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        max_uses: form.max_uses === '' ? null : Number(form.max_uses),
        expires_at: form.expires_at || null,
        currency: form.type === 'fixed' ? form.currency : null,
      };
      if (editingId) {
        await api.put(`/admin/coupons/${editingId}`, payload);
      } else {
        await api.post('/admin/coupons', payload);
      }
      setModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ الكوبون.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`حذف كوبون "${coupon.code}"؟`)) return;
    await api.delete(`/admin/coupons/${coupon.id}`);
    fetchCoupons();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">الكوبونات</h1>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={18} className="ml-2" /> إضافة كوبون</button>
      </div>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">الكود</th>
              <th className="px-6 py-3">القيمة</th>
              <th className="px-6 py-3">النطاق</th>
              <th className="px-6 py-3">الاستخدام</th>
              <th className="px-6 py-3">الانتهاء</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {coupons.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">لا توجد كوبونات بعد.</td></tr>
            ) : coupons.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4 font-mono font-medium text-gray-900">{c.code}</td>
                <td className="px-6 py-4 text-gray-600">
                  {c.type === 'percent' ? `${c.value}%` : `${c.value} ${c.currency}`}
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">{c.tenant?.name ?? 'كل المطاعم'}</td>
                <td className="px-6 py-4 text-gray-600">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                <td className="px-6 py-4 text-gray-500 text-xs">
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'بلا انتهاء'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {c.is_active ? 'فعّال' : 'متوقف'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingId ? 'تعديل الكوبون' : 'إضافة كوبون'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <input
                name="code"
                required
                placeholder="كود الكوبون"
                className="input uppercase"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <select name="type" className="input bg-white" value={form.type} onChange={handleChange}>
                  <option value="percent">نسبة مئوية %</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
                <input name="value" type="number" step="0.01" required placeholder="القيمة" className="input" value={form.value} onChange={handleChange} />
              </div>
              {form.type === 'fixed' && (
                <input name="currency" maxLength={3} placeholder="USD" className="input uppercase" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <input name="max_uses" type="number" placeholder="حد الاستخدام (اختياري)" className="input" value={form.max_uses} onChange={handleChange} />
                <input name="expires_at" type="date" className="input" value={form.expires_at} onChange={handleChange} />
              </div>
              <p className="text-xs text-gray-400">يُطبَّق على كل المطاعم ما لم يُخصَّص لمطعم واحد لاحقًا.</p>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} /> فعّال
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
