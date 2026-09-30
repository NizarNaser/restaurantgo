import { create } from 'zustand';

export interface CartItem {
  menu_item_id: number;
  name: string;
  unit_price: number;
  currency: string;
  quantity: number;
  notes?: string;
}

export type OrderType = 'delivery' | 'dine_in' | null;

interface StoredCart {
  items: CartItem[];
  qrCodeId: number | null;
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryInstructions: string;
}

interface CartState {
  slug: string | null;
  qrCodeId: number | null;
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  deliveryAddressLine: string;
  deliveryCity: string;
  deliveryInstructions: string;

  /** Loads the right restaurant's cart (per-tab, per-slug) and records the table QR from the URL, if any. */
  initForSlug: (slug: string, qrCodeIdFromUrl: number | null) => void;
  setCustomerInfo: (name: string, phone: string) => void;
  setOrderType: (type: OrderType) => void;
  setDeliveryAddress: (line: string, city: string, instructions: string) => void;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  clear: () => void;
  subtotal: () => number;
}

const emptyCart: StoredCart = {
  items: [], qrCodeId: null, customerName: '', customerPhone: '',
  orderType: null, deliveryAddressLine: '', deliveryCity: '', deliveryInstructions: '',
};

function storageKey(slug: string) {
  return `cart_${slug}`;
}

function loadFromStorage(slug: string): StoredCart {
  try {
    const raw = sessionStorage.getItem(storageKey(slug));
    return raw ? { ...emptyCart, ...JSON.parse(raw) } : { ...emptyCart };
  } catch {
    return { ...emptyCart };
  }
}

function persist(slug: string, cart: StoredCart) {
  try {
    sessionStorage.setItem(storageKey(slug), JSON.stringify(cart));
  } catch {
    // Private browsing / storage disabled — the cart just won't survive a reload.
  }
}

function snapshot(state: CartState): StoredCart {
  const { items, qrCodeId, customerName, customerPhone, orderType, deliveryAddressLine, deliveryCity, deliveryInstructions } = state;
  return { items, qrCodeId, customerName, customerPhone, orderType, deliveryAddressLine, deliveryCity, deliveryInstructions };
}

export const useCartStore = create<CartState>((set, get) => ({
  slug: null,
  qrCodeId: null,
  items: [],
  customerName: '',
  customerPhone: '',
  orderType: null,
  deliveryAddressLine: '',
  deliveryCity: '',
  deliveryInstructions: '',

  initForSlug: (slug, qrCodeIdFromUrl) => {
    if (get().slug === slug) {
      if (qrCodeIdFromUrl != null && qrCodeIdFromUrl !== get().qrCodeId) {
        set({ qrCodeId: qrCodeIdFromUrl });
        persist(slug, snapshot({ ...get(), qrCodeId: qrCodeIdFromUrl }));
      }
      return;
    }
    const stored = loadFromStorage(slug);
    set({
      slug,
      items: stored.items,
      qrCodeId: qrCodeIdFromUrl ?? stored.qrCodeId,
      customerName: stored.customerName ?? '',
      customerPhone: stored.customerPhone ?? '',
      orderType: stored.orderType ?? null,
      deliveryAddressLine: stored.deliveryAddressLine ?? '',
      deliveryCity: stored.deliveryCity ?? '',
      deliveryInstructions: stored.deliveryInstructions ?? '',
    });
  },

  setCustomerInfo: (name, phone) => {
    const { slug } = get();
    set({ customerName: name, customerPhone: phone });
    if (slug) persist(slug, snapshot({ ...get(), customerName: name, customerPhone: phone }));
  },

  setOrderType: (type) => {
    const { slug } = get();
    set({ orderType: type });
    if (slug) persist(slug, snapshot({ ...get(), orderType: type }));
  },

  setDeliveryAddress: (line, city, instructions) => {
    const { slug } = get();
    set({ deliveryAddressLine: line, deliveryCity: city, deliveryInstructions: instructions });
    if (slug) persist(slug, snapshot({ ...get(), deliveryAddressLine: line, deliveryCity: city, deliveryInstructions: instructions }));
  },

  addItem: (item, quantity = 1) => {
    const { slug, items } = get();
    if (!slug) return;
    const existing = items.find((i) => i.menu_item_id === item.menu_item_id);
    const next = existing
      ? items.map((i) => (i.menu_item_id === item.menu_item_id ? { ...i, quantity: i.quantity + quantity } : i))
      : [...items, { ...item, quantity }];
    set({ items: next });
    persist(slug, snapshot({ ...get(), items: next }));
  },

  updateQuantity: (menuItemId, quantity) => {
    const { slug, items } = get();
    if (!slug) return;
    const next = quantity <= 0
      ? items.filter((i) => i.menu_item_id !== menuItemId)
      : items.map((i) => (i.menu_item_id === menuItemId ? { ...i, quantity } : i));
    set({ items: next });
    persist(slug, snapshot({ ...get(), items: next }));
  },

  removeItem: (menuItemId) => get().updateQuantity(menuItemId, 0),

  clear: () => {
    const { slug } = get();
    set({ items: [] });
    if (slug) persist(slug, snapshot({ ...get(), items: [] }));
  },

  subtotal: () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
}));
