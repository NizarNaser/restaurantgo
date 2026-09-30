import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { usePublicSlug } from '../hooks/usePublicSlug';

const PUBLIC_API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/v1/public`;

function money(amount: number, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

export default function CartPage() {
  const { t } = useTranslation();
  const { slug, buildPath } = usePublicSlug();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const qrCodeId = useCartStore((s) => s.qrCodeId);
  const subtotal = useCartStore((s) => s.subtotal());
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);
  const storedName = useCartStore((s) => s.customerName);
  const storedPhone = useCartStore((s) => s.customerPhone);
  const setCustomerInfo = useCartStore((s) => s.setCustomerInfo);
  const orderType = useCartStore((s) => s.orderType);
  const storedAddressLine = useCartStore((s) => s.deliveryAddressLine);
  const storedCity = useCartStore((s) => s.deliveryCity);
  const storedInstructions = useCartStore((s) => s.deliveryInstructions);
  const setDeliveryAddress = useCartStore((s) => s.setDeliveryAddress);

  const [customerName, setCustomerName] = useState(storedName);
  const [customerPhone, setCustomerPhone] = useState(storedPhone);
  const [addressLine, setAddressLine] = useState(storedAddressLine);
  const [city, setCity] = useState(storedCity);
  const [instructions, setInstructions] = useState(storedInstructions);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currency = items[0]?.currency ?? 'USD';
  const isDineIn = qrCodeId != null;
  const isDelivery = !isDineIn && orderType === 'delivery';
  // Chose "Dine-in" on the menu page but hasn't actually scanned their
  // table's QR code yet — browsing is fine, but we can't place this order.
  const needsQrScan = !isDineIn && !isDelivery;
  // A staff member placing this dine-in order while logged into the
  // dashboard is identified by their session, not by typing in a customer's
  // name/phone — delivery still needs a real address/contact regardless of
  // who is placing it, so that path always asks.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authToken = useAuthStore((s) => s.token);
  const isStaffDineIn = isDineIn && isAuthenticated;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsQrScan) {
      setError(t('cart.scanToPlaceOrder'));
      return;
    }

    if (isDineIn) {
      setSubmitting(true);
      setError(null);
      setCustomerInfo(customerName.trim(), customerPhone.trim());
      try {
        const res = await axios.post(
          `${PUBLIC_API}/${slug}/orders`,
          {
            qr_code_id: qrCodeId,
            items: items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity, notes: i.notes || undefined })),
            customer_name: customerName.trim() || undefined,
            customer_phone: customerPhone.trim() || undefined,
            notes: notes || undefined,
          },
          isStaffDineIn && authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
        );
        clear();
        navigate(`${buildPath(`/order/${res.data.order_id}`)}?code=${res.data.tracking_code}`);
      } catch (err: any) {
        setError(err.response?.data?.message || t('cart.placeOrderFailed'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!addressLine.trim() || !city.trim()) {
      setError(t('cart.missingAddress'));
      return;
    }

    setSubmitting(true);
    setError(null);
    setCustomerInfo(customerName.trim(), customerPhone.trim());
    setDeliveryAddress(addressLine.trim(), city.trim(), instructions.trim());
    try {
      const res = await axios.post(`${PUBLIC_API}/${slug}/orders/checkout`, {
        items: items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity, notes: i.notes || undefined })),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        notes: notes || undefined,
        delivery_address_line: addressLine.trim(),
        delivery_city: city.trim(),
        delivery_instructions: instructions.trim() || undefined,
        success_url: `${window.location.origin}${buildPath('/order')}`,
        cancel_url: `${window.location.origin}${buildPath('/cart')}?payment=cancelled`,
      });
      clear();
      window.location.href = res.data.checkout_url;
    } catch (err: any) {
      setError(err.response?.data?.message || t('cart.checkoutFailed'));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate(buildPath(''))}
          className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-4"
        >
          <ArrowLeft size={16} /> {t('common.backToMenu')}
        </button>

        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
          <ShoppingCart size={22} /> {t('cart.yourOrder')}
        </h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
            {t('cart.cartEmpty')}
            <div className="mt-4">
              <Link to={buildPath('')} className="btn btn-primary inline-flex">{t('cart.browseMenu')}</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.menu_item_id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-sm text-gray-500">{money(item.unit_price, item.currency)}</p>
                  </div>
                  <div className="flex items-center border border-gray-200 rounded-lg shrink-0">
                    <button type="button" onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)} className="p-1.5 text-gray-500 hover:text-gray-800" aria-label={t('common.decreaseQuantity')}>
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)} className="p-1.5 text-gray-500 hover:text-gray-800" aria-label={t('common.increaseQuantity')}>
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="w-20 text-right font-semibold text-gray-900 shrink-0">
                    {money(item.unit_price * item.quantity, item.currency)}
                  </p>
                  <button type="button" onClick={() => removeItem(item.menu_item_id)} className="p-1.5 text-gray-400 hover:text-red-500 shrink-0" aria-label={t('cart.removeItem')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="p-4 flex items-center justify-between font-bold text-gray-900">
                <span>{t('common.total')}</span>
                <span>{money(subtotal, currency)}</span>
              </div>
            </div>

            <form onSubmit={handlePlaceOrder} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">{t('cart.yourDetails')}</h2>

              {needsQrScan && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {t('cart.scanToPlaceOrder')}
                </p>
              )}

              {isStaffDineIn && (
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  {t('cart.staffOrderNote')}
                </p>
              )}

              {!isStaffDineIn && (
                <>
                  <input
                    type="text"
                    required
                    placeholder={t('common.yourName')}
                    className="input w-full"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <input
                    type="tel"
                    required
                    placeholder={t('common.phoneNumber')}
                    className="input w-full"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </>
              )}

              {isDelivery && (
                <>
                  <input
                    type="text"
                    required
                    placeholder={t('cart.addressPlaceholder')}
                    className="input w-full"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                  />
                  <input
                    type="text"
                    required
                    placeholder={t('cart.cityPlaceholder')}
                    className="input w-full"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder={t('cart.deliveryInstructionsPlaceholder')}
                    className="input w-full"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </>
              )}

              <textarea
                placeholder={t('cart.kitchenNotesPlaceholder')}
                className="input w-full h-20"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              {!needsQrScan && (
                <p className="text-xs text-gray-400">
                  {isDineIn ? t('cart.dineInPaymentNote') : t('cart.deliveryPaymentNote')}
                </p>
              )}
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={submitting || needsQrScan}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : t('cart.placeOrder', { amount: money(subtotal, currency) })}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
