import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { usePlanAccess } from './PlanContext';
import type { Client, Product, DebtEntry, Payment, Sale, SaleItem, StockMovement, Expense, ProductCategoryPricingRule, ProductPriceHistoryEntry } from '@/types';
import { buildSaleItemPricingMetrics, normalizeProductPricing, normalizePricingRoundingRule } from '@/lib/pricing';

const db = supabase as any;

interface Reward { id: string; name: string; description: string; minimum_spending: number; created_at: string; user_id: string; }

const ensureSuccess = <T extends { error?: unknown }>(result: T) => {
  if (result.error) throw result.error;
  return result;
};

const normalizeProductRow = (row: Product) => {
  const normalized = normalizeProductPricing(row);

  return {
    ...row,
    ...normalized,
    rounding_rule: normalizePricingRoundingRule(normalized.rounding_rule),
  } as Product;
};

const productsWithDisplayCodes = (rows: Product[] = []) =>
  rows.map((product, index) => ({
    ...normalizeProductRow(product),
    code: product.code ?? index + 1,
    barcode: product.barcode ?? '',
    stock: product.stock ?? 0,
    min_stock: product.min_stock ?? 0,
  }));

const withDisplayCode = (product: Product, existing: Product[] = []) => ({
  ...normalizeProductRow(product),
  code: product.code ?? Math.max(0, ...existing.map(item => Number(item.code) || 0)) + 1,
  barcode: product.barcode ?? '',
  stock: product.stock ?? 0,
  min_stock: product.min_stock ?? 0,
});

const normalizePricingRuleRow = (rule: ProductCategoryPricingRule): ProductCategoryPricingRule => ({
  ...rule,
  default_markup_pct: Number(rule.default_markup_pct ?? 0) || 0,
  minimum_markup_pct: Number(rule.minimum_markup_pct ?? 0) || 0,
  minimum_price: Number(rule.minimum_price ?? 0) || 0,
  rounding_rule: normalizePricingRoundingRule(rule.rounding_rule),
  notes: rule.notes ?? '',
});

const nowIso = () => new Date().toISOString();
const createId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
const isManualDeletedDebtEntry = (entry: DebtEntry) => entry.manual_deleted === true;
const isLegacyDeletedDebtEntry = (entry: DebtEntry) => entry.deleted === true && entry.status !== 'paid' && !isManualDeletedDebtEntry(entry);
const isVisibleDebtEntry = (entry: DebtEntry) => !isManualDeletedDebtEntry(entry) && !isLegacyDeletedDebtEntry(entry);
const isVisiblePendingDebtEntry = (entry: DebtEntry) => isVisibleDebtEntry(entry) && entry.status === 'pending' && !entry.deleted;

