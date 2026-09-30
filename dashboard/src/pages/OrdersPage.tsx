import { useEffect, useState } from 'react';
import { Loader2, Utensils, Phone, ChefHat, PackageCheck, CheckCheck, X, ClipboardList, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import NewOrderModal from '../components/NewOrderModal';

type Status = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface OrderItem {
  id: number;
  name: string;
  quantity: number;
  subtotal: string;
}

interface Order {
  id: number;
  table_number: string | null;
  source: 'customer' | 'staff';
  customer_name: string | null;
  customer_phone: string | null;
  status: Status;
  total: string; // Laravel's decimal cast serializes as a string, e.g. "62.50"
  currency: string;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
}

interface PaginatedResponse {
  data: Order[];
  current_page: number;
  last_page: number;
  total: number;
}

interface ShiftOption {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opened_by?: { name: string } | null;
}

const POLL_INTERVAL_MS = 15000;

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-500',
};

function nextActions(status: Status): { status: Status; labelKey: string; icon: typeof ChefHat; className: string }[] {
  switch (status) {
    case 'pending':
      return [
        { status: 'preparing', labelKey: 'orders.actions.startPreparing', icon: ChefHat, className: 'hover:text-blue-600 hover:bg-blue-50' },
        { status: 'cancelled', labelKey: 'orders.actions.cancel', icon: X, className: 'hover:text-red-600 hover:bg-red-50' },
      ];
    case 'preparing':
      return [
        { status: 'ready', labelKey: 'orders.actions.markReady', icon: PackageCheck, className: 'hover:text-emerald-600 hover:bg-emerald-50' },
        { status: 'cancelled', labelKey: 'orders.actions.cancel', icon: X, className: 'hover:text-red-600 hover:bg-red-50' },
      ];
    case 'ready':
      return [
        { status: 'completed', labelKey: 'orders.actions.markCompleted', icon: CheckCheck, className: 'hover:text-gray-700 hover:bg-gray-100' },
      ];
    default:
      return [];
  }
}

export default function OrdersPage() {
  const { t } = useTranslation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);

  // Only fetched/shown for roles that can see shift history at all — a
  // plain "manage orders" role (e.g. staff) can reach this page but can't
  // list shifts, so it just keeps showing every order, as before.
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | 'all'>('all');
  const canFilterByShift = hasPermission('manage shifts');

  useEffect(() => {
    if (!canFilterByShift) return;
    Promise.all([
      api.get<{ data: ShiftOption[] }>('/shifts', { params: { per_page: 50 } }),
      api.get<ShiftOption>('/shifts/current'),
    ]).then(([shiftsRes, currentRes]) => {
      setShifts(shiftsRes.data.data ?? []);
      if (currentRes.data?.id) setSelectedShiftId(currentRes.data.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, selectedShiftId]);

  const fetchOrders = async () => {
    try {
      const res = await api.get<PaginatedResponse>('/orders', {
        params: {
          status: statusFilter || undefined,
          page,
          shift_id: selectedShiftId !== 'all' ? selectedShiftId : undefined,
        },
      });
      setOrders(res.data.data);
      setLastPage(res.data.last_page);
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShiftChange = (value: string) => {
    setPage(1);
    setSelectedShiftId(value === 'all' ? 'all' : Number(value));
  };

  const shiftLabel = (shift: ShiftOption) => {
    const opened = new Date(shift.opened_at).toLocaleString();
    const name = shift.opened_by?.name;
    return shift.status === 'open'
      ? t('invoices.shiftOptionOpen', { opened, name: name ?? '—' })
      : t('invoices.shiftOptionClosed', { opened, name: name ?? '—' });
  };

  const updateStatus = async (order: Order, status: Status) => {
    setUpdatingId(order.id);
    try {
      await api.put(`/orders/${order.id}`, { status });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (error: any) {
      alert(error?.response?.data?.message || t('orders.updateFailed'));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('orders.title')}</h2>
          <p className="text-sm text-gray-500">{t('orders.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value as '' | Status); }}
            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
          >
            <option value="">{t('orders.status.all')}</option>
            <option value="pending">{t('orders.status.pending')}</option>
            <option value="preparing">{t('orders.status.preparing')}</option>
            <option value="ready">{t('orders.status.ready')}</option>
            <option value="completed">{t('orders.status.completed')}</option>
            <option value="cancelled">{t('orders.status.cancelled')}</option>
          </select>
          {canFilterByShift && (
            <select
              value={selectedShiftId}
              onChange={(e) => handleShiftChange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
            >
              <option value="all">{t('invoices.allShifts')}</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>{shiftLabel(shift)}</option>
              ))}
            </select>
          )}
          {hasPermission('manage orders') && (
            <button onClick={() => setShowNewOrder(true)} className="btn btn-primary flex items-center gap-2">
              <Plus size={16} /> {t('orders.newOrder')}
            </button>
          )}
        </div>
      </div>

      {showNewOrder && (
        <NewOrderModal
          onClose={() => setShowNewOrder(false)}
          onCreated={() => { setShowNewOrder(false); fetchOrders(); }}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#ff4757]" size={32} />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ClipboardList size={32} className="mx-auto mb-3 text-gray-300" />
            {statusFilter ? t('orders.noOrdersWithStatus', { status: t(`orders.status.${statusFilter}`) }) : t('orders.noOrders')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('orders.tableGuest')}</th>
                  <th className="px-5 py-3 font-medium">{t('orders.items')}</th>
                  <th className="px-5 py-3 font-medium">{t('orders.total')}</th>
                  <th className="px-5 py-3 font-medium">{t('orders.statusLabel')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('orders.actionsLabel')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        <Utensils size={14} className="text-gray-400" />
                        {order.table_number ? t('orders.tableNumber', { number: order.table_number }) : '—'}
                        {order.source === 'staff' && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t('orders.staffBadge')}</span>
                        )}
                      </div>
                      {order.customer_name && (
                        <div className="text-xs text-gray-500 mt-0.5">{order.customer_name}</div>
                      )}
                      {order.customer_phone && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={12} />
                          {order.customer_phone}
                        </div>
                      )}
                      {order.notes && <div className="text-xs text-gray-500 mt-1 max-w-xs">{order.notes}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {order.items.map((item) => (
                        <div key={item.id}>{item.quantity}× {item.name}</div>
                      ))}
                    </td>
                    <td className="px-5 py-3 font-semibold text-gray-900">
                      {parseFloat(order.total).toFixed(2)} {order.currency}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[order.status]}`}>
                        {t(`orders.status.${order.status}`)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {updatingId === order.id ? (
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : (
                          nextActions(order.status).map((action) => (
                            <button
                              key={action.status}
                              onClick={() => updateStatus(order, action.status)}
                              title={t(action.labelKey)}
                              className={`p-2 rounded-lg text-gray-400 hover:bg-gray-100 ${action.className}`}
                            >
                              <action.icon size={16} />
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            {t('common.previous')}
          </button>
          <span className="text-sm text-gray-500">{t('common.pageOf', { page, lastPage })}</span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
