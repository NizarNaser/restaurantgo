import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import Modal from '../components/Modal';

interface DiscountCardRecord {
  id: number;
  card_number: string;
  customer_name: string;
  customer_birth_date: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  discount_percentage: string;
  accumulated_balance: string;
  is_active: boolean;
}

const EMPTY_FORM = {
  card_number: '', customer_name: '', customer_birth_date: '',
  customer_phone: '', customer_email: '', discount_percentage: '',
};

export default function DiscountCardsPage() {
  const { t } = useTranslation();
  const [cards, setCards] = useState<DiscountCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    const res = await api.get<DiscountCardRecord[]>('/discount-cards');
    setCards(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/discount-cards', {
        ...form,
        customer_birth_date: form.customer_birth_date || undefined,
        customer_phone: form.customer_phone || undefined,
        customer_email: form.customer_email || undefined,
        discount_percentage: Number(form.discount_percentage),
      });
      setForm(EMPTY_FORM);
      setModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || t('discountCards.registerFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (card: DiscountCardRecord) => {
    await api.put(`/discount-cards/${card.id}`, { is_active: !card.is_active });
    await fetchAll();
  };

  const handleDelete = async (card: DiscountCardRecord) => {
    if (!confirm(t('discountCards.deleteConfirm', { number: card.card_number, name: card.customer_name }))) return;
    await api.delete(`/discount-cards/${card.id}`);
    await fetchAll();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" size={28} /></div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="text-[#ff4757]" size={24} /> {t('discountCards.title')}
        </h2>
        <p className="text-sm text-gray-500">{t('discountCards.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">{t('discountCards.cardNumber')}</th>
              <th className="px-4 py-3">{t('discountCards.customer')}</th>
              <th className="px-4 py-3">{t('discountCards.discount')}</th>
              <th className="px-4 py-3">{t('discountCards.accumulatedCredit')}</th>
              <th className="px-4 py-3">{t('orders.statusLabel')}</th>
              <th className="px-4 py-3 text-right">{t('orders.actionsLabel')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cards.map((card) => (
              <tr key={card.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{card.card_number}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{card.customer_name}</p>
                  <p className="text-xs text-gray-400">{[card.customer_phone, card.customer_email].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="px-4 py-3">{parseFloat(card.discount_percentage)}%</td>
                <td className="px-4 py-3">{parseFloat(card.accumulated_balance).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(card)}
                    className={`text-xs font-medium px-2 py-1 rounded-full ${card.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {card.is_active ? t('discountCards.active') : t('discountCards.inactive')}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDelete(card)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t('discountCards.noCardsYet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
        <Plus size={16} /> {t('discountCards.registerCard')}
      </button>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('discountCards.registerTitle')}>
        <form onSubmit={handleAdd} className="space-y-3">
          <input type="text" required placeholder={t('discountCards.cardNumberPlaceholder')} className="input w-full" value={form.card_number} onChange={(e) => setForm({ ...form, card_number: e.target.value })} />
          <input type="text" required placeholder={t('discountCards.customerNamePlaceholder')} className="input w-full" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          <label className="block text-xs text-gray-500">{t('discountCards.birthDateOptional')}</label>
          <input type="date" className="input w-full" value={form.customer_birth_date} onChange={(e) => setForm({ ...form, customer_birth_date: e.target.value })} />
          <input type="text" placeholder={t('discountCards.phoneOptional')} className="input w-full" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          <input type="email" placeholder={t('discountCards.emailOptional')} className="input w-full" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
          <input type="number" required min={0} max={100} step="0.01" placeholder={t('discountCards.discountPercentagePlaceholder')} className="input w-full" value={form.discount_percentage} onChange={(e) => setForm({ ...form, discount_percentage: e.target.value })} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="btn btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : t('discountCards.registerCard')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
