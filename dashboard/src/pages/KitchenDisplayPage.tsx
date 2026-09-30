import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChefHat, Play, CheckCircle2, EyeOff, Loader2, Clock, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

/**
 * Fully self-contained login screen for a kitchen/bar kiosk — deliberately
 * not the dashboard's /login page or AuthLayout, so this screen never shares
 * UI with (or depends on) the admin dashboard at all.
 */
function KitchenLoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col items-center text-center gap-2 mb-2">
          <div className="bg-[#ff4757] p-3 rounded-xl text-white shadow-lg shadow-red-200">
            <ChefHat size={28} />
          </div>
          <h1 className="text-lg font-bold text-gray-900">{t('kds.title')}</h1>
          <p className="text-xs text-gray-400">{t('kds.signInDesc')}</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            className="input w-full"
            placeholder={t('kds.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            className="input w-full"
            placeholder={t('kds.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={isLoading} className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t('kds.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}

interface DepartmentOption {
  id: number;
  name: string;
  kds_enabled: boolean;
}

interface TicketItem {
  id: number;
  name: string;
  quantity: number;
  weight: string | null;
  notes: string | null;
  kitchen_status: 'pending' | 'preparing' | 'ready';
}

interface Ticket {
  order_id: number;
  batch_id: string | null;
  table_number: string | null;
  hall_name: string | null;
  customer_name: string | null;
  created_at: string;
  status: 'new' | 'preparing' | 'ready';
  items: TicketItem[];
}

/** One order can have several tickets (one per ordering round) open at once. */
function ticketKey(ticket: Pick<Ticket, 'order_id' | 'batch_id'>): string {
  return `${ticket.order_id}:${ticket.batch_id ?? ''}`;
}

const POLL_INTERVAL_MS = 8000;

/** Two short tones generated on the fly — no audio asset exists in this app yet. */
function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.25);
    });
  } catch {
    // Audio can fail silently (autoplay policies, unsupported browser) — never block the screen over it.
  }
}

