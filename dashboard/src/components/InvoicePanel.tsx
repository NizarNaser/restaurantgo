import { Loader2, Minus, Plus, Printer, CheckCircle2, ArrowRightLeft, Percent } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CartLine, DiscountApplicationRecord, DiscountCardRecord, InvoiceRecord, OrderRecord } from '../types/pos';

interface DiscountUiState {
  hasPermission: boolean;
  pendingApplication: DiscountApplicationRecord | null;
  showLookup: boolean;
  onToggleLookup: () => void;
  cardNumber: string;
  onCardNumberChange: (value: string) => void;
  onLookupCard: () => void;
  lookingUp: boolean;
  error: string;
  lookedUpCard: DiscountCardRecord | null;
  mode: 'deduct' | 'accumulate';
  onModeChange: (mode: 'deduct' | 'accumulate') => void;
  onRequestDiscount: () => void;
  requesting: boolean;
  onApproveClick: () => void;
  onReject: () => void;
}

export default function InvoicePanel({
  order,
  cart,
  cartTotal,
  onUpdateCartQuantity,
  onAddItems,
  submitting,
  invoice,
  error,
  printNotice,
  onPrintBill,
  printingBill,
  onCloseTable,
  closing,
  canEdit,
  hasTransferPermission,
  onOpenTransfer,
  discount,
}: {
  order: OrderRecord | null;
  cart: CartLine[];
  cartTotal: number;
  onUpdateCartQuantity: (menuItemId: number, quantity: number) => void;
  onAddItems: () => void;
  submitting: boolean;
  invoice: InvoiceRecord | null;
  error: string;
  printNotice: string;
  onPrintBill: () => void;
  printingBill: boolean;
  onCloseTable: () => void;
  closing: boolean;
  canEdit: boolean;
  hasTransferPermission: boolean;
  onOpenTransfer: () => void;
  discount: DiscountUiState;
}) {
  const { t } = useTranslation();
  if (!order) return null;

  const currency = order.currency;
  const subtotal = invoice ? parseFloat(invoice.order.subtotal) : parseFloat(order.total);
  const taxRate = invoice?.order.tax_rate ?? 0;
  const taxAmount = invoice?.order.tax_amount ?? 0;
  const grandTotal = invoice ? invoice.order.grand_total : parseFloat(order.total);
  const discountAmount = parseFloat(order.discount_amount ?? '0');

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-gray-900">{t('tableOrder.bill')}</h3>
        {canEdit && (
          <div className="flex gap-2">
            {order.items.length > 0 && (
              <button type="button" onClick={onPrintBill} disabled={printingBill} className="btn btn-outline text-xs flex items-center gap-1.5">
                {printingBill ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                {t('tableOrder.printBill')}
              </button>
            )}
            <button
              type="button"
              onClick={onCloseTable}
              disabled={closing}
              className="btn text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              {closing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              {order.items.length > 0 ? t('tableOrder.closeTableMarkPaid') : t('tableOrder.releaseTableNoOrder')}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {order.items.length > 0 ? (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {order.items.map((line) => (
              <div key={line.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 text-gray-900">
                  {line.name}
                  {line.weight && <span className="text-gray-400 text-xs ml-1">({line.weight})</span>}
                </span>
                <span className="text-gray-500">{parseFloat(line.unit_price).toFixed(2)} × {line.quantity}</span>
                <span className="w-16 text-right font-medium text-gray-900">{parseFloat(line.subtotal).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('tableOrder.noItemsYet')}</p>
        )}

        {cart.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('tableOrder.toAdd')}</h4>
            <div className="border border-dashed border-gray-300 rounded-lg divide-y divide-gray-100">
              {cart.map((line) => (
                <div key={line.menu_item_id} className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm text-gray-900">{line.name}</span>
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button type="button" onClick={() => onUpdateCartQuantity(line.menu_item_id, line.quantity - 1)} className="p-1 text-gray-500 hover:text-gray-800">
                      <Minus size={13} />
                    </button>
                    <span className="w-6 text-center text-sm">{line.quantity}</span>
                    <button type="button" onClick={() => onUpdateCartQuantity(line.menu_item_id, line.quantity + 1)} className="p-1 text-gray-500 hover:text-gray-800">
                      <Plus size={13} />
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-medium text-gray-900">{(line.price * line.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {printNotice && <p className="text-xs text-amber-600">{printNotice}</p>}

        {canEdit && order.items.length > 0 && (
          <div>
            {discountAmount > 0 ? (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                <Percent size={12} /> {t('tableOrder.discountApplied', { amount: discountAmount.toFixed(2), currency })}
              </p>
            ) : !discount.hasPermission ? null : discount.pendingApplication ? (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
                <span className="flex-1">{t('tableOrder.discountAwaitingApproval', { amount: parseFloat(discount.pendingApplication.amount).toFixed(2), currency })}</span>
                <button type="button" onClick={discount.onApproveClick} className="font-semibold hover:underline">{t('hr.approve')}</button>
                <button type="button" onClick={discount.onReject} className="text-gray-400 hover:text-red-500">{t('tableOrder.reject')}</button>
              </div>
            ) : discount.showLookup ? (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text" placeholder={t('discountCards.cardNumberPlaceholder')} className="input text-sm flex-1"
                    value={discount.cardNumber} onChange={(e) => discount.onCardNumberChange(e.target.value)}
                  />
                  <button type="button" onClick={discount.onLookupCard} disabled={discount.lookingUp} className="btn btn-secondary border border-gray-200 text-sm">
                    {discount.lookingUp ? <Loader2 size={14} className="animate-spin" /> : t('tableOrder.lookUp')}
                  </button>
                </div>
                {discount.error && <p className="text-xs text-red-500">{discount.error}</p>}
                {discount.lookedUpCard && (
                  <div className="text-sm space-y-2">
                    <p className="text-gray-700">{t('tableOrder.cardOffLine', { name: discount.lookedUpCard.customer_name, percent: parseFloat(discount.lookedUpCard.discount_percentage) })}</p>
                    <select className="input text-sm w-full bg-white" value={discount.mode} onChange={(e) => discount.onModeChange(e.target.value as 'deduct' | 'accumulate')}>
                      <option value="deduct">{t('tableOrder.deductFromInvoice')}</option>
                      <option value="accumulate">{t('tableOrder.accumulateCredit')}</option>
                    </select>
                    <button type="button" onClick={discount.onRequestDiscount} disabled={discount.requesting} className="btn btn-primary text-sm w-full flex items-center justify-center gap-2">
                      {discount.requesting ? <Loader2 size={14} className="animate-spin" /> : t('tableOrder.requestDiscount')}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="border-t border-gray-100 p-4 space-y-3 shrink-0">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>{t('invoices.subtotal')}</span>
            <span>{currency} {subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>{t('invoices.discount')}</span>
              <span>-{currency} {discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>{t('invoices.tax', { rate: taxRate })}</span>
              <span>{currency} {taxAmount.toFixed(2)}</span>
            </div>
          )}
          {cart.length > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>{t('tableOrder.toAdd')}</span>
              <span>{currency} {cartTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-1">
            <span>{t('orders.total')}</span>
            <span>{currency} {(grandTotal + (cart.length > 0 ? cartTotal : 0)).toFixed(2)}</span>
          </div>
        </div>

        {canEdit && cart.length > 0 && (
          <button
            type="button"
            disabled={submitting}
            onClick={onAddItems}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : t('tableOrder.addToOrder', { total: cartTotal.toFixed(2) })}
          </button>
        )}

        {canEdit && (
          <div className="flex gap-2 pt-1">
            {discount.hasPermission && order.items.length > 0 && !discount.pendingApplication && discountAmount === 0 && (
              <button type="button" onClick={discount.onToggleLookup} className="btn btn-outline text-sm flex-1 flex items-center justify-center gap-1.5">
                <Percent size={14} /> {t('tableOrder.applyDiscountCard')}
              </button>
            )}
            {hasTransferPermission && (
              <button type="button" onClick={onOpenTransfer} className="btn btn-outline text-sm flex-1 flex items-center justify-center gap-1.5">
                <ArrowRightLeft size={14} /> {t('tableOrder.transfer')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
