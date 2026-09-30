import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '../../api/axios';

interface AuditLogEntry {
  id: number;
  tenant: { id: number; name: string; slug: string } | null;
  user: { id: number; name: string; email: string } | null;
  action: string;
  model_type: string;
  model_id: number;
  created_at: string;
}

interface PaginatedResponse {
  data: AuditLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

function modelName(modelType: string) {
  return modelType.split('\\').pop() ?? modelType;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = () => {
    setLoading(true);
    api
      .get<PaginatedResponse>('/admin/audit-logs', { params: { action: action || undefined, page } })
      .then((res) => {
        setLogs(res.data.data);
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchLogs, [action, page]);

  return (
    <div>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل التدقيق</h1>
          <p className="text-sm text-gray-500 mt-1">{total} إجراء مسجَّل عبر كل المطاعم والمنصة</p>
        </div>
      </div>

      <div className="mt-4 relative w-72">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={action}
          onChange={(e) => { setPage(1); setAction(e.target.value); }}
          placeholder="ابحث حسب الإجراء (مثل revenue.created)"
          className="input pr-9"
        />
      </div>

      <div className="mt-4 card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">الوقت</th>
                <th className="px-6 py-3">الإجراء</th>
                <th className="px-6 py-3">المطعم</th>
                <th className="px-6 py-3">المستخدم</th>
                <th className="px-6 py-3">السجلّ المتأثر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">لا توجد سجلات مطابقة.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-800">{log.action}</td>
                  <td className="px-6 py-4 text-gray-600">{log.tenant?.name ?? <span className="text-gray-400">منصة</span>}</td>
                  <td className="px-6 py-4 text-gray-600">{log.user?.name ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{modelName(log.model_type)} #{log.model_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-gray-500">صفحة {page} من {lastPage}</span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
