export interface Client {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  deleted: boolean;
  deleted_at?: string | null;
  user_id: string;
}

export type PricingRoundingRule =
  | 'none'
  | '0.01'
  | '0.05'
  | '0.10'
  | '0.50'
  | '1.00'
  | 'whole_90'
  | 'whole_99';

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
  purchase_cost?: number;
  freight_cost?: number;
  tax_cost?: number;
  commission_cost?: number;
  card_fee_cost?: number;
  packaging_cost?: number;
  operational_cost?: number;
  other_extra_cost?: number;
  supplier_name?: string;
  target_markup_pct?: number;
  minimum_markup_pct?: number;
  minimum_price?: number;
  rounding_rule?: PricingRoundingRule;
  pricing_notes?: string;
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
  manual_deleted?: boolean;
  registered_by?: string | null;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  deleted_by?: string | null;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
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
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
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
  discount_amount?: number;
  net_total?: number;
  unit_profit?: number;
  total_profit?: number;
  markup_pct?: number;
  margin_pct?: number;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface ProductCategoryPricingRule {
  id: string;
  owner_user_id: string;
  category: string;
  default_markup_pct: number;
  minimum_markup_pct: number;
  minimum_price: number;
  rounding_rule: PricingRoundingRule;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ProductPriceHistoryEntry {
  id: string;
  owner_user_id: string;
  product_id: string;
  changed_by_user_id?: string | null;
  product_name: string;
  previous_price: number;
  new_price: number;
  previous_cost_price: number;
  new_cost_price: number;
  previous_markup_pct: number;
  new_markup_pct: number;
  previous_margin_pct: number;
  new_margin_pct: number;
  created_at: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  minimum_spending: number;
  created_at: string;
  user_id: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  user_id: string;
  type: string;
  quantity: number;
  reason: string;
  date: string;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
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
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}