function TicketCard({ ticket, onStart, onFinish, onCollect, busy }: {
  ticket: Ticket;
  onStart: () => void;
  onFinish: () => void;
  onCollect: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={`bg-white rounded-xl border-2 p-4 space-y-3 ${ticket.status === 'preparing' ? 'border-amber-300' : ticket.status === 'ready' ? 'border-emerald-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-gray-900">
            {ticket.table_number ? t('orders.tableNumber', { number: ticket.table_number }) : ticket.customer_name || t('kds.orderNumber', { id: ticket.order_id })}
          </p>
          {ticket.hall_name && <p className="text-xs text-gray-400">{ticket.hall_name}</p>}
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={12} /> {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {ticket.items.map((item) => (
          <div key={item.id} className="py-1.5 text-sm">
            <p className="text-gray-900 font-medium">{item.quantity}× {item.name}{item.weight && <span className="text-gray-400 font-normal"> ({item.weight})</span>}</p>
            {item.notes && <p className="text-xs text-amber-600">{item.notes}</p>}
          </div>
        ))}
      </div>

      {ticket.status === 'ready' ? (
        <button onClick={onCollect} disabled={busy} className="btn w-full text-sm flex items-center justify-center gap-2 bg-gray-100 text-gray-600 hover:bg-gray-200">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />} {t('kds.hide')}
        </button>
      ) : ticket.status === 'preparing' ? (
        <button onClick={onFinish} disabled={busy} className="btn btn-primary w-full text-sm flex items-center justify-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {t('kds.finish')}
        </button>
      ) : (
        <button onClick={onStart} disabled={busy} className="btn w-full text-sm flex items-center justify-center gap-2 bg-amber-100 text-amber-700 hover:bg-amber-200">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} {t('kds.start')}
        </button>
      )}
    </div>
  );
}

export default function KitchenDisplayPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const departmentId = searchParams.get('department');

  // Fully standalone screen — no link back into the dashboard anywhere on
  // this page, and no dependency on DashboardLayout/AuthLayout/the shared
  // /login route. It does its own auth/permission check and provides its
  // own login form and logout.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    // No navigate('/login') here on purpose — this screen shows its own
    // inline login form (KitchenLoginScreen) once isAuthenticated flips to
    // false, instead of bouncing out to the dashboard's login route.
    await logout();
  };

  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTicketKey, setBusyTicketKey] = useState<string | null>(null);
  const knownTicketKeys = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    api.get<DepartmentOption[]>('/kds/departments').then((res) => setDepartments(res.data));
  }, []);

  const fetchTickets = async () => {
    if (!departmentId) return;
    const res = await api.get<Ticket[]>(`/kds/departments/${departmentId}/tickets`);
    const currentKeys = new Set(res.data.map(ticketKey));

    if (!firstLoad.current) {
      const isNew = [...currentKeys].some((key) => !knownTicketKeys.current.has(key));
      if (isNew) playChime();
    }
    knownTicketKeys.current = currentKeys;
    firstLoad.current = false;

    setTickets(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!departmentId) return;
    firstLoad.current = true;
    setLoading(true);
    fetchTickets();
    const timer = setInterval(fetchTickets, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  const act = async (ticket: Ticket, action: 'start' | 'finish' | 'collect') => {
    setBusyTicketKey(ticketKey(ticket));
    try {
      await api.post(`/kds/departments/${departmentId}/orders/${ticket.order_id}/${action}`, null, {
        params: { batch_id: ticket.batch_id },
      });
      await fetchTickets();
    } finally {
      setBusyTicketKey(null);
    }
  };

  if (!isAuthenticated) {
    return <KitchenLoginScreen />;
  }

  if (!hasPermission('use kitchen display')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <ChefHat size={40} className="mx-auto text-gray-300" />
          <p className="text-gray-600">{t('kds.noAccess')}</p>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-500 flex items-center gap-1.5 mx-auto">
            <LogOut size={14} /> {t('nav.logout')}
          </button>
        </div>
      </div>
    );
  }

  if (!departmentId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex justify-end items-center gap-4 p-4">
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1.5">
            <LogOut size={12} /> {t('nav.logout')}
          </button>
        </div>
        <div className="max-w-md mx-auto py-16 text-center space-y-4 px-4">
          <ChefHat size={40} className="mx-auto text-[#ff4757]" />
          <h1 className="text-xl font-bold text-gray-900">{t('kds.chooseScreen')}</h1>
          <div className="space-y-2">
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => setSearchParams({ department: String(d.id) })}
                className="btn btn-secondary border border-gray-200 w-full"
              >
                {d.name}
              </button>
            ))}
            {departments.length === 0 && <p className="text-sm text-gray-400">{t('kds.noDepartmentsConfigured')}</p>}
          </div>
        </div>
      </div>
    );
  }

  const newTickets = tickets.filter((t) => t.status !== 'ready');
  const readyTickets = tickets.filter((t) => t.status === 'ready');
  const departmentName = departments.find((d) => String(d.id) === departmentId)?.name;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ChefHat className="text-[#ff4757]" size={22} /> {departmentName ?? t('kds.title')}
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/kds')} className="text-xs text-gray-400 hover:text-gray-600">{t('kds.switchScreen')}</button>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1.5">
            <LogOut size={12} /> {t('nav.logout')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="flex flex-col overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('kds.newCount', { count: newTickets.length })}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pb-4">
              {newTickets.map((ticket) => (
                <TicketCard
                  key={ticketKey(ticket)}
                  ticket={ticket}
                  busy={busyTicketKey === ticketKey(ticket)}
                  onStart={() => act(ticket, 'start')}
                  onFinish={() => act(ticket, 'finish')}
                  onCollect={() => act(ticket, 'collect')}
                />
              ))}
              {newTickets.length === 0 && <p className="text-sm text-gray-400 col-span-full">{t('kds.noNewTickets')}</p>}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('kds.readyCount', { count: readyTickets.length })}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto pb-4">
              {readyTickets.map((ticket) => (
                <TicketCard
                  key={ticketKey(ticket)}
                  ticket={ticket}
                  busy={busyTicketKey === ticketKey(ticket)}
                  onStart={() => act(ticket, 'start')}
                  onFinish={() => act(ticket, 'finish')}
                  onCollect={() => act(ticket, 'collect')}
                />
              ))}
              {readyTickets.length === 0 && <p className="text-sm text-gray-400 col-span-full">{t('kds.nothingReady')}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
