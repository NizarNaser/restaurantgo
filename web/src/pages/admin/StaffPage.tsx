import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';

interface StaffMember {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  position: string;
  department: string | null;
  base_salary: number;
  currency: string;
  hire_date: string;
  status: string;
  has_login: boolean;
  role: string | null;
  login_email: string | null;
  login_is_active: boolean | null;
}

const emptyForm = {
  name: '', email: '', phone: '', position: '', department: '',
  base_salary: '', currency: 'USD', hire_date: '', status: 'active',
  create_login: false, login_email: '', login_password: '', role: 'support_agent',
  login_is_active: true,
};

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchStaff = () => {
    setLoading(true);
    api.get('/admin/staff').then((res) => setStaff(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      position: s.position,
      department: s.department ?? '',
      base_salary: String(s.base_salary),
      currency: s.currency,
      hire_date: s.hire_date,
      status: s.status,
      create_login: false,
      login_email: s.login_email ?? '',
      login_password: '',
      role: s.role ?? 'support_agent',
      login_is_active: s.login_is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, base_salary: parseFloat(form.base_salary) || 0 };
      if (editingId) {
        await api.put(`/admin/staff/${editingId}`, payload);
      } else {
        await api.post('/admin/staff', payload);
      }
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ بيانات الموظف.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('حذف هذا الموظف؟')) return;
    await api.delete(`/admin/staff/${id}`);
    fetchStaff();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">موظفو الشركة</h1>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={18} className="ml-2" /> إضافة موظف</button>
      </div>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">الاسم</th>
              <th className="px-6 py-3">المنصب</th>
              <th className="px-6 py-3">القسم</th>
              <th className="px-6 py-3">الراتب الأساسي</th>
              <th className="px-6 py-3">الصلاحية</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">لا يوجد موظفون بعد.</td></tr>
            ) : staff.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                <td className="px-6 py-4 text-gray-600">{s.position}</td>
                <td className="px-6 py-4 text-gray-500">{s.department ?? '-'}</td>
                <td className="px-6 py-4 text-gray-600">{s.base_salary} {s.currency}</td>
                <td className="px-6 py-4">
                  {s.has_login ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600"><ShieldCheck size={14} /> {s.role}</span>
                  ) : <span className="text-xs text-gray-400">بدون دخول للنظام</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                </td>
                <td className="px-6 py-4 flex items-center gap-1">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); }} title={editingId ? 'تعديل موظف' : 'إضافة موظف'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input name="name" required placeholder="الاسم الكامل" className="input" value={form.name} onChange={handleChange} />
          <div className="grid grid-cols-2 gap-3">
            <input name="position" required placeholder="المنصب" className="input" value={form.position} onChange={handleChange} />
            <input name="department" placeholder="القسم" className="input" value={form.department} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="base_salary" type="number" required placeholder="الراتب الأساسي" className="input" value={form.base_salary} onChange={handleChange} />
            <input name="hire_date" type="date" required className="input" value={form.hire_date} onChange={handleChange} />
          </div>
          <input name="phone" placeholder="الهاتف (اختياري)" className="input" value={form.phone} onChange={handleChange} />
          <select name="status" className="input bg-white" value={form.status} onChange={handleChange}>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>

          {editingId && form.login_email ? (
            <div className="space-y-3 border-t border-gray-100 pt-3">
              <p className="text-sm font-medium text-gray-700">دخول لوحة تحكم الشركة</p>
              <input name="login_email" type="email" required placeholder="بريد الدخول" className="input" value={form.login_email} onChange={handleChange} />
              <input name="login_password" type="password" placeholder="كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" className="input" value={form.login_password} onChange={handleChange} />
              <select name="role" className="input bg-white" value={form.role} onChange={handleChange}>
                <option value="super_admin">مدير عام (كل الصلاحيات)</option>
                <option value="finance_manager">مسؤول مالي</option>
                <option value="support_agent">دعم فني</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="login_is_active" checked={form.login_is_active} onChange={handleChange} />
                الحساب مُفعّل (يمكنه تسجيل الدخول)
              </label>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="create_login" checked={form.create_login} onChange={handleChange} />
                منح هذا الموظف دخولًا للوحة تحكم الشركة
              </label>

              {form.create_login && (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <input name="login_email" type="email" required placeholder="بريد الدخول" className="input" value={form.login_email} onChange={handleChange} />
                  <input name="login_password" type="password" required placeholder="كلمة المرور" className="input" value={form.login_password} onChange={handleChange} />
                  <select name="role" className="input bg-white" value={form.role} onChange={handleChange}>
                    <option value="super_admin">مدير عام (كل الصلاحيات)</option>
                    <option value="finance_manager">مسؤول مالي</option>
                    <option value="support_agent">دعم فني</option>
                  </select>
                </div>
              )}
            </>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : 'حفظ'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
