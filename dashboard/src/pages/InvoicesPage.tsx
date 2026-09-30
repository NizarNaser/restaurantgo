import { useEffect, useState } from 'react';
import { Loader2, Receipt, Printer, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

interface OrderItem {
  id: number;
  name: string;
  weight?: string | null;
  quantity: number;
  subtotal: string;
}

interface Order {
  id: number;
  table_number: string | null;
  customer_name: string | null;
  total: string;
  currency: string;
  paid_at: string | null;
  created_at: string;
  items: OrderItem[];
}

interface PaginatedResponse {
  data: Order[];
  current_page: number;
  last_page: number;
}

interface InvoiceRecord {
  order: {
    id: number; subtotal: string; discount_amount: string; total: string;
    tax_rate: number; tax_amount: number; grand_total: number;
    currency: string; created_at: string; paid_at: string | null;
  };
  table: { table_number: string; hall_name: string | null } | null;
  opened_by: string | null;
  items: OrderItem[];
}

interface ShiftOption {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  opened_by?: { name: string } | null;
}

export default function InvoicesPage() {
  const { t } = useTranslation();
  const hasRole = useAuthStore((s) => s.hasRole);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Only fetched/shown for roles that can see shift history at all — a
  // plain "manage orders" role (e.g. staff) can reach this page but can't
  // list shifts, so it just keeps showing every invoice, as before.
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

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse>('/orders', {
        params: {
          status: 'completed',
          page,
          shift_id: selectedShiftId !== 'all' ? selectedShiftId : undefined,
        },
      });
      setOrders(res.data.data);
      setLastPage(res.data.last_page);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [page, selectedShiftId]);

  const openInvoice = async (order: Order) => {
    setLoadingInvoice(true);
    try {
      const res = await api.get<InvoiceRecord>(`/orders/${order.id}/invoice`);
      setInvoice(res.data);
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handlePrint = async (order: Order) => {
    await openInvoice(order);
    setTimeout(() => window.print(), 50);
  };

  const handleDelete = async (order: Order) => {
    if (!confirm(t('invoices.deleteConfirm', { id: order.id }))) return;
    setDeletingId(order.id);
    try {
      await api.delete(`/orders/${order.id}`);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err: any) {
      alert(err.response?.data?.message || t('invoices.deleteFailed'));
    } finally {
      setDeletingId(null);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="text-[#ff4757]" size={24} /> {t('invoices.title')}
          </h2>
          <p className="text-sm text-gray-500">{t('invoices.subtitle')}</p>
        </div>
        {canFilterByShift && (
          <select
            className="input text-sm bg-white w-full sm:w-auto"
            value={selectedShiftId}
            onChange={(e) => handleShiftChange(e.target.value)}
          >
            <option value="all">{t('invoices.allShifts')}</option>
            {shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>{shiftLabel(shift)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#ff4757]" size={32} /></div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
            {t('invoices.noInvoicesYet')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">{t('orders.tableGuest')}</th>
                <th className="px-5 py-3 font-medium">{t('invoices.paidAt')}</th>
                <th className="px-5 py-3 font-medium">{t('orders.total')}</th>
                <th className="px-5 py-3 font-medium text-right">{t('orders.actionsLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500">#{order.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {order.table_number ? t('orders.tableNumber', { number: order.table_number }) : order.customer_name || '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{order.paid_at ? new Date(order.paid_at).toLocaleString() : '—'}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{parseFloat(order.total).toFixed(2)} {order.currency}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openInvoice(order)} title={t('common.view')} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <Receipt size={16} />
                      </button>
                      <button onClick={() => handlePrint(order)} title={t('common.print')} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600">
                        <Printer size={16} />
                      </button>
                      {hasRole('owner') && (
                        <button
                          onClick={() => handleDelete(order)}
                          disabled={deletingId === order.id}
                          title={t('common.delete')}
                          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          {deletingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40">{t('common.previous')}</button>
          <span className="text-sm text-gray-500">{t('common.pageOf', { page, lastPage })}</span>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40">{t('common.next')}</button>
        </div>
      )}

      {loadingInvoice && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <Loader2 className="animate-spin text-white" size={32} />
        </div>
      )}

      {invoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setInvoice(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div id="printable-invoice" className="p-5 text-sm">
              <h3 className="font-bold text-center mb-1">{t('invoices.invoiceNumber', { id: invoice.order.id })}</h3>
              <p className="text-center text-gray-500 text-xs mb-3">
                {invoice.table ? `${t('orders.tableNumber', { number: invoice.table.table_number })}${invoice.table.hall_name ? ` · ${invoice.table.hall_name}` : ''}` : ''}
              </p>
              <div className="text-xs text-gray-500 mb-3 space-y-0.5">
                <p>{t('invoices.opened')}: {new Date(invoice.order.created_at).toLocaleString()}</p>
                {invoice.order.paid_at && <p>{t('invoices.paid')}: {new Date(invoice.order.paid_at).toLocaleString()}</p>}
                <p>{t('invoices.servedBy')}: {invoice.opened_by ?? '—'}</p>
              </div>
              <div className="divide-y divide-gray-100 border-t border-b border-gray-200">
                {invoice.items.map((line) => (
                  <div key={line.id} className="flex items-center gap-3 py-1.5">
                    <span className="flex-1">{line.name}{line.weight && <span className="text-gray-400 text-xs ml-1">({line.weight})</span>}</span>
                    <span className="text-gray-500">× {line.quantity}</span>
                    <span className="w-16 text-right font-medium">{parseFloat(line.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-gray-500"><span>{t('invoices.subtotal')}</span><span>{invoice.order.currency} {parseFloat(invoice.order.subtotal).toFixed(2)}</span></div>
                {parseFloat(invoice.order.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-700"><span>{t('invoices.discount')}</span><span>-{invoice.order.currency} {parseFloat(invoice.order.discount_amount).toFixed(2)}</span></div>
                )}
                {invoice.order.tax_rate > 0 && (
                  <div className="flex justify-between text-gray-500"><span>{t('invoices.tax', { rate: invoice.order.tax_rate })}</span><span>{invoice.order.currency} {invoice.order.tax_amount.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-bold"><span>{t('orders.total')}</span><span>{invoice.order.currency} {invoice.order.grand_total.toFixed(2)}</span></div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => window.print()} className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                <Printer size={16} /> {t('common.print')}
              </button>
              <button onClick={() => setInvoice(null)} className="btn btn-secondary border border-gray-200 flex-1">{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
