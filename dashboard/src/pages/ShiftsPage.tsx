import { useEffect, useState } from 'react';
import { Loader2, PlayCircle, StopCircle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

interface Shift {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opening_notes: string | null;
  closing_notes: string | null;
  opened_by?: { name: string } | null;
  closed_by?: { name: string } | null;
}

interface ShiftSummary {
  orders_count: number;
  total_sales: string;
}

export default function ShiftsPage() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [openingNotes, setOpeningNotes] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [summaries, setSummaries] = useState<Record<number, ShiftSummary>>({});

  const fetchAll = async () => {
    const [currentRes, historyRes] = await Promise.all([
      api.get<Shift>('/shifts/current'),
      api.get('/shifts'),
    ]);
    setCurrent(currentRes.data?.id ? currentRes.data : null);
    setHistory(historyRes.data.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const loadSummary = async (shift: Shift) => {
    if (summaries[shift.id]) return;
    const res = await api.get(`/shifts/${shift.id}/summary`);
    setSummaries((prev) => ({ ...prev, [shift.id]: res.data }));
  };

  const handleOpen = async () => {
    setOpening(true);
    try {
      await api.post('/shifts/open', { opening_notes: openingNotes || undefined });
      setShowOpenModal(false);
      setOpeningNotes('');
      await fetchAll();
    } finally {
      setOpening(false);
    }
  };

  const handleClose = async () => {
    if (!current) return;
    setClosing(true);
    try {
      await api.post(`/shifts/${current.id}/close`, { closing_notes: closingNotes || undefined });
      setShowCloseModal(false);
      setClosingNotes('');
      await fetchAll();
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Clock className="text-[#ff4757]" size={24} /> {t('shifts.title')}
        </h2>
        <p className="text-sm text-gray-500">{t('shifts.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {current ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                <PlayCircle size={16} /> {t('shifts.shiftOpen')}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t('shifts.opened')} {new Date(current.opened_at).toLocaleString()}{current.opened_by ? ` ${t('shifts.by')} ${current.opened_by.name}` : ''}</p>
            </div>
            <button onClick={() => setShowCloseModal(true)} className="btn text-sm flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100">
              <StopCircle size={14} /> {t('shifts.closeShift')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{t('shifts.noShiftOpen')}</p>
            <button onClick={() => setShowOpenModal(true)} className="btn btn-primary text-sm flex items-center gap-2">
              <PlayCircle size={14} /> {t('shifts.openShift')}
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('shifts.history')}</h3>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {history.map((shift) => (
            <div key={shift.id} className="px-4 py-3">
              <button className="w-full flex items-center justify-between text-left" onClick={() => loadSummary(shift)}>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {new Date(shift.opened_at).toLocaleDateString()} · {new Date(shift.opened_at).toLocaleTimeString()}
                    {shift.closed_at && ` — ${new Date(shift.closed_at).toLocaleTimeString()}`}
                  </p>
                  <p className="text-xs text-gray-400">{shift.opened_by?.name ?? '—'}{shift.closed_by ? ` ${t('shifts.closedByArrow')} ${shift.closed_by.name}` : ''}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${shift.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {t(`shifts.status.${shift.status}`)}
                </span>
              </button>
              {summaries[shift.id] && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('shifts.summaryLine', { count: summaries[shift.id].orders_count, total: parseFloat(summaries[shift.id].total_sales).toFixed(2) })}
                </p>
              )}
            </div>
          ))}
          {history.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">{t('shifts.noShiftsRecorded')}</p>}
        </div>
      </div>

      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title={t('shifts.openThisShift')}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('shifts.openExplain')}</p>
          <textarea
            placeholder={t('shifts.openingNotesPlaceholder')}
            className="input w-full text-sm"
            rows={3}
            value={openingNotes}
            onChange={(e) => setOpeningNotes(e.target.value)}
          />
          <button onClick={handleOpen} disabled={opening} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {opening ? <Loader2 size={16} className="animate-spin" /> : t('shifts.confirmOpen')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title={t('shifts.closeThisShift')}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('shifts.closeWarning')}</p>
          <textarea
            placeholder={t('shifts.closingNotesPlaceholder')}
            className="input w-full text-sm"
            rows={3}
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
          />
          <button onClick={handleClose} disabled={closing} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {closing ? <Loader2 size={16} className="animate-spin" /> : t('shifts.confirmClose')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
