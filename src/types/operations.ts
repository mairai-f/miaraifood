import type { DebtEntry } from '@/types';

export type PurchaseOrder = {
  id: string;
  supplier_id?: string | null;
  supplier_name: string;
  invoice_number: string;
  purchase_date: string;
  status: string;
  total_amount: number;
  notes: string;
};

export type SupplierRecord = {
  id: string;
  name: string;
  whatsapp: string;
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
};

export type FinancialAccount = {
  id: string;
  account_type: 'payable' | 'receivable';
  description: string;
  party_name: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: 'pending' | 'paid' | 'canceled';
  source?: string;
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
  productsCount: number;
  productNames: string[];
  lowStockCount: number;
  stockValue: number;
  purchaseCount: number;
  purchaseTotal: number;
  lastPurchaseDate: string | null;
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
