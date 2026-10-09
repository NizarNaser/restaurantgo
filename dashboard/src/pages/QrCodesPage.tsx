import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, QrCode as QrCodeIcon, Plus, Trash2, Printer, ScanLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface Branch {
  id: number;
  name: string;
  city: string | null;
}

interface QrCodeRecord {
  id: number;
  type: 'menu' | 'item' | 'table';
  branch_id: number | null;
  table_number: string | null;
  target_url: string;
  scan_count: number;
}

export default function QrCodesPage() {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<QrCodeRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<number | ''>('');
  const [tableNumber, setTableNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [codesRes, branchesRes] = await Promise.all([
        api.get<QrCodeRecord[]>('/qr-codes'),
        api.get<Branch[]>('/branches'),
      ]);
      setCodes(codesRes.data);
      setBranches(branchesRes.data);
      setBranchId((prev) => prev || branchesRes.data[0]?.id || '');
    } catch (err) {
      console.error('Failed to load QR codes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Wait for the #printable-content id to land on the chosen card before
  // triggering the browser print dialog, so window.print() doesn't fire
  // on a render where no element matches the print CSS yet.
  useEffect(() => {
    if (printingId === null) return;
    window.print();
    setPrintingId(null);
  }, [printingId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !tableNumber.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.post<QrCodeRecord>('/qr-codes', {
        type: 'table',
        branch_id: branchId,
        table_number: tableNumber.trim(),
      });
      setCodes((prev) => [res.data, ...prev]);
      setTableNumber('');
    } catch (err: any) {
      setError(err.response?.data?.message || t('qrCodes.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('qrCodes.deleteConfirm'))) return;
    await api.delete(`/qr-codes/${id}`);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  const branchName = (id: number | null) => branches.find((b) => b.id === id)?.name ?? '—';

  const tableCodes = codes.filter((c) => c.type === 'table');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('qrCodes.title')}</h2>
        <p className="text-sm text-gray-500">
          {t('qrCodes.subtitle')}
        </p>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('qrCodes.branch')}</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')}
            className="input bg-white min-w-[180px]"
          >
            {branches.length === 0 && <option value="">{t('qrCodes.noBranchesYet')}</option>}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.city ? ` — ${b.city}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('qrCodes.tableNumber')}</label>
          <input
            type="text"
            required
            placeholder={t('qrCodes.tableNumberPlaceholder')}
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="input w-32"
          />
        </div>
        <button type="submit" disabled={creating || !branchId} className="btn btn-primary flex items-center gap-2">
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {t('qrCodes.addTableQr')}
        </button>
        {error && <p className="text-sm text-red-500 w-full">{error}</p>}
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#ff4757]" size={32} />
          </div>
        ) : tableCodes.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <QrCodeIcon size={32} className="mx-auto mb-3 text-gray-300" />
            {t('qrCodes.noCodesYet')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
            {tableCodes.map((code) => (
              <div key={code.id} className="border border-gray-100 rounded-xl p-4 flex flex-col items-center text-center gap-2">
                <div id={printingId === code.id ? 'printable-content' : undefined} className="flex flex-col items-center gap-2">
                  <div className="p-2 bg-white border border-gray-200 rounded-lg">
                    {/* Encode the scan-tracking redirect, not target_url directly,
                        so scan_count actually increments on a real scan. */}
                    <QRCodeSVG value={`${API_URL}/v1/qr/${code.id}`} size={120} level="H" />
                  </div>
                  <p className="font-semibold text-gray-900">{t('orders.tableNumber', { number: code.table_number })}</p>
                  <p className="text-xs text-gray-400">{branchName(code.branch_id)}</p>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <ScanLine size={12} /> {t('qrCodes.scansCount', { count: code.scan_count })}
                </p>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setPrintingId(code.id)} className="btn btn-secondary border border-gray-200 text-xs px-3 py-1.5 flex items-center gap-1">
                    <Printer size={13} /> {t('common.print')}
                  </button>
                  <button onClick={() => handleDelete(code.id)} className="p-1.5 text-gray-400 hover:text-red-500" aria-label={t('common.delete')}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
