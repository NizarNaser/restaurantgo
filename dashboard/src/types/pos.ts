export interface OrderItemRecord {
  id: number;
  name: string;
  weight?: string | null;
  unit_price: string;
  quantity: number;
  subtotal: string;
  created_at?: string;
}

export interface OrderRecord {
  id: number;
  status: string;
  subtotal: string;
  total: string;
  currency: string;
  items: OrderItemRecord[];
  discount_amount?: string;
  discount_card_id?: number | null;
}

export interface DiscountCardRecord {
  id: number;
  card_number: string;
  customer_name: string;
  discount_percentage: string;
  accumulated_balance: string;
}

export interface DiscountApplicationRecord {
  id: number;
  mode: 'deduct' | 'accumulate' | 'redeem';
  amount: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface InvoiceRecord {
  order: {
    id: number; status: string; subtotal: string; discount_amount: string; total: string;
    tax_rate: number; tax_amount: number; grand_total: number;
    currency: string; created_at: string; paid_at: string | null;
  };
  table: { table_number: string; hall_name: string | null } | null;
  opened_by: string | null;
  items: OrderItemRecord[];
  departments: { id: number; name: string; items: OrderItemRecord[] }[];
  unassigned_items: OrderItemRecord[];
}

export interface DepartmentRecord {
  id: number;
  name: string;
  kds_enabled?: boolean;
}

export interface CategoryRecord {
  id: number;
  name: string;
  department_id: number | null;
}

export interface MenuItemOption {
  id: number;
  name: string;
  price: number | string;
  category_id: number | null;
  is_available: boolean;
  weight?: string | null;
  image_thumb_url?: string | null;
}

export interface PrinterRecord {
  id: number;
  department_id: number | null;
  connection_type: 'wifi' | 'bluetooth';
  address: string;
  is_primary: boolean;
}

export interface CartLine {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
}

export interface CurrentShiftRecord {
  id: number;
  status: 'open' | 'closed';
  opened_at: string;
  opened_by?: { id: number; name: string } | null;
}
