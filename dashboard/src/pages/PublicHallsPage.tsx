import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, LogOut, Loader2, Armchair } from 'lucide-react';
import { getStoredPublicLocale } from '../lib/publicLocale';
import { useAuthStore } from '../store/authStore';
import { usePublicSlug } from '../hooks/usePublicSlug';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

interface HallRecord {
  id: number;
  name: string;
  sort_order: number;
}

interface PublicTable {
  id: number;
  hall_id: number;
  table_number: string;
  shape: 'round' | 'square' | 'rect';
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  status: 'vacant' | 'occupied';
  qr_code_id: number | null;
}

const POLL_INTERVAL_MS = 15000;

function TableBox({ table, onClick }: { table: PublicTable; onClick: () => void }) {
  const isOccupied = table.status === 'occupied';
  const isClickable = table.qr_code_id != null;
  const style: CSSProperties = {
    position: 'absolute', left: table.pos_x, top: table.pos_y, width: table.width, height: table.height,
  };

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={onClick}
      style={style}
      className={`border-4 flex items-center justify-center text-sm font-bold select-none shadow-sm ${
        isClickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
      } ${
        table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
      } ${isOccupied ? 'border-red-500 bg-red-50 text-red-700' : 'border-green-500 bg-green-50 text-green-700'}`}
    >
      {table.table_number}
    </button>
  );
}

export default function PublicHallsPage() {
  const { t } = useTranslation();
  const { slug, buildPath } = usePublicSlug();
  const navigate = useNavigate();
  // This public page shares the app's own auth state (same origin/localStorage
  // as the dashboard) — a real customer is never logged in here, so this only
  // ever fires for a staff member previewing their own site from the
  // dashboard, who gets a quick way to log out instead of a "back to menu"
  // that makes no sense in that context.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const [halls, setHalls] = useState<HallRecord[]>([]);
  const [activeHallId, setActiveHallId] = useState<number | null>(null);
  const [tables, setTables] = useState<PublicTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    axios.get<HallRecord[]>(`${PUBLIC_API}/${slug}/halls`, { params: { lang: getStoredPublicLocale(slug) ?? undefined } }).then((res) => {
      setHalls(res.data);
      if (res.data.length) setActiveHallId(res.data[0].id);
      setLoading(false);
    });
  }, [slug]);

  useEffect(() => {
    if (!slug || !activeHallId) return;

    const fetchTables = () => {
      axios.get<PublicTable[]>(`${PUBLIC_API}/${slug}/tables`, { params: { hall_id: activeHallId } }).then((res) => setTables(res.data));
    };

    fetchTables();
    const timer = setInterval(fetchTables, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slug, activeHallId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#ff4757]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        {isAuthenticated ? (
          <button onClick={handleLogout} className="text-gray-500 hover:text-gray-800" aria-label={t('common.logout')}>
            <LogOut size={22} />
          </button>
        ) : (
          <button onClick={() => navigate(buildPath(''))} className="text-gray-500 hover:text-gray-800" aria-label={t('common.backToMenu')}>
            <ArrowLeft size={22} />
          </button>
        )}
        <div>
          <h1 className="font-bold text-gray-900">{t('halls.findYourTable')}</h1>
          <p className="text-xs text-gray-500">{t('halls.legend')}</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4">
        {halls.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
            <Armchair size={28} className="mx-auto mb-2 text-gray-300" />
            {t('halls.noHalls')}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto">
              {halls.map((hall) => (
                <button
                  key={hall.id}
                  onClick={() => setActiveHallId(hall.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeHallId === hall.id ? 'bg-[#ff4757] text-white' : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {hall.name}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="relative w-full h-[480px] bg-gray-50 border border-dashed border-gray-200 rounded-xl overflow-hidden">
                {tables.map((table) => (
                  <TableBox
                    key={table.id}
                    table={table}
                    onClick={() => table.qr_code_id != null && navigate(`${buildPath('')}?qr=${table.qr_code_id}`)}
                  />
                ))}
                {tables.length === 0 && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                    {t('halls.noTables')}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => navigate(buildPath(''))}
          className="btn btn-primary w-full mt-4"
        >
          {t('halls.continueToMenu')}
        </button>
      </div>
    </div>
  );
}
