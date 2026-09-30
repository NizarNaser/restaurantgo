import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Armchair } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

interface HallRecord {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  tables_count?: number;
}

interface FloorTable {
  id: number;
  hall_id: number;
  table_number: string;
  shape: 'round' | 'square' | 'rect';
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  status: 'vacant' | 'occupied';
  opened_at: string | null;
  opened_by: string | null;
  current_order: { id: number; total: string } | null;
}

const POLL_INTERVAL_MS = 15000;

function formatOpenedAt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function FloorTableBox({ table, onClick }: { table: FloorTable; onClick: () => void }) {
  const isOccupied = table.status === 'occupied';

  const style: CSSProperties = {
    position: 'absolute',
    left: table.pos_x,
    top: table.pos_y,
    width: table.width,
    height: table.height,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`border-4 flex flex-col items-center justify-center text-xs font-bold select-none shadow-sm cursor-pointer hover:brightness-95 ${
        table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
      } ${isOccupied ? 'border-red-500 bg-red-50 text-red-700' : 'border-green-500 bg-green-50 text-green-700'}`}
    >
      <span>{table.table_number}</span>
      {isOccupied && (
        <span className="text-[10px] font-normal leading-tight text-center px-1">
          {formatOpenedAt(table.opened_at)}
          {table.current_order && <><br />${table.current_order.total}</>}
        </span>
      )}
    </button>
  );
}

export default function HallsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [halls, setHalls] = useState<HallRecord[]>([]);
  const [activeHallId, setActiveHallId] = useState<number | null>(null);
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<HallRecord[]>('/floor/halls').then((res) => {
      setHalls(res.data);
      if (res.data.length) setActiveHallId(res.data[0].id);
      setLoading(false);
    });
  }, []);

  const fetchTables = () => {
    if (!activeHallId) return;
    api.get<FloorTable[]>('/floor/tables', { params: { hall_id: activeHallId } }).then((res) => setTables(res.data));
  };

  const openTable = (table: FloorTable) => {
    navigate(`/tables/${table.id}/order`, {
      state: {
        tableNumber: table.table_number,
        hallName: halls.find((h) => h.id === activeHallId)?.name ?? null,
        isVacant: table.status === 'vacant',
      },
    });
  };

  useEffect(() => {
    if (!activeHallId) return;
    fetchTables();
    const timer = setInterval(fetchTables, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHallId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('halls.title')}</h1>
        <p className="text-gray-500 mt-1">{t('halls.subtitle')}</p>
      </div>

      {halls.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Armchair size={32} className="mx-auto mb-3 text-gray-300" />
          {t('halls.noHallsYet')}
        </div>
      ) : (
        <>
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto shrink-0">
            {halls.map((hall) => (
              <button
                key={hall.id}
                onClick={() => setActiveHallId(hall.id)}
                className={`px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                  activeHallId === hall.id ? 'text-[#ff4757] border-b-2 border-[#ff4757]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {hall.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="relative w-full h-[560px] bg-gray-50 border border-dashed border-gray-300 rounded-xl overflow-hidden">
              {tables.map((t) => (
                <FloorTableBox key={t.id} table={t} onClick={() => openTable(t)} />
              ))}
              {tables.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                  {t('halls.noTablesYet')}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
