export interface Client {
  id: string;
  name: string;
  phone: string;
  credit_limit?: number | null;
  debt_due_date?: string | null;
  created_at: string;
  deleted: boolean;
  deleted_at?: string | null;
  user_id: string;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
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

export interface ProductCustomCost {
  name: string;
  amount: number;
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
  max_stock?: number | null;
  control_stock?: boolean;
  purchase_cost?: number;
  freight_cost?: number;
  tax_cost?: number;
  commission_cost?: number;
  card_fee_cost?: number;
  packaging_cost?: number;
  operational_cost?: number;
  other_extra_cost?: number;
  custom_costs?: ProductCustomCost[];
  supplier_id?: string | null;
  supplier_name?: string;
  department_id?: string | null;
  brand_id?: string | null;
  product_group_id?: string | null;
  product_subgroup_id?: string | null;
  measurement_unit_id?: string | null;
  primary_transport_company_id?: string | null;
  reference?: string;
  max_discount_pct?: number;
  commission_type?: 'none' | 'percent' | 'amount';
  commission_value?: number;
  target_markup_pct?: number;
  minimum_markup_pct?: number;
  minimum_price?: number;
  rounding_rule?: PricingRoundingRule;
  pricing_notes?: string;
  fiscal_ncm?: string | null;
  fiscal_cfop?: string | null;
  fiscal_origin?: number | null;
  fiscal_csosn?: string | null;
  fiscal_pis_cst?: string | null;
  fiscal_cofins_cst?: string | null;
  fiscal_unit?: string | null;
  fiscal_gtin?: string | null;
  fiscal_cest?: string | null;
  deleted?: boolean;
  deleted_at?: string | null;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface DebtEntry {
  id: string;
  location_id?: string | null;
  client_id: string;
  product_id: string;
  product_code?: number | null;
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
  location_id?: string | null;
  client_id: string;
  amount: number;
  date: string;
  type: string;
  details?: unknown;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface Sale {
  id: string;
  client_id?: string | null;
  user_id: string;
  operator_user_id?: string | null;
  cash_session_id?: string | null;
  location_id?: string | null;
  terminal_id?: string | null;
  seller_name?: string | null;
  is_delivery?: boolean;
  service_ticket_number?: number | null;
  status?: string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  total: number;
  discount: number;
  payment_method: string;
  cash_received: number;
  change_amount: number;
  fiscal_customer_document?: string | null;
  fiscal_customer_name?: string | null;
  date: string;
  created_at: string;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string | null;
  product_code?: number | null;
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

export type ServiceTicketStatus = 'available' | 'open' | 'awaiting_payment' | 'closed' | 'cancelled';
export type ServiceTicketItemStatus = 'active' | 'cancelled';

export interface ServiceTicket {
  id: string;
  owner_user_id: string;
  location_id?: string | null;
  number: number;
  barcode: string;
  label?: string | null;
  status: ServiceTicketStatus;
  opened_at?: string | null;
  closed_at?: string | null;
  opened_by_user_id?: string | null;
  closed_by_user_id?: string | null;
  opened_by_name?: string | null;
  closed_by_name?: string | null;
  closed_sale_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface ServiceTicketItem {
  id: string;
  ticket_id: string;
  owner_user_id: string;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  status: ServiceTicketItemStatus;
  notes?: string | null;
  added_by_user_id?: string | null;
  added_by_name?: string | null;
  cancelled_by_user_id?: string | null;
  cancelled_by_name?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  created_at: string;
  updated_at: string;
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
  enabled?: boolean;
  reward_type?: 'gift' | 'discount_amount' | 'discount_percent' | 'cashback_amount' | 'cashback_percent' | 'points';
  reward_value?: number;
  points_cost?: number;
  validity_days?: number;
  allow_pdv_redemption?: boolean;
  auto_apply?: boolean;
  notes?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  user_id: string;
  type: string;
  quantity: number;
  reason: string;
  date: string;
  source?: string;
  reference_id?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  operator_user_id?: string | null;
  actor_label?: string | null;
  location_id?: string | null;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}

export interface Expense {
  id: string;
  user_id: string;
  operator_user_id?: string | null;
  cash_session_id?: string | null;
  location_id?: string | null;
  description: string;
  party_name?: string | null;
  amount: number;
  category: string;
  date: string;
  sync_status?: 'synced' | 'queued' | 'conflict';
  sync_error?: string | null;
}
