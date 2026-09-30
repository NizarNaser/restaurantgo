import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import api from '../../api/axios';

interface PayrollRun {
  id: number;
  period_start: string;
  period_end: string;
  currency: string;
  status: string;
  total_net: number;
  staff_count: number;
}

export default function StaffPayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState({ period_start: '', period_end: '' });
  const [generating, setGenerating] = useState(false);

  const fetchRuns = () => {
    setLoading(true);
    api.get('/admin/staff-payroll').then((res) => setRuns(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRuns(); }, []);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await api.post('/admin/staff-payroll/run', form);
      setForm({ period_start: '', period_end: '' });
      fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر إنشاء كشف الرواتب.');
    } finally {
      setGenerating(false);
    }
  };

  const transition = async (id: number, action: 'approve' | 'pay') => {
    setBusyId(id);
    try {
      await api.post(`/admin/staff-payroll/${id}/${action}`);
      fetchRuns();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">رواتب الموظفين</h1>

      <form onSubmit={generate} className="mt-6 card p-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">بداية الفترة</label>
          <input type="date" required className="input" value={form.period_start} onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">نهاية الفترة</label>
          <input type="date" required className="input" value={form.period_end} onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))} />
        </div>
        <button type="submit" disabled={generating} className="btn btn-primary"><Plus size={16} className="ml-2" /> إنشاء كشف رواتب</button>
      </form>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">الفترة</th>
              <th className="px-6 py-3">عدد الموظفين</th>
              <th className="px-6 py-3">الإجمالي الصافي</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">لا توجد كشوف رواتب بعد.</td></tr>
            ) : runs.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-4 text-gray-900 font-medium">{r.period_start} → {r.period_end}</td>
                <td className="px-6 py-4 text-gray-600">{r.staff_count}</td>
                <td className="px-6 py-4 text-gray-600">{r.total_net.toLocaleString()} {r.currency}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    r.status === 'paid' ? 'bg-green-50 text-green-700' :
                    r.status === 'approved' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{r.status}</span>
                </td>
                <td className="px-6 py-4">
                  {r.status === 'draft' && (
                    <button onClick={() => transition(r.id, 'approve')} disabled={busyId === r.id} className="btn btn-outline">اعتماد</button>
                  )}
                  {r.status === 'approved' && (
                    <button onClick={() => transition(r.id, 'pay')} disabled={busyId === r.id} className="btn btn-primary">تحديد كمدفوع</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
