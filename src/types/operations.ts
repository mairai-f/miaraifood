import type { DebtEntry } from '@/types';

export type PurchaseOrder = {
  id: string;
  location_id?: string | null;
  supplier_id?: string | null;
  supplier_name: string;
  invoice_number: string;
  purchase_date: string;
  status: string;
  due_date?: string | null;
  received_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  approval_notes?: string;
  last_divergence_note?: string;
  divergence_status?: 'none' | 'reported' | 'resolved';
  total_amount: number;
  notes: string;
};

export type SupplierRecord = {
  id: string;
  name: string;
  whatsapp: string;
  document: string;
  contact_name: string;
  email: string;
  payment_terms_days: number;
  delivery_lead_days: number;
  minimum_order: number;
  notes: string;
  active: boolean;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  received_quantity: number;
  last_received_quantity?: number;
  last_divergence_quantity?: number;
  received_unit_cost?: number | null;
  average_cost_after?: number | null;
};

export type FinancialAccount = {
  id: string;
  location_id?: string | null;
  account_type: 'payable' | 'receivable';
  description: string;
  party_name: string;
  amount: number;
  paid_amount?: number;
  payment_history?: Array<{
    id: string;
    paid_at: string;
    amount: number;
    notes?: string;
    actor_user_id?: string | null;
    actor_label?: string | null;
  }>;
  due_date: string;
  paid_at: string | null;
  status: 'pending' | 'paid' | 'canceled';
  canceled_at?: string | null;
  canceled_reason?: string;
  payment_method?: string;
  cost_center?: string;
  attachment_url?: string;
  recurrence_type?: 'none' | 'monthly' | 'weekly' | 'yearly' | 'installment';
  recurrence_parent_id?: string | null;
  installment_number?: number;
  installment_total?: number;
  source?: string;
  reference_id?: string | null;
  notes?: string;
};

export type ProductPromotion = {
  id: string;
  product_id: string | null;
  product_name: string;
  title: string;
  discount_type: 'amount' | 'percent' | 'fixed_price';
  discount_value: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

export type ProductBatch = {
  id: string;
  product_id: string | null;
  product_name: string;
  batch_code: string;
  quantity: number;
  expiration_date: string;
  alert_days: number;
};

export type SupplierSummary = {
  id: string | null;
  name: string;
  whatsapp: string;
  registered: boolean;
  active: boolean;
  productsCount: number;
  productNames: string[];
  lowStockCount: number;
  stockValue: number;
  purchaseCount: number;
  purchaseTotal: number;
  lastPurchaseDate: string | null;
  averagePurchaseTicket: number;
  pendingPurchaseCount: number;
  receivedPurchaseCount: number;
  divergenceCount: number;
};

export type OpenDebtClient = {
  id: string;
  name: string;
  balance: number;
  entries: DebtEntry[];
};

export type OperationsDetail =
  | 'batches'
  | 'purchases'
  | 'accounts'
  | 'suppliers'
  | 'promotions'
  | 'sales'
  | 'profit'
  | 'expenses'
  | 'debts';