interface DataContextType {
  clients: Client[]; products: Product[]; debtEntries: DebtEntry[]; payments: Payment[]; rewards: Reward[];
  sales: Sale[]; saleItems: SaleItem[]; stockMovements: StockMovement[]; expenses: Expense[];
  pricingRules: ProductCategoryPricingRule[]; priceHistory: ProductPriceHistoryEntry[];
  loading: boolean;
  addClient: (name: string, phone: string) => Promise<void>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  softDeleteClient: (id: string) => Promise<void>;
  addProduct: (name: string, price: number, category: string, extra?: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addPricingRule: (rule: Omit<ProductCategoryPricingRule, 'id' | 'created_at' | 'updated_at' | 'owner_user_id'> & { owner_user_id?: string }) => Promise<void>;
  updatePricingRule: (id: string, data: Partial<ProductCategoryPricingRule>) => Promise<void>;
  deletePricingRule: (id: string) => Promise<void>;
  searchProducts: (q: string) => Product[];
  addDebtEntry: (clientId: string, productId: string, productName: string, quantity: number, unitPrice: number, dateAdded?: string, registeredBy?: string) => Promise<void>;
  addDebtEntries: (entries: Array<{ clientId: string; productId: string; productName: string; quantity: number; unitPrice: number; dateAdded?: string; registeredBy?: string }>) => Promise<void>;
  updateDebtEntry: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteDebtEntry: (id: string, reason: string) => Promise<void>;
  addPayment: (clientId: string, amount: number, type: 'total' | 'partial', date?: string) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  getClientBalance: (clientId: string) => number;
  getClientTotalSpending: (clientId: string) => number;
  closeAllDebt: (clientId: string, date?: string) => Promise<void>;
  deleteClientHistory: (clientId: string) => Promise<void>;
  createSale: (
    sale: Omit<Sale, 'id' | 'created_at' | 'date'>,
    items: Omit<SaleItem, 'id' | 'sale_id'>[],
  ) => Promise<{ sale: Sale; items: SaleItem[] }>;
  cancelSale: (saleId: string, reason: string) => Promise<void>;
  addStockMovement: (productId: string, type: string, quantity: number, reason: string) => Promise<void>;
  clearAllStock: (reason?: string) => Promise<void>;
  addExpense: (
    description: string,
    amount: number,
    category: string,
    metadata?: {
      operatorUserId?: string | null;
      cashSessionId?: string | null;
      date?: string;
    }
  ) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addReward: (name: string, description: string, minimum_spending: number) => Promise<void>;
  updateReward: (id: string, data: Partial<Reward>) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, ownerUserId, loading: authLoading, isAdmin } = useAuth();
  const { hasFeature, loading: planLoading, planId } = usePlanAccess();
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [debtEntries, setDebtEntries] = useState<DebtEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pricingRules, setPricingRules] = useState<ProductCategoryPricingRule[]>([]);
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isDemoMode = planId === 'demo';

  useEffect(() => {
    if (!user || !ownerUserId || !isDemoMode) return;

    setClients([]);
    setProducts([]);
    setDebtEntries([]);
    setPayments([]);
    setRewards([]);
    setSales([]);
    setSaleItems([]);
    setStockMovements([]);
    setExpenses([]);
    setPricingRules([]);
    setPriceHistory([]);
    setLoading(false);
  }, [isDemoMode, ownerUserId, user]);

  const fetchAll = useCallback(async () => {
    if (authLoading || planLoading) {
      setLoading(true);
      return;
    }

    if (!user || !ownerUserId) {
      setClients([]); setProducts([]); setDebtEntries([]); setPayments([]); setRewards([]);
      setSales([]); setSaleItems([]); setStockMovements([]); setExpenses([]); setPricingRules([]); setPriceHistory([]);
      setLoading(false); return;
    }

    if (isDemoMode) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const canReadClients = hasFeature('clients.manage');
    const canReadProducts = hasFeature('products.manage');
    const canReadFiado = hasFeature('fiado.manage');
    const canReadRewards = hasFeature('rewards.manage');
    const canReadSales = hasFeature('pdv.use');
    const canReadStock = hasFeature('stock.manage');
    const canReadExpenses = hasFeature('financial.manage');
    const canReadPricing = hasFeature('pricing.manage');

    const emptyResult = Promise.resolve({ data: [], error: null });

    let productsResponse = { data: [], error: null };

    if (canReadProducts) {
      const productsByCode = await db.from('products').select('*').order('code', { ascending: true });
      productsResponse = productsByCode.error?.message?.includes('products.code')
        ? await db.from('products').select('*').order('created_at', { ascending: true })
        : productsByCode;
    }

    const [c, p, d, pay, r, s, si, sm, exp, pr, ph] = await Promise.all([
      canReadClients ? db.from('clients').select('*').order('created_at', { ascending: false }) : emptyResult,
      Promise.resolve(productsResponse),
      canReadFiado ? db.from('debt_entries').select('*').order('date_added', { ascending: false }) : emptyResult,
      canReadFiado ? db.from('payments').select('*').order('date', { ascending: false }) : emptyResult,
      canReadRewards ? db.from('rewards').select('*').order('created_at', { ascending: false }) : emptyResult,
      canReadSales ? db.from('sales').select('*').order('date', { ascending: false }) : emptyResult,
      canReadSales ? db.from('sale_items').select('*') : emptyResult,
      canReadStock ? db.from('stock_movements').select('*').order('date', { ascending: false }) : emptyResult,
      canReadExpenses ? db.from('expenses').select('*').order('date', { ascending: false }) : emptyResult,
      canReadPricing ? db.from('product_category_pricing_rules').select('*').order('category', { ascending: true }) : emptyResult,
      canReadPricing ? db.from('product_price_history').select('*').order('created_at', { ascending: false }) : emptyResult,
    ]);
    setClients((c.data as Client[]) ?? []);
    setProducts(productsWithDisplayCodes((p.data as Product[]) ?? []));
    setDebtEntries((d.data as DebtEntry[]) ?? []);
    setPayments((pay.data as Payment[]) ?? []);
    setRewards((r.data as Reward[]) ?? []);
    setSales((s.data as Sale[]) ?? []);
    setSaleItems((si.data as SaleItem[]) ?? []);
    setStockMovements((sm.data as StockMovement[]) ?? []);
    setExpenses((exp.data as Expense[]) ?? []);
    setPricingRules((((pr.data as ProductCategoryPricingRule[]) ?? []).map(normalizePricingRuleRow)));
    setPriceHistory((ph.data as ProductPriceHistoryEntry[]) ?? []);
    setLoading(false);
  }, [authLoading, hasFeature, isDemoMode, ownerUserId, planLoading, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // --- Clients ---
  const addClient = async (name: string, phone: string) => {
    if (isDemoMode) {
      const client: Client = {
        id: createId(),
        name,
        phone,
        created_at: nowIso(),
        deleted: false,
        deleted_at: null,
        user_id: ownerUserId!,
      };
      setClients(prev => [client, ...prev]);
      return;
    }
    const { data, error } = await db.from('clients').insert({ name, phone, user_id: ownerUserId! }).select('*').single();
    if (error) throw error;
    setClients(prev => [data as Client, ...prev]);
  };
  const updateClient = async (id: string, data: Partial<Client>) => {
    if (isDemoMode) {
      setClients(prev => prev.map(client => client.id === id ? { ...client, ...data } : client));
      return;
    }
    const { data: updated, error } = await db.from('clients').update(data).eq('id', id).select('*').single();
    if (error) throw error;
    setClients(prev => prev.map(client => client.id === id ? updated as Client : client));
  };
  const softDeleteClient = async (id: string) => {
    if (isDemoMode) {
      setClients(prev => prev.map(client => client.id === id ? { ...client, deleted: true, deleted_at: nowIso() } : client));
      return;
    }
    const { data: updated, error } = await db.from('clients').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    setClients(prev => prev.map(client => client.id === id ? updated as Client : client));
  };

  // --- Products ---
  const prepareProductPayload = useCallback((payload: Partial<Product>) => {
    const normalized = normalizeProductPricing(payload);

    return {
      ...payload,
      ...normalized,
      name: payload.name?.trim() ?? '',
      category: payload.category?.trim() ?? '',
      barcode: payload.barcode?.trim() ?? '',
    } as Partial<Product>;
  }, []);

  const addProduct = async (name: string, price: number, category: string, extra: Partial<Product> = {}) => {
    const productPayload = prepareProductPayload({
      ...extra,
      name,
      price,
      category,
    });

    if (isDemoMode) {
      const product = withDisplayCode({
        id: createId(),
        user_id: ownerUserId!,
        name: productPayload.name ?? name,
        price: productPayload.price ?? price,
        category: productPayload.category ?? category,
        cost_price: productPayload.cost_price ?? 0,
        purchase_cost: productPayload.purchase_cost ?? 0,
        freight_cost: productPayload.freight_cost ?? 0,
        tax_cost: productPayload.tax_cost ?? 0,
        commission_cost: productPayload.commission_cost ?? 0,
        card_fee_cost: productPayload.card_fee_cost ?? 0,
        packaging_cost: productPayload.packaging_cost ?? 0,
        operational_cost: productPayload.operational_cost ?? 0,
        other_extra_cost: productPayload.other_extra_cost ?? 0,
        supplier_name: productPayload.supplier_name ?? '',
        target_markup_pct: productPayload.target_markup_pct ?? 0,
        minimum_markup_pct: productPayload.minimum_markup_pct ?? 0,
        minimum_price: productPayload.minimum_price ?? 0,
        rounding_rule: productPayload.rounding_rule,
        pricing_notes: productPayload.pricing_notes ?? '',
        barcode: productPayload.barcode ?? '',
        stock: productPayload.stock ?? 0,
        min_stock: productPayload.min_stock ?? 0,
        deleted: false,
        deleted_at: null,
      } as Product, products);
      setProducts(prev => [...prev, product]);
      return;
    }
    const { data, error } = await db.from('products').insert({
      user_id: ownerUserId!,
      ...productPayload,
    } as any).select('*').single();
    if (error) throw error;
    setProducts(prev => [...prev, withDisplayCode(data as Product, prev)]);
  };
  const updateProduct = async (id: string, data: Partial<Product>) => {
    const nextProduct = products.find(product => product.id === id);
    const productPayload = prepareProductPayload({ ...nextProduct, ...data });

    if (isDemoMode) {
      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode({ ...product, ...productPayload } as Product, prev) : product));
      return;
    }
    const { data: updated, error } = await db.from('products').update(productPayload).eq('id', id).select('*').single();
    if (error) throw error;
    setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(updated as Product, prev) : product));
  };
  const deleteProduct = async (id: string) => {
    if (isDemoMode) {
      setProducts(prev => prev.map(product => product.id === id ? { ...product, deleted: true, deleted_at: nowIso() } : product));
      return;
    }
    const { data: updated, error } = await db.from('products').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) throw error;
    setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(updated as Product, prev) : product));
  };
  const addPricingRule = async (rule: Omit<ProductCategoryPricingRule, 'id' | 'created_at' | 'updated_at' | 'owner_user_id'> & { owner_user_id?: string }) => {
    const normalizedRule = {
      owner_user_id: rule.owner_user_id || ownerUserId!,
      category: rule.category.trim(),
      default_markup_pct: Number(rule.default_markup_pct ?? 0) || 0,
      minimum_markup_pct: Number(rule.minimum_markup_pct ?? 0) || 0,
      minimum_price: Number(rule.minimum_price ?? 0) || 0,
      rounding_rule: normalizePricingRoundingRule(rule.rounding_rule),
      notes: rule.notes?.trim() ?? '',
    };

    if (isDemoMode) {
      setPricingRules(prev => [...prev, normalizePricingRuleRow({
        id: createId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        ...normalizedRule,
      } as ProductCategoryPricingRule)]);
      return;
    }

    const { data, error } = await db.from('product_category_pricing_rules').insert(normalizedRule).select('*').single();
    if (error) throw error;
    setPricingRules(prev => [...prev, normalizePricingRuleRow(data as ProductCategoryPricingRule)].sort((a, b) => a.category.localeCompare(b.category)));
  };
  const updatePricingRule = async (id: string, data: Partial<ProductCategoryPricingRule>) => {
    const currentRule = pricingRules.find(rule => rule.id === id);
    const payload = {
      owner_user_id: data.owner_user_id || currentRule?.owner_user_id || ownerUserId!,
      category: (data.category ?? currentRule?.category ?? '').trim(),
      default_markup_pct: Number(data.default_markup_pct ?? currentRule?.default_markup_pct ?? 0) || 0,
      minimum_markup_pct: Number(data.minimum_markup_pct ?? currentRule?.minimum_markup_pct ?? 0) || 0,
      minimum_price: Number(data.minimum_price ?? currentRule?.minimum_price ?? 0) || 0,
      rounding_rule: normalizePricingRoundingRule(data.rounding_rule ?? currentRule?.rounding_rule),
      notes: (data.notes ?? currentRule?.notes ?? '').trim(),
    };

    if (isDemoMode) {
      setPricingRules(prev => prev.map(rule => rule.id === id ? normalizePricingRuleRow({ ...rule, ...payload, updated_at: nowIso() }) : rule));
      return;
    }

    const { data: updated, error } = await db.from('product_category_pricing_rules').update(payload).eq('id', id).select('*').single();
    if (error) throw error;
    setPricingRules(prev =>
      prev
        .map(rule => rule.id === id ? normalizePricingRuleRow(updated as ProductCategoryPricingRule) : rule)
        .sort((a, b) => a.category.localeCompare(b.category))
    );
  };
  const deletePricingRule = async (id: string) => {
    if (isDemoMode) {
      setPricingRules(prev => prev.filter(rule => rule.id !== id));
      return;
    }
    ensureSuccess(await db.from('product_category_pricing_rules').delete().eq('id', id));
    setPricingRules(prev => prev.filter(rule => rule.id !== id));
  };
  const searchProducts = (q: string) => {
    const activeProducts = products.filter(p => !p.deleted);
    if (!q) return activeProducts;
    const term = q.trim().toLowerCase();
    return activeProducts.filter(p =>
      p.name.toLowerCase().startsWith(term) ||
      p.barcode?.toLowerCase().startsWith(term) ||
      p.code?.toString().startsWith(term)
    );
  };

  // --- Debt Entries ---
  const addDebtEntry = async (clientId: string, productId: string, productName: string, quantity: number, unitPrice: number, dateAdded?: string, registeredBy?: string) => {
    if (isDemoMode) {
      const entry: DebtEntry = {
        id: createId(),
        client_id: clientId,
        product_id: productId,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        total: quantity * unitPrice,
        date_added: dateAdded || nowIso(),
        date_paid: null,
        status: 'pending',
        deleted: false,
        manual_deleted: false,
        registered_by: registeredBy ?? null,
      };
      setDebtEntries(prev => [entry, ...prev]);
      return;
    }
    const { data, error } = await db.from('debt_entries').insert({
      client_id: clientId, product_id: productId, product_name: productName,
      quantity, unit_price: unitPrice, total: quantity * unitPrice,
      date_added: dateAdded || new Date().toISOString(),
      registered_by: registeredBy,
    }).select('*').single();
    if (error) throw error;
    setDebtEntries(prev => [data as DebtEntry, ...prev]);
  };

  const addDebtEntries = async (
    entries: Array<{ clientId: string; productId: string; productName: string; quantity: number; unitPrice: number; dateAdded?: string; registeredBy?: string }>
  ) => {
    if (entries.length === 0) return;

    if (isDemoMode) {
      const nextEntries = entries.map(entry => ({
        id: createId(),
        client_id: entry.clientId,
        product_id: entry.productId,
        product_name: entry.productName,
        quantity: entry.quantity,
        unit_price: entry.unitPrice,
        total: entry.quantity * entry.unitPrice,
        date_added: entry.dateAdded || nowIso(),
        date_paid: null,
        status: 'pending',
        deleted: false,
        manual_deleted: false,
        registered_by: entry.registeredBy ?? null,
      } as DebtEntry));
      setDebtEntries(prev => [...nextEntries, ...prev]);
      return;
    }

    const { data, error } = await db.from('debt_entries').insert(
      entries.map(entry => ({
        client_id: entry.clientId,
        product_id: entry.productId,
        product_name: entry.productName,
        quantity: entry.quantity,
        unit_price: entry.unitPrice,
        total: entry.quantity * entry.unitPrice,
        date_added: entry.dateAdded || new Date().toISOString(),
        registered_by: entry.registeredBy,
      }))
    ).select('*');

    if (error) throw error;
    setDebtEntries(prev => [...((data as DebtEntry[]) ?? []), ...prev]);
  };
  const updateDebtEntry = async (id: string, data: Record<string, unknown>) => {
    const mapped: Record<string, unknown> = {};
    if ('dateAdded' in data) mapped.date_added = data.dateAdded;
    if ('datePaid' in data) mapped.date_paid = data.datePaid;
    if ('status' in data) mapped.status = data.status;
    if ('deleted' in data) mapped.deleted = data.deleted;
    if ('date_added' in data) mapped.date_added = data.date_added;
    if ('date_paid' in data) mapped.date_paid = data.date_paid;
    if (isDemoMode) {
      setDebtEntries(prev => prev.map(entry => entry.id === id ? { ...entry, ...mapped } as DebtEntry : entry));
      return;
    }
    ensureSuccess(await db.from('debt_entries').update(mapped as any).eq('id', id));
    await fetchAll();
  };
  const deleteDebtEntry = async (id: string, reason: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode excluir itens da caderneta.');
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Informe o motivo da exclusão do item.');
    }

    if (isDemoMode) {
      setDebtEntries(prev => prev.map(entry => entry.id === id ? {
        ...entry,
        deleted: true,
        manual_deleted: true,
        deleted_at: nowIso(),
        deleted_reason: trimmedReason,
        deleted_by: user?.email ?? 'Administrador',
      } : entry));
      return;
    }
    ensureSuccess(await db.from('debt_entries').update({
      deleted: true,
      manual_deleted: true,
      deleted_at: nowIso(),
      deleted_reason: trimmedReason,
      deleted_by: user?.email ?? 'Administrador',
    }).eq('id', id));
    await fetchAll();
  };

  // --- Payments ---
  const addPayment = async (clientId: string, amount: number, type: 'total' | 'partial', date?: string) => {
    if (isDemoMode) {
      const payment: Payment = {
        id: createId(),
        client_id: clientId,
        amount,
        type,
        date: date || nowIso(),
        details: null,
      };
      setPayments(prev => [payment, ...prev]);
      return;
    }
    const { data, error } = await db
      .from('payments')
      .insert({ client_id: clientId, amount, type, date: date || new Date().toISOString() })
      .select('*')
      .single();

    if (error) throw error;
    setPayments(prev => [data as Payment, ...prev]);
  };
  const deletePayment = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode excluir pagamentos da caderneta.');
    }
    if (isDemoMode) {
      setPayments(prev => prev.filter(payment => payment.id !== id));
      return;
    }
    ensureSuccess(await db.from('payments').delete().eq('id', id));
    await fetchAll();
  };
  const getClientBalance = (clientId: string) => {
    const clientPayments = payments.filter(p => p.client_id === clientId);
    const latestTotalPaymentTime = clientPayments
      .filter(p => p.type === 'total')
      .reduce((latest, payment) => Math.max(latest, new Date(payment.date).getTime()), 0);

    const totalDebt = debtEntries
      .filter(d => d.client_id === clientId && isVisiblePendingDebtEntry(d))
      .reduce((sum, debt) => sum + debt.total, 0);

    const partialPaymentsInCurrentCycle = clientPayments
      .filter(p => p.type === 'partial' && new Date(p.date).getTime() >= latestTotalPaymentTime)
      .reduce((sum, payment) => sum + payment.amount, 0);

    return Math.max(0, totalDebt - partialPaymentsInCurrentCycle);
  };

  const getClientTotalSpending = (clientId: string) => {
    return debtEntries.filter(d => d.client_id === clientId && isVisibleDebtEntry(d)).reduce((s, d) => s + d.total, 0);
  };

  const buildDebtDetailsSnapshot = (clientId: string): string => {
    const pending = debtEntries.filter(d => d.client_id === clientId && isVisiblePendingDebtEntry(d));
    if (pending.length === 0) return '';
    const groups = new Map<string, typeof pending>();
    for (const e of pending) {
      const key = e.product_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    const lines: string[] = [];
    for (const [, items] of groups) {
      const name = items[0].product_name;
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const totalVal = items.reduce((s, i) => s + i.total, 0);
      lines.push(`${name} x${totalQty} — R$ ${totalVal.toFixed(2)}`);
      for (const item of items) {
        const d = new Date(item.date_added);
        const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        lines.push(`  • x${item.quantity} — ${dateStr}${item.registered_by ? ` (por ${item.registered_by})` : ''}`);
      }
    }
    const total = pending.reduce((s, d) => s + d.total, 0);
    lines.push(`\nTotal: R$ ${total.toFixed(2)}`);
    return lines.join('\n');
  };

  const closeAllDebt = async (clientId: string, date?: string) => {
    const balance = getClientBalance(clientId);
    const paymentDate = date || new Date().toISOString();
    const pendingIds = debtEntries.filter(d => d.client_id === clientId && isVisiblePendingDebtEntry(d)).map(d => d.id);

    if (isDemoMode) {
      if (balance > 0) {
        setPayments(prev => [{
          id: createId(),
          client_id: clientId,
          amount: balance,
          type: 'total',
          date: paymentDate,
          details: null,
        }, ...prev]);
      }

      if (pendingIds.length > 0) {
        setDebtEntries(prev => prev.map(entry =>
          pendingIds.includes(entry.id)
            ? { ...entry, status: 'paid', date_paid: paymentDate, deleted: true, manual_deleted: false }
            : entry
        ));
      }
      return;
    }

    if (balance > 0) {
      const { error } = await db
        .from('payments')
        .insert({ client_id: clientId, amount: balance, type: 'total', date: paymentDate });

      if (error) throw error;
    }

    if (pendingIds.length > 0) {
      const { error } = await db
        .from('debt_entries')
        .update({ status: 'paid', date_paid: paymentDate, deleted: true, manual_deleted: false })
        .in('id', pendingIds);

      if (error) throw error;
    }

    await fetchAll();
  };

  const deleteClientHistory = async (clientId: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode limpar histórico da caderneta.');
    }

    if (isDemoMode) {
      setDebtEntries(prev => prev.filter(entry => entry.client_id !== clientId));
      return;
    }
    ensureSuccess(await db.from('debt_entries').delete().eq('client_id', clientId));
    await fetchAll();
  };

  // --- Sales (PDV) ---
  const createSale = async (
    sale: Omit<Sale, 'id' | 'created_at' | 'date'>,
    items: Omit<SaleItem, 'id' | 'sale_id'>[],
  ) => {
    const itemsWithMetrics = buildSaleItemPricingMetrics(items, sale.discount ?? 0);

    if (isDemoMode) {
      const saleId = createId();
      const createdAt = nowIso();
      const saleRow: Sale = {
        id: saleId,
        created_at: createdAt,
        date: createdAt,
        ...sale,
        user_id: ownerUserId!,
      };
      const saleRows = itemsWithMetrics.map(item => ({
        ...item,
        id: createId(),
        sale_id: saleId,
      })) as SaleItem[];
      const movements = itemsWithMetrics
        .filter(item => item.product_id)
        .map(item => ({
          id: createId(),
          product_id: item.product_id!,
          user_id: ownerUserId!,
          type: 'saida',
          quantity: item.quantity,
          reason: 'Venda PDV',
          date: createdAt,
        } as StockMovement));

      setSales(prev => [saleRow, ...prev]);
      setSaleItems(prev => [...saleRows, ...prev]);
      setProducts(prev => prev.map(product => {
        const soldQuantity = itemsWithMetrics.filter(item => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
        return soldQuantity > 0 ? { ...product, stock: Math.max(0, (product.stock || 0) - soldQuantity) } : product;
      }));
      if (movements.length > 0) {
        setStockMovements(prev => [...movements, ...prev]);
      }

      return { sale: saleRow, items: saleRows };
    }

    const salePayload = {
      ...sale,
      user_id: ownerUserId!,
    } as any;
    const { data, error } = await db.from('sales').insert(salePayload).select('*').single();
    let saleData = data;
    let saleError = error;

    if (
      saleError?.message
      && ['seller_name', 'is_delivery', 'status', 'cancel_reason', 'cancelled_at', 'operator_user_id', 'cash_session_id']
        .some(column => saleError.message.includes(column))
    ) {
      const {
        seller_name,
        is_delivery,
        status,
        cancel_reason,
        cancelled_at,
        operator_user_id,
        cash_session_id,
        ...baseSalePayload
      } = salePayload;
      const retry = await db.from('sales').insert(baseSalePayload).select('*').single();
      saleData = retry.data;
      saleError = retry.error;
    }

    if (saleError || !saleData) throw saleError;
    const saleId = saleData.id;
    const itemsWithSaleId = itemsWithMetrics.map(i => ({ ...i, sale_id: saleId }));
    const { data: insertedItems, error: saleItemsError } = await db.from('sale_items').insert(itemsWithSaleId).select('*');
    if (saleItemsError) throw saleItemsError;

    const stockUpdates = itemsWithMetrics
      .filter(item => item.product_id)
      .map(item => {
        const product = products.find(p => p.id === item.product_id);
        if (!product || product.stock <= 0) return null;
        const newStock = Math.max(0, product.stock - item.quantity);
        return db.from('products').update({ stock: newStock }).eq('id', item.product_id);
      })
      .filter(Boolean);

    const stockMovementsToInsert = itemsWithMetrics
      .filter(item => item.product_id)
      .map(item => ({
        product_id: item.product_id,
        user_id: ownerUserId!,
        type: 'saida',
        quantity: item.quantity,
        reason: 'Venda PDV',
      }));

    await Promise.all(stockUpdates.map(async update => ensureSuccess(await update)));
    let insertedStockMovements: StockMovement[] = [];
    if (stockMovementsToInsert.length > 0) {
      const { data: movementRows, error: movementError } = await db.from('stock_movements').insert(stockMovementsToInsert).select('*');
      if (movementError) throw movementError;
      insertedStockMovements = (movementRows as StockMovement[]) ?? [];
    }

    setSales(prev => [saleData as Sale, ...prev]);
    setSaleItems(prev => [...((insertedItems as SaleItem[]) ?? []), ...prev]);
    setProducts(prev => prev.map(product => {
      const soldQuantity = itemsWithMetrics
        .filter(item => item.product_id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (soldQuantity === 0) return product;
      return { ...product, stock: Math.max(0, (product.stock || 0) - soldQuantity) };
    }));
    if (insertedStockMovements.length > 0) {
      setStockMovements(prev => [...insertedStockMovements, ...prev]);
    }

    return {
      sale: saleData as Sale,
      items: (insertedItems as SaleItem[]) ?? [],
    };
  };

  const cancelSale = async (saleId: string, reason: string) => {
    if (isDemoMode) {
      const itemsToRestore = saleItems.filter(item => item.sale_id === saleId && item.product_id);
      const cancelledAt = nowIso();
      setSales(prev => prev.map(item => item.id === saleId ? { ...item, status: 'cancelled', cancel_reason: reason, cancelled_at: cancelledAt } : item));
      setProducts(prev => prev.map(product => {
        const restoredQuantity = itemsToRestore.filter(item => item.product_id === product.id).reduce((sum, item) => sum + item.quantity, 0);
        return restoredQuantity > 0 ? { ...product, stock: (product.stock || 0) + restoredQuantity } : product;
      }));
      if (itemsToRestore.length > 0) {
        setStockMovements(prev => [...itemsToRestore.map(item => ({
          id: createId(),
          product_id: item.product_id!,
          user_id: ownerUserId!,
          type: 'entrada',
          quantity: item.quantity,
          reason: `Cancelamento venda: ${reason}`,
          date: cancelledAt,
        } as StockMovement)), ...prev]);
      }
      return;
    }
    const { data: updatedSale, error } = await db
      .from('sales')
      .update({ status: 'cancelled', cancel_reason: reason, cancelled_at: new Date().toISOString() })
      .eq('id', saleId)
      .select('*')
      .single();

    if (error) {
      const message = error.message || '';
      if (['status', 'cancel_reason', 'cancelled_at'].some(column => message.includes(column))) {
        throw new Error('A migration de cancelamento de vendas ainda não foi aplicada no banco.');
      }
      throw error;
    }

    const itemsToRestore = saleItems.filter(item => item.sale_id === saleId && item.product_id);
    const stockUpdates = itemsToRestore.map(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) return null;
      return db
        .from('products')
        .update({ stock: (product.stock || 0) + item.quantity })
        .eq('id', item.product_id);
    }).filter(Boolean);

    await Promise.all(stockUpdates.map(async update => ensureSuccess(await update)));

    let insertedStockMovements: StockMovement[] = [];
    if (itemsToRestore.length > 0) {
      const { data: movementRows, error: movementError } = await db.from('stock_movements').insert(itemsToRestore.map(item => ({
        product_id: item.product_id,
        user_id: ownerUserId!,
        type: 'entrada',
        quantity: item.quantity,
        reason: `Cancelamento venda: ${reason}`,
      }))).select('*');
      if (movementError) throw movementError;
      insertedStockMovements = (movementRows as StockMovement[]) ?? [];
    }
    setSales(prev => prev.map(item => item.id === saleId ? updatedSale as Sale : item));
    setProducts(prev => prev.map(product => {
      const restoredQuantity = itemsToRestore
        .filter(item => item.product_id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (restoredQuantity === 0) return product;
      return { ...product, stock: (product.stock || 0) + restoredQuantity };
    }));
    if (insertedStockMovements.length > 0) {
      setStockMovements(prev => [...insertedStockMovements, ...prev]);
    }
  };

  // --- Stock ---
  const addStockMovement = async (productId: string, type: string, quantity: number, reason: string) => {
    if (isDemoMode) {
      const movement: StockMovement = {
        id: createId(),
        product_id: productId,
        user_id: ownerUserId!,
        type,
        quantity,
        reason,
        date: nowIso(),
      };
      setStockMovements(prev => [movement, ...prev]);
      return;
    }
    const { data, error } = await db.from('stock_movements').insert({ product_id: productId, user_id: ownerUserId!, type, quantity, reason }).select('*').single();
    if (error) throw error;
    setStockMovements(prev => [data as StockMovement, ...prev]);
  };

  const clearAllStock = async (reason = 'Limpeza geral de estoque') => {
    const stockedProducts = products.filter(product => !product.deleted && (product.stock || 0) > 0);
    if (stockedProducts.length === 0) return;

    if (isDemoMode) {
      const movementDate = nowIso();
      setProducts(prev => prev.map(product => (product.deleted || (product.stock || 0) <= 0 ? product : { ...product, stock: 0 })));
      setStockMovements(prev => [
        ...stockedProducts.map(product => ({
          id: createId(),
          product_id: product.id,
          user_id: ownerUserId!,
          type: 'saida',
          quantity: product.stock,
          reason,
          date: movementDate,
        } as StockMovement)),
        ...prev,
      ]);
      return;
    }

    const stockedIds = stockedProducts.map(product => product.id);
    const { data: updatedRows, error: updateError } = await db
      .from('products')
      .update({ stock: 0 })
      .in('id', stockedIds)
      .select('*');

    if (updateError) throw updateError;

    const movementsPayload = stockedProducts.map(product => ({
      product_id: product.id,
      user_id: ownerUserId!,
      type: 'saida',
      quantity: product.stock,
      reason,
    }));

    const { data: movementRows, error: movementError } = await db
      .from('stock_movements')
      .insert(movementsPayload)
      .select('*');

    if (movementError) throw movementError;

    const updatedMap = new Map(
      ((updatedRows as Product[]) ?? []).map(product => [product.id, product])
    );

    setProducts(prev =>
      prev.map(product =>
        updatedMap.has(product.id)
          ? withDisplayCode(updatedMap.get(product.id)! as Product, prev)
          : product
      )
    );
    setStockMovements(prev => [...((movementRows as StockMovement[]) ?? []), ...prev]);
  };

  // --- Expenses ---
  const addExpense = async (
    description: string,
    amount: number,
    category: string,
    metadata?: {
      operatorUserId?: string | null;
      cashSessionId?: string | null;
      date?: string;
    }
  ) => {
    if (isDemoMode) {
      const expense: Expense = {
        id: createId(),
        user_id: ownerUserId!,
        operator_user_id: metadata?.operatorUserId ?? null,
        cash_session_id: metadata?.cashSessionId ?? null,
        description,
        amount,
        category,
        date: metadata?.date || nowIso(),
      };
      setExpenses(prev => [expense, ...prev]);
      return;
    }
    const expensePayload = {
      user_id: ownerUserId!,
      operator_user_id: metadata?.operatorUserId ?? null,
      cash_session_id: metadata?.cashSessionId ?? null,
      description,
      amount,
      category,
      date: metadata?.date || new Date().toISOString(),
    };
    const { data, error } = await db.from('expenses').insert(expensePayload).select('*').single();
    let expenseData = data;
    let expenseError = error;

    if (expenseError?.message && ['operator_user_id', 'cash_session_id'].some(column => expenseError.message.includes(column))) {
      const { operator_user_id, cash_session_id, ...baseExpensePayload } = expensePayload;
      const retry = await db.from('expenses').insert(baseExpensePayload).select('*').single();
      expenseData = retry.data;
      expenseError = retry.error;
    }

    if (expenseError) throw expenseError;
    setExpenses(prev => [expenseData as Expense, ...prev]);
  };
  const deleteExpense = async (id: string) => {
    if (isDemoMode) {
      setExpenses(prev => prev.filter(expense => expense.id !== id));
      return;
    }
    ensureSuccess(await db.from('expenses').delete().eq('id', id));
    await fetchAll();
  };

  // --- Rewards ---
  const addReward = async (name: string, description: string, minimum_spending: number) => {
    if (isDemoMode) {
      setRewards(prev => [{
        id: createId(),
        name,
        description,
        minimum_spending,
        created_at: nowIso(),
        user_id: ownerUserId!,
      }, ...prev]);
      return;
    }
    ensureSuccess(await db.from('rewards').insert({ user_id: ownerUserId!, name, description, minimum_spending }));
    await fetchAll();
  };

  const updateReward = async (id: string, data: Partial<Reward>) => {
    if (isDemoMode) {
      setRewards(prev => prev.map(reward => reward.id === id ? { ...reward, ...data } : reward));
      return;
    }
    ensureSuccess(await db.from('rewards').update(data).eq('id', id));
    await fetchAll();
  };

  const deleteReward = async (id: string) => {
    if (isDemoMode) {
      setRewards(prev => prev.filter(reward => reward.id !== id));
      return;
    }
    ensureSuccess(await db.from('rewards').delete().eq('id', id));
    await fetchAll();
  };

  return (
    <DataContext.Provider value={{
      clients, products, debtEntries, payments, rewards, sales, saleItems, stockMovements, expenses, pricingRules, priceHistory, loading,
      addClient, updateClient, softDeleteClient,
      addProduct, updateProduct, deleteProduct, searchProducts,
      addPricingRule, updatePricingRule, deletePricingRule,
      addDebtEntry, addDebtEntries, updateDebtEntry, deleteDebtEntry,
      addPayment, deletePayment, getClientBalance, getClientTotalSpending, closeAllDebt, deleteClientHistory,
      createSale, cancelSale, addStockMovement, clearAllStock, addExpense, deleteExpense,
      addReward, updateReward, deleteReward,
      refetch: fetchAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be within DataProvider');
  return ctx;
};
