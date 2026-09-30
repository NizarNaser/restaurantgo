import { useEffect, useState } from 'react';
import { Loader2, LogIn, LogOut } from 'lucide-react';
import api from '../../api/axios';

interface StaffMember { id: number; name: string; }
interface AttendanceRecord {
  id: number;
  check_in: string;
  check_out: string | null;
  staff?: { name: string };
}

export default function StaffAttendancePage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/staff'),
      api.get('/admin/staff-attendance'),
    ]).then(([staffRes, recordsRes]) => {
      setStaff(staffRes.data);
      setRecords(recordsRes.data.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const checkin = async () => {
    if (!selectedStaff) return;
    setBusy(true);
    try {
      await api.post('/admin/staff-attendance/checkin', { staff_id: selectedStaff });
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تسجيل الحضور.');
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!selectedStaff) return;
    setBusy(true);
    try {
      await api.post('/admin/staff-attendance/checkout', { staff_id: selectedStaff });
      fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر تسجيل الانصراف.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">دوام الموظفين</h1>

      <div className="mt-6 card p-6 flex flex-wrap items-center gap-3">
        <select className="input bg-white sm:w-64" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
          <option value="">اختر موظفًا...</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={checkin} disabled={busy || !selectedStaff} className="btn btn-primary"><LogIn size={16} className="ml-2" /> تسجيل حضور</button>
        <button onClick={checkout} disabled={busy || !selectedStaff} className="btn btn-outline"><LogOut size={16} className="ml-2" /> تسجيل انصراف</button>
      </div>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">الموظف</th>
              <th className="px-6 py-3">وقت الحضور</th>
              <th className="px-6 py-3">وقت الانصراف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-400">لا توجد سجلات دوام بعد.</td></tr>
            ) : records.map((r) => (
              <tr key={r.id}>
                <td className="px-6 py-4 font-medium text-gray-900">{r.staff?.name ?? '-'}</td>
                <td className="px-6 py-4 text-gray-600">{new Date(r.check_in).toLocaleString()}</td>
                <td className="px-6 py-4 text-gray-500">{r.check_out ? new Date(r.check_out).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
