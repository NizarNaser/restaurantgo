import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Loader2, CheckCircle2, ChefHat, Clock, PackageCheck, XCircle } from 'lucide-react';
import { usePublicSlug } from '../hooks/usePublicSlug';
import { formatAmount as money } from '../lib/money';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;
const POLL_INTERVAL_MS = 8000;

const STEPS = [
  { key: 'pending', labelKey: 'order.steps.pending', icon: Clock },
  { key: 'preparing', labelKey: 'order.steps.preparing', icon: ChefHat },
  { key: 'ready', labelKey: 'order.steps.ready', icon: PackageCheck },
  { key: 'completed', labelKey: 'order.steps.completed', icon: CheckCircle2 },
] as const;

interface OrderItem {
  name: string;
  quantity: number;
  subtotal: string;
}

interface OrderStatus {
  order_id: number;
  status: string;
  total: string;
  currency: string;
  items: OrderItem[];
  type: string;
  payment_status: string | null;
  delivery_address_line?: string | null;
  delivery_city?: string | null;
  delivery_instructions?: string | null;
}

export default function OrderStatusPage() {
  const { t } = useTranslation();
  const { orderId } = useParams<{ orderId: string }>();
  const { slug, buildPath } = usePublicSlug();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';

  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStatus = () => {
      axios.get(`${PUBLIC_API}/${slug}/orders/${orderId}`, { params: { code } })
        .then((res) => { if (!cancelled) { setOrder(res.data); setError(null); } })
        .catch(() => { if (!cancelled) setError(t('order.orderNotFound')); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [slug, orderId, code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('order.orderNotFound')}</h1>
        <p className="text-gray-600">{error}</p>
        <Link to={buildPath('')} className="mt-4 text-red-500 hover:underline">{t('common.backToMenu')}</Link>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-lg mx-auto px-4 pt-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{t('order.orderNumber', { id: order.order_id })}</h1>
        <p className="text-gray-500 mt-1">{t('order.autoUpdateNotice')}</p>

        {order.type !== 'dine_in' && (
          <div className={`mt-6 rounded-2xl border p-4 text-sm font-medium ${order.payment_status === 'paid' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {order.payment_status === 'paid' ? t('order.paymentConfirmed') : t('order.confirmingPayment')}
          </div>
        )}

        {isCancelled ? (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-2">
            <XCircle className="text-red-500" size={40} />
            <p className="font-semibold text-gray-800">{t('order.cancelledNotice')}</p>
          </div>
        ) : (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => {
                const isDone = i <= currentStepIndex;
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDone ? 'bg-[#ff4757] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <step.icon size={18} />
                    </div>
                    <span className={`text-xs font-medium text-center ${isDone ? 'text-gray-900' : 'text-gray-400'}`}>{t(step.labelKey)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left">
          <h2 className="font-semibold text-gray-800 mb-3">{t('order.orderSummary')}</h2>
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-600">
                <span>{item.quantity}× {item.name}</span>
                <span dir="ltr">{money(item.subtotal, order.currency)} {order.currency}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t border-gray-100 mt-3 pt-3">
            <span>{t('common.total')}</span>
            <span dir="ltr">{money(order.total, order.currency)} {order.currency}</span>
          </div>
        </div>

        {order.type === 'delivery' && order.delivery_address_line && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left">
            <h2 className="font-semibold text-gray-800 mb-2">{t('order.deliveringTo')}</h2>
            <p className="text-sm text-gray-600">{order.delivery_address_line}, {order.delivery_city}</p>
            {order.delivery_instructions && <p className="text-sm text-gray-400 mt-1">{order.delivery_instructions}</p>}
          </div>
        )}

        <Link to={buildPath('')} className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-800">
          {t('common.backToMenu')}
        </Link>
      </div>
    </div>
  );
}
