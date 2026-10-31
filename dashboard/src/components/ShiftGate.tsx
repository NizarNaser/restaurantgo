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
  // Subscribes to the permission itself, not the stable hasPermission function:
  // `user` is still null on the first render after an app restart.
  const canManageShifts = useAuthStore((s) => s.hasPermission('manage shifts'));
  const [shift, setShift] = useState<Shift | null>(null);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  // Rechecked on every navigation, since this outlives the pages that change
  // the answer — a shift opened or closed on /shifts, or on another device.
  // A failed check leaves checkedPath unset, so a hiccup never prompts.
  useEffect(() => {
    if (!canManageShifts || !isRelevantPage || dismissed) return;
    let isStale = false;
    api.get<Shift>('/shifts/current')
      .then((res) => {
        if (isStale) return;
        setShift(res.data?.id ? res.data : null);
        setCheckedPath(location.pathname);
      })
      .catch(() => {});
    return () => { isStale = true; };
  }, [canManageShifts, isRelevantPage, dismissed, location.pathname]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const res = await api.post<Shift>('/shifts/open', {});
      setShift(res.data);
    } catch {
      setDismissed(true);
    } finally {
      setOpening(false);
    }
  };

  if (!isRelevantPage || !canManageShifts || checkedPath !== location.pathname || shift || dismissed) return null;

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
