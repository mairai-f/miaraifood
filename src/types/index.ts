export interface Client {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  deleted: boolean;
  deleted_at?: string | null;
  user_id: string;
}

export interface Product {
  id: string;
  user_id: string;
  code?: number | null;
  name: string;
  price: number;
  cost_price: number;
  category: string;
  barcode: string;
  stock: number;
  min_stock: number;
  deleted?: boolean;
  deleted_at?: string | null;
}

export interface DebtEntry {
  id: string;
  client_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  date_added: string;
  date_paid?: string | null;
  status: string;
  deleted: boolean;
  registered_by?: string | null;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  deleted_by?: string | null;
}

export interface Payment {
  id: string;
  client_id: string;
  amount: number;
  date: string;
  type: string;
  details?: string | null;
}

export interface Sale {
  id: string;
  client_id?: string | null;
  user_id: string;
  operator_user_id?: string | null;
  cash_session_id?: string | null;
  seller_name?: string | null;
  is_delivery?: boolean;
  status?: string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  total: number;
  discount: number;
  payment_method: string;
  cash_received: number;
  change_amount: number;
  date: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  user_id: string;
  type: string;
  quantity: number;
  reason: string;
  date: string;
}

export interface Expense {
  id: string;
  user_id: string;
  operator_user_id?: string | null;
  cash_session_id?: string | null;
  description: string;
  amount: number;
  category: string;
  date: string;
}
