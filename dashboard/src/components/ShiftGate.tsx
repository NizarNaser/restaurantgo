import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, PlayCircle } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

interface Shift {
  id: number;
  status: 'open' | 'closed';
}

// Opening a shift only matters for pages tied to today's sales — prompting
// for it on back-office/config pages (Settings, Billing, HR, ...) has
// nothing to do with the page the user is on, and its full-screen overlay
// would block them from using it for no reason.
const SHIFT_RELEVANT_PATHS = ['/dashboard', '/orders', '/halls', '/reservations', '/tables'];

/**
 * A gentle, dismissible nudge — never blocks staff from working tables while
 * it loads or if the check fails, per the "never lock people out over a shift
 * hiccup" policy. Only owners/managers (who can actually open one) see it.
 */
export default function ShiftGate() {
  const location = useLocation();
  const isRelevantPage = SHIFT_RELEVANT_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [shift, setShift] = useState<Shift | null>(null);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!hasPermission('manage shifts')) return;
    api.get<Shift>('/shifts/current')
      .then((res) => setShift(res.data?.id ? res.data : null))
      .catch(() => {})
      .finally(() => setChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = async () => {
    setOpening(true);
    try {
      await api.post('/shifts/open', {});
      setDismissed(true);
    } catch {
      setDismissed(true);
    } finally {
      setOpening(false);
    }
  };

  if (!isRelevantPage || !hasPermission('manage shifts') || !checked || shift || dismissed) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
        <PlayCircle size={32} className="mx-auto text-[#ff4757]" />
        <h3 className="text-lg font-bold text-gray-900">Start a new shift?</h3>
        <p className="text-sm text-gray-500">No work shift is currently open. Opening one groups today's sales together for reporting.</p>
        <div className="flex gap-2">
          <button onClick={() => setDismissed(true)} className="btn btn-secondary border border-gray-200 flex-1">Not now</button>
          <button onClick={handleOpen} disabled={opening} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
            {opening ? <Loader2 size={16} className="animate-spin" /> : 'Start shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
