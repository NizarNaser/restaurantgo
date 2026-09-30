import { useEffect, useState } from 'react';
import { Loader2, X, Search, Plus, Minus, Trash2, ScanLine } from 'lucide-react';
import api from '../api/axios';
import QrScannerModal from './QrScannerModal';

interface Branch {
  id: number;
  name: string;
}

interface MenuItemOption {
  id: number;
  name: string;
  price: number | string;
  is_available: boolean;
}

interface CartLine {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
}

interface QrCodeRecord {
  id: number;
  type: string;
  branch_id: number | null;
  table_number: string | null;
}

/** Pulls the numeric QR id out of either URL shape a table code can carry. */
function extractQrId(text: string): number | null {
  const match = text.match(/\/v1\/qr\/(\d+)/) || text.match(/[?&]qr=(\d+)/);
  return match ? Number(match[1]) : null;
}

export default function NewOrderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [qrCodes, setQrCodes] = useState<QrCodeRecord[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState<number | ''>('');
  const [tableNumber, setTableNumber] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Branch[]>('/branches'),
      api.get('/items', { params: { per_page: 100, is_available: 1 } }),
      api.get<QrCodeRecord[]>('/qr-codes'),
    ]).then(([branchesRes, itemsRes, qrCodesRes]) => {
      setBranches(branchesRes.data);
      setBranchId((prev) => prev || branchesRes.data[0]?.id || '');
      setMenuItems(itemsRes.data.data ?? []);
      setQrCodes(qrCodesRes.data);
    }).finally(() => setLoadingOptions(false));
  }, []);

  const handleScan = (text: string) => {
    setShowScanner(false);
    const qrId = extractQrId(text);
    const match = qrId != null ? qrCodes.find((c) => c.id === qrId && c.type === 'table') : null;
    if (!match) {
      setScanError("That doesn't look like one of this restaurant's table QR codes.");
      return;
    }
    setScanError(null);
    if (match.branch_id) setBranchId(match.branch_id);
    if (match.table_number) setTableNumber(match.table_number);
  };

  const filteredItems = search.trim()
    ? menuItems.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()))
    : menuItems;

  const addToCart = (item: MenuItemOption) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.id);
      if (existing) {
        return prev.map((l) => (l.menu_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: parseFloat(String(item.price)), quantity: 1 }];
    });
  };

  const updateQuantity = (menuItemId: number, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.menu_item_id !== menuItemId)
        : prev.map((l) => (l.menu_item_id === menuItemId ? { ...l, quantity } : l))
    );
  };

  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const handleSubmit = async () => {
    if (!tableNumber.trim() || cart.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/orders', {
        branch_id: branchId || undefined,
        table_number: tableNumber.trim(),
        items: cart.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not create the order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New order for a table</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {loadingOptions ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#ff4757]" size={32} />
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-5">
            <div>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="btn btn-secondary border border-gray-200 text-sm flex items-center gap-2 w-full justify-center"
              >
                <ScanLine size={16} /> Scan table QR code instead
              </button>
              {scanError && <p className="text-xs text-red-500 mt-1">{scanError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Branch</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')} className="input bg-white w-full">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Table number</label>
                <input type="text" required value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g. 12" className="input w-full" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Add items</label>
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search menu items..." value={search} onChange={(e) => setSearch(e.target.value)} className="input w-full pl-9" />
              </div>
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addToCart(item)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    <span>{item.name}</span>
                    <span className="text-gray-500 flex items-center gap-2">
                      {parseFloat(String(item.price)).toFixed(2)}
                      <Plus size={14} className="text-[#ff4757]" />
                    </span>
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <p className="px-3 py-3 text-sm text-gray-400">No items found.</p>
                )}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {cart.map((line) => (
                  <div key={line.menu_item_id} className="flex items-center gap-3 px-3 py-2">
                    <span className="flex-1 text-sm text-gray-900">{line.name}</span>
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button type="button" onClick={() => updateQuantity(line.menu_item_id, line.quantity - 1)} className="p-1 text-gray-500 hover:text-gray-800">
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm">{line.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(line.menu_item_id, line.quantity + 1)} className="p-1 text-gray-500 hover:text-gray-800">
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="w-16 text-right text-sm font-medium text-gray-900">{(line.price * line.quantity).toFixed(2)}</span>
                    <button type="button" onClick={() => updateQuantity(line.menu_item_id, 0)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between px-3 py-2 font-semibold text-gray-900 text-sm">
                  <span>Total</span>
                  <span>{subtotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Customer name (optional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input w-full" />
              <input type="tel" placeholder="Phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input w-full" />
            </div>
            <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="input w-full h-16" />

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <div className="p-5 border-t border-gray-100">
          <button
            type="button"
            disabled={submitting || !tableNumber.trim() || cart.length === 0}
            onClick={handleSubmit}
            className="btn btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : `Create order · ${subtotal.toFixed(2)}`}
          </button>
        </div>
      </div>

      {showScanner && (
        <QrScannerModal
          title="Scan the table's QR code"
          hint="Point the camera at the QR code printed on the table."
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
