import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../api/axios';

interface Subscription {
  id: number;
  status: string;
  billing_interval: string;
  current_period_end: string | null;
  tenant?: { name: string };
  plan?: { name: string; price_monthly: number; price_yearly: number };
}

export default function PaymentsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/payments').then((res) => setSubs(res.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">الدفعات والاشتراكات</h1>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3">المطعم</th>
              <th className="px-6 py-3">الخطة</th>
              <th className="px-6 py-3">السعر</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">نهاية الفترة الحالية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {subs.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">لا توجد اشتراكات بعد.</td></tr>
            ) : subs.map((s) => (
              <tr key={s.id}>
                <td className="px-6 py-4 font-medium text-gray-900">{s.tenant?.name ?? '-'}</td>
                <td className="px-6 py-4 text-gray-600">{s.plan?.name ?? '-'}</td>
                <td className="px-6 py-4 text-gray-600">
                  ${s.billing_interval === 'monthly' ? s.plan?.price_monthly : s.plan?.price_yearly} / {s.billing_interval === 'monthly' ? 'شهر' : 'سنة'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{s.status}</span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
