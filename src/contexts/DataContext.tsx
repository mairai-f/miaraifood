import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useDesktopRuntime } from './DesktopRuntimeContext';
import { usePlanAccess } from './PlanContext';
import type { Client, Product, DebtEntry, Payment, Sale, SaleItem, StockMovement, Expense, ProductCategoryPricingRule, ProductPriceHistoryEntry, Reward } from '@/types';
import {
  cleanupOfflineData,
  enqueueOfflineOperation,
  getOfflineSnapshot,
  isOfflineConcentratorAvailable,
  isProbablyOfflineError,
  listOfflineQueue,
  recordOfflineConflict,
  replaceOfflineSnapshot,
  updateOfflineQueueItem,
  type OfflineClearHistoryPayload,
  type OfflineDebtEntriesPayload,
  type OfflineDebtEntryMutationPayload,
  type OfflineCashSessionClosePayload,
  type OfflineCashSessionOpenPayload,
  type OfflineClearAllStockPayload,
  type OfflineClientMutationPayload,
  type OfflineClientPayload,
  type OfflineCloseAllDebtPayload,
  type OfflineDeletePayload,
  type OfflineExpensePayload,
  type OfflineOperationPayload,
  type OfflineOperationType,
  type OfflinePaymentPayload,
  type OfflinePricingRuleMutationPayload,
  type OfflinePricingRulePayload,
  type OfflineProductMutationPayload,
  type OfflineProductPayload,
  type OfflineRewardMutationPayload,
  type OfflineRewardPayload,
  type OfflineSaleCreatePayload,
  type OfflineSaleCancelPayload,
  type OfflineSnapshot,
  type OfflineStockMovementPayload,
} from '@/lib/offlineConcentrator';
import { shouldUseOfflineSnapshotFallback } from '@/lib/offlineSnapshotPolicy';
import { buildSaleItemPricingMetrics, normalizeProductPricing, normalizePricingRoundingRule } from '@/lib/pricing';
import { getClientCreditLimit, getCreditLimitExceededMessage, normalizeCreditLimit } from '@/lib/creditLimit';

// Generated Supabase types are behind the current schema for these operational tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ensureSuccess = <T extends { error?: unknown }>(result: T) => {
  if (result.error) throw result.error;
  return result;
};

class OfflineSyncConflictError extends Error {
  readonly operationType: OfflineOperationType;

  constructor(operationType: OfflineOperationType, message: string) {
    super(message);
    this.name = 'OfflineSyncConflictError';
    this.operationType = operationType;
  }
}

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
const stripSyncFields = <T extends { sync_status?: unknown; sync_error?: unknown }>(row: T) => {
  const { sync_status: _syncStatus, sync_error: _syncError, ...rest } = row;
  return rest;
};
const compactObject = (value: Record<string, unknown>) => Object.fromEntries(
  Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
);
const normalizePaymentDetails = (details: unknown) => details ?? [];
const sortByIsoDesc = <T,>(rows: T[], selectIso: (row: T) => string | null | undefined) => (
  [...rows].sort((left, right) => new Date(selectIso(right) ?? 0).getTime() - new Date(selectIso(left) ?? 0).getTime())
);
const sortClientsByCreatedAt = (rows: Client[]) => sortByIsoDesc(rows, row => row.created_at);
const sortDebtEntriesByDateAdded = (rows: DebtEntry[]) => sortByIsoDesc(rows, row => row.date_added);
const sortPaymentsByDate = (rows: Payment[]) => sortByIsoDesc(rows, row => row.date);
const samePaymentMoment = (left?: string | null, right?: string | null) => {
  if (!left || !right) return false;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
};
const buildRemoteClientRecord = (client: Partial<Client>, includeId = false) => {
  const { id, sync_status: _syncStatus, sync_error: _syncError, ...rest } = client;
  const payload = compactObject(rest as Record<string, unknown>);
  return includeId ? compactObject({ id, ...payload }) : payload;
};
const buildRemoteProductRecord = (product: Partial<Product>, includeId = false) => {
  const { id, code: _code, sync_status: _syncStatus, sync_error: _syncError, ...rest } = product;
  const payload = compactObject(rest as Record<string, unknown>);
  return includeId ? compactObject({ id, ...payload }) : payload;
};
const buildRemotePaymentRecord = (payment: Partial<Payment>, includeId = false) => {
  const { id, sync_status: _syncStatus, sync_error: _syncError, ...rest } = payment;
  const payload = compactObject({ ...rest, details: normalizePaymentDetails(rest.details) } as Record<string, unknown>);
  return includeId ? compactObject({ id, ...payload }) : payload;
};
const buildRemoteRewardRecord = (reward: Partial<Reward>, includeId = false) => {
  const { id, ...rest } = reward;
  const payload = compactObject(rest as Record<string, unknown>);
  return includeId ? compactObject({ id, ...payload }) : payload;
};
const isManualDeletedDebtEntry = (entry: DebtEntry) => entry.manual_deleted === true;
const isLegacyDeletedDebtEntry = (entry: DebtEntry) => entry.deleted === true && entry.status !== 'paid' && !isManualDeletedDebtEntry(entry);
const isVisibleDebtEntry = (entry: DebtEntry) => !isManualDeletedDebtEntry(entry) && !isLegacyDeletedDebtEntry(entry);
const isVisiblePendingDebtEntry = (entry: DebtEntry) => isVisibleDebtEntry(entry) && entry.status === 'pending' && !entry.deleted;
type DebtEntryInput = {
  clientId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  dateAdded?: string;
  registeredBy?: string;
};
type AddDebtEntriesOptions = {
  adjustStock?: boolean;
  stockReason?: string;
};
type StockDemand = {
  productId?: string | null;
  productName: string;
  quantity: number;
};
export type OfflinePreparationStatus = 'unavailable' | 'not-ready' | 'preparing' | 'ready' | 'error';

interface DataContextType {
  clients: Client[]; products: Product[]; debtEntries: DebtEntry[]; payments: Payment[]; rewards: Reward[];
  sales: Sale[]; saleItems: SaleItem[]; stockMovements: StockMovement[]; expenses: Expense[];
  pricingRules: ProductCategoryPricingRule[]; priceHistory: ProductPriceHistoryEntry[];
  loading: boolean;
  offlinePreparationStatus: OfflinePreparationStatus;
  offlinePreparationMessage: string | null;
  offlineSnapshotUpdatedAt: string | null;
  addClient: (name: string, phone: string, creditLimit?: number | null) => Promise<void>;
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
  addDebtEntries: (entries: DebtEntryInput[], options?: AddDebtEntriesOptions) => Promise<void>;
  updateDebtEntry: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteDebtEntry: (id: string, reason: string) => Promise<void>;
  addPayment: (clientId: string, amount: number, type: 'total' | 'partial', date?: string, details?: unknown) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
  getClientBalance: (clientId: string) => number;
  getClientTotalSpending: (clientId: string) => number;
  closeAllDebt: (clientId: string, date?: string, details?: unknown) => Promise<void>;
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
  addReward: (name: string, description: string, minimum_spending: number, options?: Partial<Reward>) => Promise<void>;
  updateReward: (id: string, data: Partial<Reward>) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, ownerUserId, loading: authLoading, isAdmin } = useAuth();
  const { isDesktop, offlineEnabled } = useDesktopRuntime();
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
  const [offlinePreparationStatus, setOfflinePreparationStatus] = useState<OfflinePreparationStatus>('unavailable');
  const [offlinePreparationMessage, setOfflinePreparationMessage] = useState<string | null>(null);
  const [offlineSnapshotUpdatedAt, setOfflineSnapshotUpdatedAt] = useState<string | null>(null);
  const isDemoMode = planId === 'demo';
  const canUseOfflineConcentrator = isDesktop && offlineEnabled && isOfflineConcentratorAvailable();
  const offlineSyncInFlightRef = useRef(false);

  const clearStoreData = useCallback(() => {
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
  }, []);

  const markOfflineNotReady = useCallback((message = 'Este computador ainda nao foi preparado para uso offline. Conecte a internet, entre uma vez e aguarde o download dos dados da loja terminar.') => {
    setOfflinePreparationStatus('not-ready');
    setOfflinePreparationMessage(message);
    setOfflineSnapshotUpdatedAt(null);
  }, []);

  useEffect(() => {
    if (!user || !ownerUserId || !isDemoMode) return;

    clearStoreData();
    setLoading(false);
  }, [clearStoreData, isDemoMode, ownerUserId, user]);

  useEffect(() => {
    if (!canUseOfflineConcentrator || !ownerUserId || isDemoMode) {
      setOfflinePreparationStatus('unavailable');
      setOfflinePreparationMessage(null);
      setOfflineSnapshotUpdatedAt(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await getOfflineSnapshot(ownerUserId);
        if (cancelled) return;

        if (result.snapshot) {
          setOfflinePreparationStatus('ready');
          setOfflinePreparationMessage('Dados offline preparados neste computador.');
          setOfflineSnapshotUpdatedAt(result.updatedAt ?? result.snapshot.savedAt ?? null);
        } else {
          markOfflineNotReady();
        }
      } catch {
        if (!cancelled) {
          setOfflinePreparationStatus('error');
          setOfflinePreparationMessage('Nao foi possivel verificar o preparo offline deste computador.');
          setOfflineSnapshotUpdatedAt(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canUseOfflineConcentrator, isDemoMode, markOfflineNotReady, ownerUserId]);

  const applyOfflineSnapshot = useCallback((snapshot: OfflineSnapshot) => {
    setClients(sortClientsByCreatedAt(snapshot.clients ?? []));
    setProducts(productsWithDisplayCodes(snapshot.products ?? []));
    setDebtEntries(sortDebtEntriesByDateAdded(snapshot.debtEntries ?? []));
    setPayments(sortPaymentsByDate(snapshot.payments ?? []));
    setRewards(snapshot.rewards ?? []);
    setSales(snapshot.sales ?? []);
    setSaleItems(snapshot.saleItems ?? []);
    setStockMovements(snapshot.stockMovements ?? []);
    setExpenses(snapshot.expenses ?? []);
    setPricingRules((snapshot.pricingRules ?? []).map(normalizePricingRuleRow));
    setPriceHistory(snapshot.priceHistory ?? []);
  }, []);

  const loadOfflineSnapshotFallback = useCallback(async () => {
    if (!canUseOfflineConcentrator || !ownerUserId) return false;

    const offlineSnapshotResult = await getOfflineSnapshot(ownerUserId);
    if (!offlineSnapshotResult.snapshot) {
      clearStoreData();
      markOfflineNotReady();
      setLoading(false);
      return true;
    }

    applyOfflineSnapshot(offlineSnapshotResult.snapshot);
    setOfflinePreparationStatus('ready');
    setOfflinePreparationMessage('Usando os dados offline salvos neste computador.');
    setOfflineSnapshotUpdatedAt(offlineSnapshotResult.updatedAt ?? offlineSnapshotResult.snapshot.savedAt ?? null);
    setLoading(false);
    return true;
  }, [applyOfflineSnapshot, canUseOfflineConcentrator, clearStoreData, markOfflineNotReady, ownerUserId]);

  const fetchAll = useCallback(async () => {
    if (authLoading || planLoading) {
      setLoading(true);
      return;
    }

    if (!user || !ownerUserId) {
      clearStoreData();
      setLoading(false); return;
    }

    if (isDemoMode) {
      setLoading(false);
      return;
    }

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      const restoredOfflineSnapshot = await loadOfflineSnapshotFallback();
      if (restoredOfflineSnapshot) {
        return;
      }
    }

    setLoading(true);

    if (canUseOfflineConcentrator && ownerUserId) {
      setOfflinePreparationStatus('preparing');
      setOfflinePreparationMessage('Preparando acesso offline... baixando e salvando os dados da loja neste computador.');
    }

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
      canReadClients ? db.from('clients').select('*').order('created_at', { ascending: false }).limit(1000) : emptyResult,
      Promise.resolve(productsResponse),
      canReadFiado ? db.from('debt_entries').select('*').order('date_added', { ascending: false }).limit(2000) : emptyResult,
      canReadFiado ? db.from('payments').select('*').order('date', { ascending: false }).limit(2000) : emptyResult,
      canReadRewards ? db.from('rewards').select('*').order('created_at', { ascending: false }).limit(1000) : emptyResult,
      canReadSales ? db.from('sales').select('*').order('date', { ascending: false }).limit(2000) : emptyResult,
      canReadSales ? db.from('sale_items').select('*').limit(5000) : emptyResult,
      canReadStock ? db.from('stock_movements').select('*').order('date', { ascending: false }).limit(2000) : emptyResult,
      canReadExpenses ? db.from('expenses').select('*').order('date', { ascending: false }).limit(1000) : emptyResult,
      canReadPricing ? db.from('product_category_pricing_rules').select('*').order('category', { ascending: true }) : emptyResult,
      canReadPricing ? db.from('product_price_history').select('*').order('created_at', { ascending: false }).limit(1000) : emptyResult,
    ]);

    const remoteErrors = [c, p, d, pay, r, s, si, sm, exp, pr, ph]
      .map(result => result.error)
      .filter(Boolean);
    const hasRemoteError = remoteErrors.length > 0;

    if (hasRemoteError) {
      if (shouldUseOfflineSnapshotFallback(remoteErrors)) {
        const restoredOfflineSnapshot = await loadOfflineSnapshotFallback();
        if (restoredOfflineSnapshot) {
          return;
        }
      }

      console.error('Falha ao atualizar os dados remotos; mantendo o ultimo estado em memoria.', remoteErrors);
      if (canUseOfflineConcentrator) {
        setOfflinePreparationStatus('error');
        setOfflinePreparationMessage('Nao foi possivel baixar os dados para uso offline agora. Verifique a internet e tente novamente.');
      }
      setLoading(false);
      return;
    }

    const nextClients = (c.data as Client[]) ?? [];
    const nextProducts = productsWithDisplayCodes((p.data as Product[]) ?? []);
    const nextDebtEntries = (d.data as DebtEntry[]) ?? [];
    const nextPayments = (pay.data as Payment[]) ?? [];
    const nextRewards = (r.data as Reward[]) ?? [];
    const nextSales = (s.data as Sale[]) ?? [];
    const nextSaleItems = (si.data as SaleItem[]) ?? [];
    const nextStockMovements = (sm.data as StockMovement[]) ?? [];
    const nextExpenses = (exp.data as Expense[]) ?? [];
    const nextPricingRules = (((pr.data as ProductCategoryPricingRule[]) ?? []).map(normalizePricingRuleRow));
    const nextPriceHistory = (ph.data as ProductPriceHistoryEntry[]) ?? [];

    setClients(nextClients);
    setProducts(nextProducts);
    setDebtEntries(nextDebtEntries);
    setPayments(nextPayments);
    setRewards(nextRewards);
    setSales(nextSales);
    setSaleItems(nextSaleItems);
    setStockMovements(nextStockMovements);
    setExpenses(nextExpenses);
    setPricingRules(nextPricingRules);
    setPriceHistory(nextPriceHistory);
    setLoading(false);

    if (canUseOfflineConcentrator && ownerUserId) {
      const snapshot: OfflineSnapshot = {
        clients: nextClients,
        products: nextProducts,
        debtEntries: nextDebtEntries,
        payments: nextPayments,
        rewards: nextRewards,
        sales: nextSales,
        saleItems: nextSaleItems,
        stockMovements: nextStockMovements,
        expenses: nextExpenses,
        pricingRules: nextPricingRules,
        priceHistory: nextPriceHistory,
        savedAt: nowIso(),
      };

      await replaceOfflineSnapshot(ownerUserId, snapshot);
      setOfflinePreparationStatus('ready');
      setOfflinePreparationMessage('Acesso offline pronto. Se a internet cair, estes dados serao carregados deste computador.');
      setOfflineSnapshotUpdatedAt(snapshot.savedAt);
    }
  }, [authLoading, canUseOfflineConcentrator, clearStoreData, hasFeature, isDemoMode, loadOfflineSnapshotFallback, ownerUserId, planLoading, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!canUseOfflineConcentrator || !ownerUserId || loading || !user || isDemoMode) {
      return;
    }

    const snapshot: OfflineSnapshot = {
      clients,
      products,
      debtEntries,
      payments,
      rewards,
      sales,
      saleItems,
      stockMovements,
      expenses,
      pricingRules,
      priceHistory,
      savedAt: nowIso(),
    };

    void replaceOfflineSnapshot(ownerUserId, snapshot).then(() => {
      setOfflinePreparationStatus('ready');
      setOfflinePreparationMessage('Acesso offline pronto. Os dados locais foram atualizados.');
      setOfflineSnapshotUpdatedAt(snapshot.savedAt);
    }).catch(() => {
      setOfflinePreparationStatus('error');
      setOfflinePreparationMessage('Nao foi possivel atualizar os dados offline neste computador.');
    });
  }, [
    canUseOfflineConcentrator,
    clients,
    debtEntries,
    expenses,
    isDemoMode,
    loading,
    ownerUserId,
    payments,
    priceHistory,
    pricingRules,
    products,
    rewards,
    saleItems,
    sales,
    stockMovements,
    user,
  ]);

  const syncQueuedCashSessionOpenOperation = useCallback(async (payload: OfflineCashSessionOpenPayload) => {
    const { session } = payload;

    const { data: existingSession, error: existingSessionError } = await db
      .from('cash_sessions')
      .select('id')
      .eq('id', session.id)
      .maybeSingle();

    if (existingSessionError) {
      throw existingSessionError;
    }

    if (!existingSession) {
      ensureSuccess(await db.from('cash_sessions').insert(session));
    }
  }, []);

  const syncQueuedCashSessionCloseOperation = useCallback(async (payload: OfflineCashSessionClosePayload) => {
    const { data: existingSession, error: existingSessionError } = await db
      .from('cash_sessions')
      .select('id')
      .eq('id', payload.sessionId)
      .maybeSingle();

    if (existingSessionError) {
      throw existingSessionError;
    }

    if (!existingSession) {
      throw new OfflineSyncConflictError(
        'cash_session.close',
        'A sessao de caixa offline ainda nao existe no banco remoto para ser fechada.',
      );
    }

    ensureSuccess(await db
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_at: payload.closedAt,
        closed_by_user_id: payload.closedByUserId,
        closed_by_name: payload.closedByName,
        closing_balance: payload.closingBalance,
      })
      .eq('id', payload.sessionId));
  }, []);

  const syncQueuedClientCreateOperation = useCallback(async (payload: OfflineClientPayload) => {
    const remoteClientPayload = buildRemoteClientRecord(payload.client, true);

    const { data: existingClient, error: existingClientError } = await db
      .from('clients')
      .select('id')
      .eq('id', payload.client.id)
      .maybeSingle();

    if (existingClientError) {
      throw existingClientError;
    }

    if (existingClient) {
      ensureSuccess(await db.from('clients').update(buildRemoteClientRecord(payload.client)).eq('id', payload.client.id));
      return;
    }

    ensureSuccess(await db.from('clients').insert(remoteClientPayload));
  }, []);

  const syncQueuedClientMutationOperation = useCallback(async (
    operationType: 'client.update' | 'client.soft_delete',
    payload: OfflineClientMutationPayload,
  ) => {
    const remoteClientPayload = buildRemoteClientRecord(payload.changes);

    const { data: existingClient, error: existingClientError } = await db
      .from('clients')
      .select('id')
      .eq('id', payload.clientId)
      .maybeSingle();

    if (existingClientError) {
      throw existingClientError;
    }

    if (!existingClient) {
      if (
        typeof payload.changes.name !== 'string'
        || typeof payload.changes.phone !== 'string'
        || typeof payload.changes.user_id !== 'string'
      ) {
        throw new OfflineSyncConflictError(
          operationType,
          'O cliente offline nao possui dados suficientes para ser recriado no banco remoto.',
        );
      }

      ensureSuccess(await db.from('clients').insert(buildRemoteClientRecord({
        id: payload.clientId,
        ...payload.changes,
      }, true)));
      return;
    }

    ensureSuccess(await db.from('clients').update(remoteClientPayload).eq('id', payload.clientId));
  }, []);

  const syncQueuedProductCreateOperation = useCallback(async (payload: OfflineProductPayload) => {
    const remoteProductPayload = buildRemoteProductRecord(payload.product, true);

    const { data: existingProduct, error: existingProductError } = await db
      .from('products')
      .select('id')
      .eq('id', payload.product.id)
      .maybeSingle();

    if (existingProductError) {
      throw existingProductError;
    }

    if (existingProduct) {
      ensureSuccess(await db.from('products').update(buildRemoteProductRecord(payload.product)).eq('id', payload.product.id));
      return;
    }

    ensureSuccess(await db.from('products').insert(remoteProductPayload));
  }, []);

  const syncQueuedProductMutationOperation = useCallback(async (
    operationType: 'product.update' | 'product.soft_delete',
    payload: OfflineProductMutationPayload,
  ) => {
    const remoteProductPayload = buildRemoteProductRecord(payload.changes);

    const { data: existingProduct, error: existingProductError } = await db
      .from('products')
      .select('id')
      .eq('id', payload.productId)
      .maybeSingle();

    if (existingProductError) {
      throw existingProductError;
    }

    if (!existingProduct) {
      if (
        typeof payload.changes.name !== 'string'
        || typeof payload.changes.category !== 'string'
        || typeof payload.changes.user_id !== 'string'
        || typeof payload.changes.price !== 'number'
      ) {
        throw new OfflineSyncConflictError(
          operationType,
          'O produto offline nao possui dados suficientes para ser recriado no banco remoto.',
        );
      }

      ensureSuccess(await db.from('products').insert(buildRemoteProductRecord({
        id: payload.productId,
        ...payload.changes,
      }, true)));
      return;
    }

    ensureSuccess(await db.from('products').update(remoteProductPayload).eq('id', payload.productId));
  }, []);

  const syncQueuedPricingRuleCreateOperation = useCallback(async (payload: OfflinePricingRulePayload) => {
    ensureSuccess(await db.from('product_category_pricing_rules').upsert(stripSyncFields(payload.rule), { onConflict: 'id' }));
  }, []);

  const syncQueuedPricingRuleMutationOperation = useCallback(async (
    operationType: 'pricing_rule.update' | 'pricing_rule.delete',
    payload: OfflinePricingRuleMutationPayload | OfflineDeletePayload,
  ) => {
    if (operationType === 'pricing_rule.delete') {
      ensureSuccess(await db.from('product_category_pricing_rules').delete().eq('id', (payload as OfflineDeletePayload).id));
      return;
    }

    const mutationPayload = payload as OfflinePricingRuleMutationPayload;
    ensureSuccess(await db
      .from('product_category_pricing_rules')
      .update(stripSyncFields(mutationPayload.changes))
      .eq('id', mutationPayload.ruleId));
  }, []);

  const syncQueuedSaleOperation = useCallback(async (payload: OfflineSaleCreatePayload) => {
    const { sale, items, stockMovements } = payload;
    const remoteSalePayload = {
      ...stripSyncFields(sale),
      user_id: ownerUserId!,
    };

    const { data: existingSale, error: existingSaleError } = await db
      .from('sales')
      .select('id')
      .eq('id', sale.id)
      .maybeSingle();

    if (existingSaleError) {
      throw existingSaleError;
    }

    if (!existingSale) {
      const { error: insertSaleError } = await db.from('sales').insert(remoteSalePayload);
      if (insertSaleError) throw insertSaleError;
    }

    if (items.length > 0) {
      const { data: existingItems, error: existingItemsError } = await db
        .from('sale_items')
        .select('id')
        .in('id', items.map(item => item.id));

      if (existingItemsError) {
        throw existingItemsError;
      }

      const existingItemIds = new Set(((existingItems as Array<{ id: string }> | null) ?? []).map(item => item.id));
      const missingItems = items
        .filter(item => !existingItemIds.has(item.id))
        .map(item => stripSyncFields(item));

      if (missingItems.length > 0) {
        const { error: insertItemsError } = await db.from('sale_items').insert(missingItems);
        if (insertItemsError) throw insertItemsError;
      }
    }

    if (stockMovements.length === 0) {
      return;
    }

    const { data: existingMovements, error: existingMovementsError } = await db
      .from('stock_movements')
      .select('id')
      .in('id', stockMovements.map(movement => movement.id));

    if (existingMovementsError) {
      throw existingMovementsError;
    }

    const existingMovementIds = new Set(
      ((existingMovements as Array<{ id: string }> | null) ?? []).map(movement => movement.id),
    );

    for (const movement of stockMovements) {
      if (existingMovementIds.has(movement.id)) {
        continue;
      }

      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, stock, name')
        .eq('id', movement.product_id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      const product = (productData as { id: string; stock: number; name?: string | null } | null) ?? null;

      if (!product) {
        throw new OfflineSyncConflictError(
          'sale.create',
          `O produto ${movement.product_id} nao existe mais no banco remoto para sincronizar a venda offline.`,
        );
      }

      const currentStock = Number(product.stock || 0);
      if (movement.type === 'saida' && currentStock < movement.quantity) {
        throw new OfflineSyncConflictError(
          'sale.create',
          `Estoque remoto insuficiente para sincronizar ${product.name || movement.product_id}. Ajuste o estoque e tente novamente.`,
        );
      }

      const nextStock = movement.type === 'saida'
        ? currentStock - movement.quantity
        : currentStock + movement.quantity;

      ensureSuccess(await db.from('products').update({ stock: nextStock }).eq('id', movement.product_id));
      ensureSuccess(await db.from('stock_movements').insert(stripSyncFields(movement)));
    }
  }, [ownerUserId]);

  const syncQueuedSaleCancelOperation = useCallback(async (payload: OfflineSaleCancelPayload) => {
    ensureSuccess(await db.from('sales').update(stripSyncFields(payload.changes)).eq('id', payload.saleId));

    for (const stockRestore of payload.stockRestores) {
      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, stock')
        .eq('id', stockRestore.productId)
        .maybeSingle();

      if (productError) throw productError;
      const product = productData as { id: string; stock: number } | null;

      if (!product) {
        throw new OfflineSyncConflictError(
          'sale.cancel',
          `O produto ${stockRestore.productId} nao existe mais no banco remoto para restaurar o estoque.`,
        );
      }

      ensureSuccess(await db
        .from('products')
        .update({ stock: Number(product.stock || 0) + stockRestore.quantity })
        .eq('id', stockRestore.productId));
    }

    if (payload.stockMovements.length > 0) {
      ensureSuccess(await db.from('stock_movements').insert(payload.stockMovements.map(stripSyncFields)));
    }
  }, []);

  const syncQueuedDebtEntriesOperation = useCallback(async (payload: OfflineDebtEntriesPayload) => {
    if (payload.entries.length === 0) {
      return;
    }

    const { data: existingEntries, error: existingEntriesError } = await db
      .from('debt_entries')
      .select('id')
      .in('id', payload.entries.map(entry => entry.id));

    if (existingEntriesError) {
      throw existingEntriesError;
    }

    const existingEntryIds = new Set(
      ((existingEntries as Array<{ id: string }> | null) ?? []).map(entry => entry.id),
    );
    const missingEntries = payload.entries
      .filter(entry => !existingEntryIds.has(entry.id))
      .map(entry => stripSyncFields(entry));

    if (missingEntries.length > 0) {
      ensureSuccess(await db.from('debt_entries').insert(missingEntries));
    }

    const stockMovements = payload.stockMovements ?? [];
    if (stockMovements.length === 0) {
      return;
    }

    const { data: existingMovements, error: existingMovementsError } = await db
      .from('stock_movements')
      .select('id')
      .in('id', stockMovements.map(movement => movement.id));

    if (existingMovementsError) {
      throw existingMovementsError;
    }

    const existingMovementIds = new Set(
      ((existingMovements as Array<{ id: string }> | null) ?? []).map(movement => movement.id),
    );

    for (const movement of stockMovements) {
      if (existingMovementIds.has(movement.id)) {
        continue;
      }

      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, stock, name')
        .eq('id', movement.product_id)
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      const product = (productData as { id: string; stock: number; name?: string | null } | null) ?? null;
      if (!product) {
        throw new OfflineSyncConflictError(
          'debt_entries.add_many',
          `O produto ${movement.product_id} nao existe mais no banco remoto para sincronizar o fiado offline.`,
        );
      }

      const currentStock = Number(product.stock || 0);
      if (movement.type === 'saida' && currentStock < movement.quantity) {
        throw new OfflineSyncConflictError(
          'debt_entries.add_many',
          `Estoque remoto insuficiente para sincronizar ${product.name || movement.product_id}. Ajuste o estoque e tente novamente.`,
        );
      }

      const nextStock = movement.type === 'saida'
        ? currentStock - movement.quantity
        : currentStock + movement.quantity;

      ensureSuccess(await db.from('products').update({ stock: nextStock }).eq('id', movement.product_id));
      ensureSuccess(await db.from('stock_movements').insert(stripSyncFields(movement)));
    }
  }, []);

  const syncQueuedDebtEntryMutationOperation = useCallback(async (payload: OfflineDebtEntryMutationPayload) => {
    ensureSuccess(await db
      .from('debt_entries')
      .update(stripSyncFields(payload.changes))
      .eq('id', payload.entryId));

    if (payload.stockRestore) {
      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, stock')
        .eq('id', payload.stockRestore.productId)
        .maybeSingle();

      if (productError) throw productError;
      const product = productData as { id: string; stock: number } | null;

      if (!product) {
        throw new OfflineSyncConflictError(
          'debt_entry.delete',
          `O produto ${payload.stockRestore.productId} nao existe mais no banco remoto para restaurar o estoque.`,
        );
      }

      ensureSuccess(await db
        .from('products')
        .update({ stock: Number(product.stock || 0) + payload.stockRestore.quantity })
        .eq('id', payload.stockRestore.productId));
    }

    if (payload.stockMovement) {
      const { data: existingMovement, error: existingMovementError } = await db
        .from('stock_movements')
        .select('id')
        .eq('id', payload.stockMovement.id)
        .maybeSingle();

      if (existingMovementError) throw existingMovementError;

      if (!existingMovement) {
        ensureSuccess(await db.from('stock_movements').insert(stripSyncFields(payload.stockMovement)));
      }
    }
  }, []);

  const syncQueuedPaymentOperation = useCallback(async (payload: OfflinePaymentPayload) => {
    const { payment } = payload;

    const { data: existingClient, error: existingClientError } = await db
      .from('clients')
      .select('id')
      .eq('id', payment.client_id)
      .maybeSingle();

    if (existingClientError) {
      throw existingClientError;
    }

    if (!existingClient) {
      throw new OfflineSyncConflictError(
        'payment.create',
        'O cliente do pagamento offline nao existe mais no banco remoto.',
      );
    }

    const { data: existingPayment, error: existingPaymentError } = await db
      .from('payments')
      .select('id')
      .eq('id', payment.id)
      .maybeSingle();

    if (existingPaymentError) {
      throw existingPaymentError;
    }

    if (!existingPayment) {
      ensureSuccess(await db.from('payments').insert(buildRemotePaymentRecord(payment, true)));
    }
  }, []);

  const syncQueuedPaymentDeleteOperation = useCallback(async (payload: OfflineDeletePayload) => {
    ensureSuccess(await db.from('payments').delete().eq('id', payload.id));
  }, []);

  const syncQueuedCloseAllDebtOperation = useCallback(async (payload: OfflineCloseAllDebtPayload) => {
    if (payload.entryIds.length === 0) {
      if (payload.payment) {
        await syncQueuedPaymentOperation({ payment: payload.payment });
      }
      return;
    }

    const { data: remoteEntries, error: remoteEntriesError } = await db
      .from('debt_entries')
      .select('id, client_id, status, date_paid')
      .in('id', payload.entryIds);

    if (remoteEntriesError) {
      throw remoteEntriesError;
    }

    const entries = (remoteEntries as Array<{
      id: string;
      client_id: string;
      status: string;
      date_paid?: string | null;
    }> | null) ?? [];
    const entryIds = new Set(entries.map(entry => entry.id));
    const missingEntryIds = payload.entryIds.filter(entryId => !entryIds.has(entryId));

    if (missingEntryIds.length > 0) {
      throw new OfflineSyncConflictError(
        'debt_entries.close_all',
        'Alguns itens quitados offline nao existem mais no banco remoto.',
      );
    }

    const wrongClientEntry = entries.find(entry => entry.client_id !== payload.clientId);
    if (wrongClientEntry) {
      throw new OfflineSyncConflictError(
        'debt_entries.close_all',
        'Os itens da quitacao offline nao pertencem mais ao mesmo cliente no banco remoto.',
      );
    }

    const conflictingEntry = entries.find(entry => entry.status !== 'pending' && !samePaymentMoment(entry.date_paid, payload.paymentDate));
    if (conflictingEntry) {
      throw new OfflineSyncConflictError(
        'debt_entries.close_all',
        'Uma ou mais dividas ja foram alteradas remotamente e precisam de revisao antes de sincronizar.',
      );
    }

    const pendingEntryIds = entries
      .filter(entry => entry.status === 'pending')
      .map(entry => entry.id);

    if (pendingEntryIds.length > 0) {
      ensureSuccess(await db
        .from('debt_entries')
        .update({ status: 'paid', date_paid: payload.paymentDate, deleted: true, manual_deleted: false })
        .in('id', pendingEntryIds));
    }

    if (payload.payment) {
      await syncQueuedPaymentOperation({ payment: payload.payment });
    }
  }, [syncQueuedPaymentOperation]);

  const syncQueuedClearHistoryOperation = useCallback(async (payload: OfflineClearHistoryPayload) => {
    if (payload.entryIds.length === 0) {
      return;
    }

    const { data: remoteEntries, error: remoteEntriesError } = await db
      .from('debt_entries')
      .select('id, client_id')
      .in('id', payload.entryIds);

    if (remoteEntriesError) {
      throw remoteEntriesError;
    }

    const entries = (remoteEntries as Array<{ id: string; client_id: string }> | null) ?? [];
    const deletableEntryIds = entries
      .filter(entry => entry.client_id === payload.clientId)
      .map(entry => entry.id);

    if (deletableEntryIds.length === 0) {
      return;
    }

    ensureSuccess(await db.from('debt_entries').delete().in('id', deletableEntryIds));
  }, []);

  const syncQueuedExpenseOperation = useCallback(async (payload: OfflineExpensePayload) => {
    const { expense } = payload;

    const { data: existingExpense, error: existingExpenseError } = await db
      .from('expenses')
      .select('id')
      .eq('id', expense.id)
      .maybeSingle();

    if (existingExpenseError) {
      throw existingExpenseError;
    }

    if (!existingExpense) {
      const expensePayload = stripSyncFields(expense);
      const { error: insertExpenseError } = await db.from('expenses').insert(expensePayload);
      if (insertExpenseError) throw insertExpenseError;
    }
  }, []);

  const syncQueuedStockMovementOperation = useCallback(async (payload: OfflineStockMovementPayload) => {
    if (payload.stockAdjustment) {
      const { data: productData, error: productError } = await db
        .from('products')
        .select('id, stock')
        .eq('id', payload.stockAdjustment.productId)
        .maybeSingle();

      if (productError) throw productError;
      const product = productData as { id: string; stock: number } | null;

      if (!product) {
        throw new OfflineSyncConflictError(
          'stock_movement.create',
          `O produto ${payload.stockAdjustment.productId} nao existe mais no banco remoto para sincronizar o estoque.`,
        );
      }

      ensureSuccess(await db
        .from('products')
        .update({ stock: Math.max(0, Number(product.stock || 0) + payload.stockAdjustment.delta) })
        .eq('id', payload.stockAdjustment.productId));
    }

    ensureSuccess(await db.from('stock_movements').insert(stripSyncFields(payload.movement)));
  }, []);

  const syncQueuedClearAllStockOperation = useCallback(async (payload: OfflineClearAllStockPayload) => {
    for (const update of payload.productUpdates) {
      ensureSuccess(await db.from('products').update({ stock: update.stock }).eq('id', update.productId));
    }

    if (payload.stockMovements.length > 0) {
      ensureSuccess(await db.from('stock_movements').insert(payload.stockMovements.map(stripSyncFields)));
    }
  }, []);

  const syncQueuedExpenseDeleteOperation = useCallback(async (payload: OfflineDeletePayload) => {
    ensureSuccess(await db.from('expenses').delete().eq('id', payload.id));
  }, []);

  const syncQueuedRewardCreateOperation = useCallback(async (payload: OfflineRewardPayload) => {
    ensureSuccess(await db.from('rewards').upsert(buildRemoteRewardRecord(payload.reward, true), { onConflict: 'id' }));
  }, []);

  const syncQueuedRewardMutationOperation = useCallback(async (
    operationType: 'reward.update' | 'reward.delete',
    payload: OfflineRewardMutationPayload | OfflineDeletePayload,
  ) => {
    if (operationType === 'reward.delete') {
      ensureSuccess(await db.from('rewards').delete().eq('id', (payload as OfflineDeletePayload).id));
      return;
    }

    const mutationPayload = payload as OfflineRewardMutationPayload;
    ensureSuccess(await db.from('rewards').update(buildRemoteRewardRecord(mutationPayload.changes)).eq('id', mutationPayload.rewardId));
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    if (
      offlineSyncInFlightRef.current
      || !canUseOfflineConcentrator
      || !ownerUserId
      || !user
      || isDemoMode
      || typeof navigator === 'undefined'
      || navigator.onLine === false
    ) {
      return;
    }

    offlineSyncInFlightRef.current = true;

    try {
      const pendingItems = await listOfflineQueue(ownerUserId, ['pending', 'processing']);

      for (const queueItem of pendingItems) {
        await updateOfflineQueueItem({
          id: queueItem.id,
          status: 'processing',
          lastError: null,
          incrementAttempt: queueItem.status !== 'processing',
        });

        try {
          if (queueItem.operationType === 'cash_session.open' && queueItem.payload) {
            await syncQueuedCashSessionOpenOperation(queueItem.payload as OfflineCashSessionOpenPayload);
          } else if (queueItem.operationType === 'cash_session.close' && queueItem.payload) {
            await syncQueuedCashSessionCloseOperation(queueItem.payload as OfflineCashSessionClosePayload);
          } else if (queueItem.operationType === 'client.create' && queueItem.payload) {
            await syncQueuedClientCreateOperation(queueItem.payload as OfflineClientPayload);
          } else if (queueItem.operationType === 'client.update' && queueItem.payload) {
            await syncQueuedClientMutationOperation('client.update', queueItem.payload as OfflineClientMutationPayload);
          } else if (queueItem.operationType === 'client.soft_delete' && queueItem.payload) {
            await syncQueuedClientMutationOperation('client.soft_delete', queueItem.payload as OfflineClientMutationPayload);
          } else if (queueItem.operationType === 'product.create' && queueItem.payload) {
            await syncQueuedProductCreateOperation(queueItem.payload as OfflineProductPayload);
          } else if (queueItem.operationType === 'product.update' && queueItem.payload) {
            await syncQueuedProductMutationOperation('product.update', queueItem.payload as OfflineProductMutationPayload);
          } else if (queueItem.operationType === 'product.soft_delete' && queueItem.payload) {
            await syncQueuedProductMutationOperation('product.soft_delete', queueItem.payload as OfflineProductMutationPayload);
          } else if (queueItem.operationType === 'pricing_rule.create' && queueItem.payload) {
            await syncQueuedPricingRuleCreateOperation(queueItem.payload as OfflinePricingRulePayload);
          } else if (queueItem.operationType === 'pricing_rule.update' && queueItem.payload) {
            await syncQueuedPricingRuleMutationOperation('pricing_rule.update', queueItem.payload as OfflinePricingRuleMutationPayload);
          } else if (queueItem.operationType === 'pricing_rule.delete' && queueItem.payload) {
            await syncQueuedPricingRuleMutationOperation('pricing_rule.delete', queueItem.payload as OfflineDeletePayload);
          } else if (queueItem.operationType === 'sale.create' && queueItem.payload) {
            await syncQueuedSaleOperation(queueItem.payload as OfflineSaleCreatePayload);
          } else if (queueItem.operationType === 'sale.cancel' && queueItem.payload) {
            await syncQueuedSaleCancelOperation(queueItem.payload as OfflineSaleCancelPayload);
          } else if (queueItem.operationType === 'debt_entries.add_many' && queueItem.payload) {
            await syncQueuedDebtEntriesOperation(queueItem.payload as OfflineDebtEntriesPayload);
          } else if (queueItem.operationType === 'debt_entry.update' && queueItem.payload) {
            await syncQueuedDebtEntryMutationOperation(queueItem.payload as OfflineDebtEntryMutationPayload);
          } else if (queueItem.operationType === 'debt_entry.delete' && queueItem.payload) {
            await syncQueuedDebtEntryMutationOperation(queueItem.payload as OfflineDebtEntryMutationPayload);
          } else if (queueItem.operationType === 'debt_entries.close_all' && queueItem.payload) {
            await syncQueuedCloseAllDebtOperation(queueItem.payload as OfflineCloseAllDebtPayload);
          } else if (queueItem.operationType === 'debt_entries.clear_history' && queueItem.payload) {
            await syncQueuedClearHistoryOperation(queueItem.payload as OfflineClearHistoryPayload);
          } else if (queueItem.operationType === 'payment.create' && queueItem.payload) {
            await syncQueuedPaymentOperation(queueItem.payload as OfflinePaymentPayload);
          } else if (queueItem.operationType === 'payment.delete' && queueItem.payload) {
            await syncQueuedPaymentDeleteOperation(queueItem.payload as OfflineDeletePayload);
          } else if (queueItem.operationType === 'stock_movement.create' && queueItem.payload) {
            await syncQueuedStockMovementOperation(queueItem.payload as OfflineStockMovementPayload);
          } else if (queueItem.operationType === 'stock.clear_all' && queueItem.payload) {
            await syncQueuedClearAllStockOperation(queueItem.payload as OfflineClearAllStockPayload);
          } else if (queueItem.operationType === 'expense.create' && queueItem.payload) {
            await syncQueuedExpenseOperation(queueItem.payload as OfflineExpensePayload);
          } else if (queueItem.operationType === 'expense.delete' && queueItem.payload) {
            await syncQueuedExpenseDeleteOperation(queueItem.payload as OfflineDeletePayload);
          } else if (queueItem.operationType === 'reward.create' && queueItem.payload) {
            await syncQueuedRewardCreateOperation(queueItem.payload as OfflineRewardPayload);
          } else if (queueItem.operationType === 'reward.update' && queueItem.payload) {
            await syncQueuedRewardMutationOperation('reward.update', queueItem.payload as OfflineRewardMutationPayload);
          } else if (queueItem.operationType === 'reward.delete' && queueItem.payload) {
            await syncQueuedRewardMutationOperation('reward.delete', queueItem.payload as OfflineDeletePayload);
          }

          await updateOfflineQueueItem({
            id: queueItem.id,
            status: 'synced',
            lastError: null,
            syncedAt: nowIso(),
          });
        } catch (error) {
          if (error instanceof OfflineSyncConflictError) {
            await updateOfflineQueueItem({
              id: queueItem.id,
              status: 'conflict',
              lastError: error.message,
            });
            await recordOfflineConflict(
              ownerUserId,
              queueItem.id,
              queueItem.operationType,
              error.message,
              (queueItem.payload ?? null) as OfflineOperationPayload,
            );
            continue;
          }

          await updateOfflineQueueItem({
            id: queueItem.id,
            status: 'pending',
            lastError: error instanceof Error ? error.message : 'Falha ao sincronizar a fila offline.',
          });
        }
      }

      await fetchAll();
      await cleanupOfflineData(ownerUserId);
    } finally {
      offlineSyncInFlightRef.current = false;
    }
  }, [
    canUseOfflineConcentrator,
    fetchAll,
    isDemoMode,
    ownerUserId,
    syncQueuedCashSessionCloseOperation,
    syncQueuedCashSessionOpenOperation,
    syncQueuedClearHistoryOperation,
    syncQueuedClientCreateOperation,
    syncQueuedClientMutationOperation,
    syncQueuedCloseAllDebtOperation,
    syncQueuedClearAllStockOperation,
    syncQueuedDebtEntriesOperation,
    syncQueuedDebtEntryMutationOperation,
    syncQueuedExpenseDeleteOperation,
    syncQueuedExpenseOperation,
    syncQueuedPaymentDeleteOperation,
    syncQueuedPaymentOperation,
    syncQueuedPricingRuleCreateOperation,
    syncQueuedPricingRuleMutationOperation,
    syncQueuedProductCreateOperation,
    syncQueuedProductMutationOperation,
    syncQueuedRewardCreateOperation,
    syncQueuedRewardMutationOperation,
    syncQueuedSaleCancelOperation,
    syncQueuedSaleOperation,
    syncQueuedStockMovementOperation,
    user,
  ]);

  useEffect(() => {
    if (!canUseOfflineConcentrator || !ownerUserId || isDemoMode) {
      return;
    }

    const handleOnline = () => {
      void syncOfflineQueue();
    };

    void cleanupOfflineData(ownerUserId);

    const intervalId = window.setInterval(() => {
      void syncOfflineQueue();
      void cleanupOfflineData(ownerUserId);
    }, 20_000);

    window.addEventListener('online', handleOnline);
    void syncOfflineQueue();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [canUseOfflineConcentrator, isDemoMode, ownerUserId, syncOfflineQueue]);

  // --- Clients ---
  const addClient = async (name: string, phone: string, creditLimit?: number | null) => {
    const normalizedCreditLimit = normalizeCreditLimit(creditLimit);

    if (isDemoMode) {
      const client: Client = {
        id: createId(),
        name,
        phone,
        credit_limit: normalizedCreditLimit,
        created_at: nowIso(),
        deleted: false,
        deleted_at: null,
        user_id: ownerUserId!,
      };
      setClients(prev => sortClientsByCreatedAt([client, ...prev]));
      return;
    }

    const addOfflineClient = async () => {
      const client: Client = {
        id: createId(),
        name,
        phone,
        credit_limit: normalizedCreditLimit,
        created_at: nowIso(),
        deleted: false,
        deleted_at: null,
        user_id: ownerUserId!,
        sync_status: 'queued',
        sync_error: null,
      };

      const queued = await enqueueOfflineOperation(ownerUserId!, 'client.create', {
        client,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar o cliente na fila offline.');
      }

      setClients(prev => sortClientsByCreatedAt([client, ...prev]));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineClient();
      return;
    }

    try {
      const { data, error } = await db
        .from('clients')
        .insert({ name, phone, credit_limit: normalizedCreditLimit, user_id: ownerUserId! })
        .select('*')
        .single();
      if (error) throw error;
      setClients(prev => sortClientsByCreatedAt([data as Client, ...prev.filter(client => client.id !== data.id)]));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineClient();
        return;
      }

      throw error;
    }
  };
  const updateClient = async (id: string, data: Partial<Client>) => {
    const currentClient = clients.find(client => client.id === id);

    if (!currentClient) {
      throw new Error('Cliente nao encontrado para atualizacao.');
    }

    if (isDemoMode) {
      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? { ...client, ...data } : client)));
      return;
    }

    const updateOfflineClient = async () => {
      const nextClient: Client = {
        ...currentClient,
        ...data,
        sync_status: 'queued',
        sync_error: null,
      };

      const queued = await enqueueOfflineOperation(ownerUserId!, 'client.update', {
        clientId: id,
        changes: nextClient,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a atualizacao do cliente na fila offline.');
      }

      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? nextClient : client)));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await updateOfflineClient();
      return;
    }

    try {
      const { data: updated, error } = await db.from('clients').update(data).eq('id', id).select('*').single();
      if (error) throw error;
      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? updated as Client : client)));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await updateOfflineClient();
        return;
      }

      throw error;
    }
  };
  const softDeleteClient = async (id: string) => {
    const currentClient = clients.find(client => client.id === id);

    if (!currentClient) {
      throw new Error('Cliente nao encontrado para exclusao.');
    }

    if (isDemoMode) {
      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? { ...client, deleted: true, deleted_at: nowIso() } : client)));
      return;
    }

    const softDeleteOfflineClient = async () => {
      const deletedAt = nowIso();
      const nextClient: Client = {
        ...currentClient,
        deleted: true,
        deleted_at: deletedAt,
        sync_status: 'queued',
        sync_error: null,
      };

      const queued = await enqueueOfflineOperation(ownerUserId!, 'client.soft_delete', {
        clientId: id,
        changes: nextClient,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a exclusao do cliente na fila offline.');
      }

      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? nextClient : client)));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await softDeleteOfflineClient();
      return;
    }

    try {
      const { data: updated, error } = await db.from('clients').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      setClients(prev => sortClientsByCreatedAt(prev.map(client => client.id === id ? updated as Client : client)));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await softDeleteOfflineClient();
        return;
      }

      throw error;
    }
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

    const addOfflineProduct = async () => {
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
        sync_status: 'queued',
        sync_error: null,
      } as Product, products);

      const queued = await enqueueOfflineOperation(ownerUserId!, 'product.create', {
        product,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar o produto na fila offline.');
      }

      setProducts(prev => [...prev, product]);
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineProduct();
      return;
    }

    try {
      const { data, error } = await db.from('products').insert({
        user_id: ownerUserId!,
        ...buildRemoteProductRecord(productPayload),
      } as Record<string, unknown>).select('*').single();
      if (error) throw error;
      setProducts(prev => [...prev, withDisplayCode(data as Product, prev)]);
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineProduct();
        return;
      }

      throw error;
    }
  };
  const updateProduct = async (id: string, data: Partial<Product>) => {
    const currentProduct = products.find(product => product.id === id);

    if (!currentProduct) {
      throw new Error('Produto nao encontrado para atualizacao.');
    }

    const productPayload = prepareProductPayload({ ...currentProduct, ...data });

    if (isDemoMode) {
      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode({ ...product, ...productPayload } as Product, prev) : product));
      return;
    }

    const updateOfflineProduct = async () => {
      const nextProduct = withDisplayCode({
        ...currentProduct,
        ...productPayload,
        sync_status: 'queued',
        sync_error: null,
      } as Product, products);

      const queued = await enqueueOfflineOperation(ownerUserId!, 'product.update', {
        productId: id,
        changes: nextProduct,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a atualizacao do produto na fila offline.');
      }

      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(nextProduct, prev) : product));
      void recordAuditLog('product.update', 'product', id, {
        name: currentProduct.name,
        changes: productPayload,
        offline: true,
      });
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await updateOfflineProduct();
      return;
    }

    try {
      const { data: updated, error } = await db
        .from('products')
        .update(buildRemoteProductRecord(productPayload))
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(updated as Product, prev) : product));
      void recordAuditLog('product.update', 'product', id, {
        name: currentProduct.name,
        changes: productPayload,
      });
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await updateOfflineProduct();
        return;
      }

      throw error;
    }
  };
  const deleteProduct = async (id: string) => {
    const currentProduct = products.find(product => product.id === id);

    if (!currentProduct) {
      throw new Error('Produto nao encontrado para exclusao.');
    }

    if (isDemoMode) {
      setProducts(prev => prev.map(product => product.id === id ? { ...product, deleted: true, deleted_at: nowIso() } : product));
      return;
    }

    const deleteOfflineProduct = async () => {
      const deletedAt = nowIso();
      const nextProduct = withDisplayCode({
        ...currentProduct,
        deleted: true,
        deleted_at: deletedAt,
        sync_status: 'queued',
        sync_error: null,
      } as Product, products);

      const queued = await enqueueOfflineOperation(ownerUserId!, 'product.soft_delete', {
        productId: id,
        changes: nextProduct,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a exclusao do produto na fila offline.');
      }

      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(nextProduct, prev) : product));
      void recordAuditLog('product.delete', 'product', id, {
        name: currentProduct.name,
        offline: true,
      });
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflineProduct();
      return;
    }

    try {
      const { data: updated, error } = await db.from('products').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) throw error;
      setProducts(prev => prev.map(product => product.id === id ? withDisplayCode(updated as Product, prev) : product));
      void recordAuditLog('product.delete', 'product', id, { name: currentProduct.name });
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflineProduct();
        return;
      }

      throw error;
    }
  };
  const ensureStockAvailable = (demands: StockDemand[]) => {
    const demandByProduct = demands
      .filter(item => item.productId && item.quantity > 0)
      .reduce((map, item) => {
        const productId = item.productId!;
        const current = map.get(productId) ?? { productName: item.productName, quantity: 0 };
        current.quantity += item.quantity;
        map.set(productId, current);
        return map;
      }, new Map<string, { productName: string; quantity: number }>());

    for (const [productId, demand] of demandByProduct.entries()) {
      const product = products.find(item => item.id === productId);
      if (!product || product.deleted) continue;

      const availableStock = Number(product.stock || 0);
      if (availableStock <= 0) continue;

      if (availableStock < demand.quantity) {
        throw new Error(`Estoque insuficiente para ${product.name || demand.productName}. Disponivel: ${availableStock}, solicitado: ${demand.quantity}.`);
      }
    }
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

    const addOfflinePricingRule = async () => {
      const createdAt = nowIso();
      const rule = normalizePricingRuleRow({
        id: createId(),
        created_at: createdAt,
        updated_at: createdAt,
        ...normalizedRule,
      } as ProductCategoryPricingRule);

      const queued = await enqueueOfflineOperation(ownerUserId!, 'pricing_rule.create', { rule });
      if (!queued) throw new Error('Nao foi possivel registrar a regra de precificacao na fila offline.');

      setPricingRules(prev => [...prev, rule].sort((a, b) => a.category.localeCompare(b.category)));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflinePricingRule();
      return;
    }

    try {
      const { data, error } = await db.from('product_category_pricing_rules').insert(normalizedRule).select('*').single();
      if (error) throw error;
      setPricingRules(prev => [...prev, normalizePricingRuleRow(data as ProductCategoryPricingRule)].sort((a, b) => a.category.localeCompare(b.category)));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflinePricingRule();
        return;
      }

      throw error;
    }
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

    const updateOfflinePricingRule = async () => {
      const changes = { ...payload, updated_at: nowIso() };
      const queued = await enqueueOfflineOperation(ownerUserId!, 'pricing_rule.update', { ruleId: id, changes });
      if (!queued) throw new Error('Nao foi possivel registrar a regra de precificacao na fila offline.');

      setPricingRules(prev =>
        prev
          .map(rule => rule.id === id ? normalizePricingRuleRow({ ...rule, ...changes }) : rule)
          .sort((a, b) => a.category.localeCompare(b.category))
      );
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await updateOfflinePricingRule();
      return;
    }

    try {
      const { data: updated, error } = await db.from('product_category_pricing_rules').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      setPricingRules(prev =>
        prev
          .map(rule => rule.id === id ? normalizePricingRuleRow(updated as ProductCategoryPricingRule) : rule)
          .sort((a, b) => a.category.localeCompare(b.category))
      );
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await updateOfflinePricingRule();
        return;
      }

      throw error;
    }
  };
  const deletePricingRule = async (id: string) => {
    if (isDemoMode) {
      setPricingRules(prev => prev.filter(rule => rule.id !== id));
      return;
    }

    const deleteOfflinePricingRule = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'pricing_rule.delete', { id });
      if (!queued) throw new Error('Nao foi possivel registrar a exclusao da regra de precificacao na fila offline.');
      setPricingRules(prev => prev.filter(rule => rule.id !== id));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflinePricingRule();
      return;
    }

    try {
      ensureSuccess(await db.from('product_category_pricing_rules').delete().eq('id', id));
      setPricingRules(prev => prev.filter(rule => rule.id !== id));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflinePricingRule();
        return;
      }

      throw error;
    }
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

  const recordAuditLog = async (
    action: string,
    entityType: string,
    entityId: string | null,
    details: Record<string, unknown> = {},
  ) => {
    if (isDemoMode || !ownerUserId) return;

    try {
      await db.from('audit_logs' as never).insert({
        owner_user_id: ownerUserId,
        actor_user_id: user?.id ?? null,
        actor_label: user?.email ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      } as never);
    } catch (error) {
      console.warn('Nao foi possivel registrar auditoria:', error);
    }
  };

  // --- Debt Entries ---
  const addDebtEntry = async (clientId: string, productId: string, productName: string, quantity: number, unitPrice: number, dateAdded?: string, registeredBy?: string) => {
    await addDebtEntries([
      {
        clientId,
        productId,
        productName,
        quantity,
        unitPrice,
        dateAdded,
        registeredBy,
      },
    ]);
  };

  const addDebtEntries = async (
    entries: DebtEntryInput[],
    options: AddDebtEntriesOptions = {},
  ) => {
    if (entries.length === 0) return;

    const shouldAdjustStock = options.adjustStock !== false;
    const stockReason = options.stockReason ?? 'Fiado';
    const totalsByClient = entries.reduce((map, entry) => {
      map.set(entry.clientId, (map.get(entry.clientId) || 0) + entry.quantity * entry.unitPrice);
      return map;
    }, new Map<string, number>());

    for (const [clientId, requestedAmount] of totalsByClient) {
      const client = clients.find(item => item.id === clientId);
      const creditLimit = getClientCreditLimit(client);
      if (client && creditLimit !== null) {
        const currentBalance = getClientBalance(clientId);
        if (currentBalance + requestedAmount > creditLimit + 0.009) {
          throw new Error(getCreditLimitExceededMessage(client.name, creditLimit, currentBalance, requestedAmount));
        }
      }
    }

    if (shouldAdjustStock) {
      ensureStockAvailable(entries.map(entry => ({
        productId: entry.productId,
        productName: entry.productName,
        quantity: entry.quantity,
      })));
    }

    const buildStockMovements = (date = nowIso(), queued = false) => entries
      .filter(entry => entry.productId && entry.quantity > 0)
      .map(entry => ({
        id: createId(),
        product_id: entry.productId,
        user_id: ownerUserId!,
        type: 'saida',
        quantity: entry.quantity,
        reason: stockReason,
        date,
        ...(queued ? { sync_status: 'queued', sync_error: null } : {}),
      } as StockMovement));
    const applyLocalStockAdjustment = (stockMovements: StockMovement[]) => {
      if (!shouldAdjustStock || stockMovements.length === 0) return;
      setProducts(prev => prev.map(product => {
        const soldQuantity = stockMovements
          .filter(movement => movement.product_id === product.id)
          .reduce((sum, movement) => sum + movement.quantity, 0);
        if (soldQuantity === 0) return product;
        return { ...product, stock: Math.max(0, (product.stock || 0) - soldQuantity) };
      }));
      setStockMovements(prev => [...stockMovements, ...prev]);
    };

    if (isDemoMode) {
      const movementDate = nowIso();
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
      const stockMovements = shouldAdjustStock ? buildStockMovements(movementDate) : [];
      setDebtEntries(prev => sortDebtEntriesByDateAdded([...nextEntries, ...prev]));
      applyLocalStockAdjustment(stockMovements);
      return;
    }

    const addOfflineDebtEntries = async () => {
      const movementDate = nowIso();
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
        sync_status: 'queued',
        sync_error: null,
      } as DebtEntry));
      const stockMovements = shouldAdjustStock ? buildStockMovements(movementDate, true) : [];

      const queued = await enqueueOfflineOperation(ownerUserId!, 'debt_entries.add_many', {
        entries: nextEntries,
        stockMovements,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar os fiados na fila offline.');
      }

      setDebtEntries(prev => sortDebtEntriesByDateAdded([...nextEntries, ...prev]));
      applyLocalStockAdjustment(stockMovements);
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineDebtEntries();
      return;
    }

    try {
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

      let insertedStockMovements: StockMovement[] = [];
      if (shouldAdjustStock) {
        const productQuantities = entries
          .filter(entry => entry.productId && entry.quantity > 0)
          .reduce((map, entry) => {
            map.set(entry.productId, (map.get(entry.productId) || 0) + entry.quantity);
            return map;
          }, new Map<string, number>());
        const stockUpdates = Array.from(productQuantities.entries())
          .map(([productId, quantity]) => {
            const product = products.find(p => p.id === productId);
            if (!product || product.stock <= 0) return null;
            const newStock = Math.max(0, product.stock - quantity);
            return db.from('products').update({ stock: newStock }).eq('id', productId);
          })
          .filter(Boolean);
        await Promise.all(stockUpdates.map(async update => ensureSuccess(await update)));

        const stockMovementsPayload = entries
          .filter(entry => entry.productId && entry.quantity > 0)
          .map(entry => ({
            product_id: entry.productId,
            user_id: ownerUserId!,
            type: 'saida',
            quantity: entry.quantity,
            reason: stockReason,
          }));

        if (stockMovementsPayload.length > 0) {
          const { data: movementRows, error: movementError } = await db.from('stock_movements').insert(stockMovementsPayload).select('*');
          if (movementError) throw movementError;
          insertedStockMovements = (movementRows as StockMovement[]) ?? [];
        }
      }

      setDebtEntries(prev => sortDebtEntriesByDateAdded([...((data as DebtEntry[]) ?? []), ...prev]));
      applyLocalStockAdjustment(insertedStockMovements);
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineDebtEntries();
        return;
      }

      throw error;
    }
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

    const updateOfflineDebtEntry = async () => {
      const changes = {
        ...mapped,
        sync_status: 'queued',
        sync_error: null,
      };
      const queued = await enqueueOfflineOperation(ownerUserId!, 'debt_entry.update', {
        entryId: id,
        changes,
      });
      if (!queued) throw new Error('Nao foi possivel registrar a atualizacao do fiado na fila offline.');
      setDebtEntries(prev => prev.map(entry => entry.id === id ? { ...entry, ...changes } as DebtEntry : entry));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await updateOfflineDebtEntry();
      return;
    }

    try {
      ensureSuccess(await db.from('debt_entries').update(mapped as Record<string, unknown>).eq('id', id));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await updateOfflineDebtEntry();
        return;
      }

      throw error;
    }
  };
  const deleteDebtEntry = async (id: string, reason: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode excluir itens da caderneta.');
    }

    const entryToDelete = debtEntries.find(entry => entry.id === id);
    const shouldRestoreStock = Boolean(
      entryToDelete
      && !entryToDelete.deleted
      && entryToDelete.status === 'pending'
      && entryToDelete.product_id
      && entryToDelete.quantity > 0,
    );

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new Error('Informe o motivo da exclusão do item.');
    }

    const deletedAt = nowIso();
    const stockMovement = shouldRestoreStock && entryToDelete ? {
      id: createId(),
      product_id: entryToDelete.product_id,
      user_id: ownerUserId!,
      type: 'entrada',
      quantity: entryToDelete.quantity,
      reason: `Estorno fiado: ${trimmedReason}`,
      date: deletedAt,
    } as StockMovement : null;

    const applyDebtDeletionState = (changes: Partial<DebtEntry>, movement: StockMovement | null) => {
      setDebtEntries(prev => prev.map(entry => entry.id === id ? { ...entry, ...changes } as DebtEntry : entry));
      if (!movement) return;
      setProducts(prev => prev.map(product =>
        product.id === movement.product_id
          ? { ...product, stock: (product.stock || 0) + movement.quantity }
          : product
      ));
      setStockMovements(prev => [movement, ...prev]);
    };

    if (isDemoMode) {
      applyDebtDeletionState({
        deleted: true,
        manual_deleted: true,
        deleted_at: deletedAt,
        deleted_reason: trimmedReason,
        deleted_by: user?.email ?? 'Administrador',
      }, stockMovement);
      return;
    }

    const changes = {
      deleted: true,
      manual_deleted: true,
      deleted_at: deletedAt,
      deleted_reason: trimmedReason,
      deleted_by: user?.email ?? 'Administrador',
    };

    const deleteOfflineDebtEntry = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'debt_entry.delete', {
        entryId: id,
        changes: {
          ...changes,
          sync_status: 'queued',
          sync_error: null,
        },
        stockMovement: stockMovement ? { ...stockMovement, sync_status: 'queued', sync_error: null } : null,
        stockRestore: stockMovement ? {
          productId: stockMovement.product_id,
          quantity: stockMovement.quantity,
        } : null,
      });
      if (!queued) throw new Error('Nao foi possivel registrar a exclusao do fiado na fila offline.');
      applyDebtDeletionState({ ...changes, sync_status: 'queued', sync_error: null }, stockMovement);
      void recordAuditLog('debt_entry.delete', 'debt_entry', id, {
        productName: entryToDelete?.product_name,
        quantity: entryToDelete?.quantity,
        reason: trimmedReason,
        restoredStock: Boolean(stockMovement),
        offline: true,
      });
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflineDebtEntry();
      return;
    }

    try {
      ensureSuccess(await db.from('debt_entries').update(changes).eq('id', id));
      if (stockMovement) {
        const product = products.find(item => item.id === stockMovement.product_id);
        if (product) {
          ensureSuccess(await db
            .from('products')
            .update({ stock: (product.stock || 0) + stockMovement.quantity })
            .eq('id', stockMovement.product_id));
        }
        const { data: movementRow, error: movementError } = await db
          .from('stock_movements')
          .insert({
            product_id: stockMovement.product_id,
            user_id: ownerUserId!,
            type: stockMovement.type,
            quantity: stockMovement.quantity,
            reason: stockMovement.reason,
          })
          .select('*')
          .single();
        if (movementError) throw movementError;
        applyDebtDeletionState(changes, movementRow as StockMovement);
        void recordAuditLog('debt_entry.delete_restore_stock', 'debt_entry', id, {
          productName: entryToDelete?.product_name,
          quantity: entryToDelete?.quantity,
          reason: trimmedReason,
        });
        return;
      }
      await fetchAll();
      void recordAuditLog('debt_entry.delete', 'debt_entry', id, {
        productName: entryToDelete?.product_name,
        quantity: entryToDelete?.quantity,
        reason: trimmedReason,
      });
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflineDebtEntry();
        return;
      }

      throw error;
    }
  };

  // --- Payments ---
  const addPayment = async (clientId: string, amount: number, type: 'total' | 'partial', date?: string, details: unknown = null) => {
    const paymentDetails = normalizePaymentDetails(details);

    if (isDemoMode) {
      const payment: Payment = {
        id: createId(),
        client_id: clientId,
        amount,
        type,
        date: date || nowIso(),
        details: paymentDetails,
      };
      setPayments(prev => sortPaymentsByDate([payment, ...prev]));
      return;
    }

    const addOfflinePayment = async () => {
      const payment: Payment = {
        id: createId(),
        client_id: clientId,
        amount,
        type,
        date: date || nowIso(),
        details: paymentDetails,
        sync_status: 'queued',
        sync_error: null,
      };

      const queued = await enqueueOfflineOperation(ownerUserId!, 'payment.create', {
        payment,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar o pagamento na fila offline.');
      }

      setPayments(prev => sortPaymentsByDate([payment, ...prev]));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflinePayment();
      return;
    }

    try {
      const payment: Payment = {
        id: createId(),
        client_id: clientId,
        amount,
        type,
        date: date || nowIso(),
        details: paymentDetails,
      };

      ensureSuccess(await db.from('payments').insert(buildRemotePaymentRecord(payment, true)));
      setPayments(prev => sortPaymentsByDate([payment, ...prev]));
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflinePayment();
        return;
      }

      throw error;
    }
  };
  const deletePayment = async (id: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode excluir pagamentos da caderneta.');
    }
    if (isDemoMode) {
      setPayments(prev => prev.filter(payment => payment.id !== id));
      return;
    }

    const deleteOfflinePayment = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'payment.delete', { id });
      if (!queued) throw new Error('Nao foi possivel registrar a exclusao do pagamento na fila offline.');
      setPayments(prev => prev.filter(payment => payment.id !== id));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflinePayment();
      return;
    }

    try {
      ensureSuccess(await db.from('payments').delete().eq('id', id));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflinePayment();
        return;
      }

      throw error;
    }
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

  const closeAllDebt = async (clientId: string, date?: string, details: unknown = null) => {
    const balance = getClientBalance(clientId);
    const paymentDate = date || new Date().toISOString();
    const paymentDetails = normalizePaymentDetails(details);
    const pendingIds = debtEntries.filter(d => d.client_id === clientId && isVisiblePendingDebtEntry(d)).map(d => d.id);

    if (balance <= 0 && pendingIds.length === 0) {
      return;
    }

    if (isDemoMode) {
      if (balance > 0) {
        setPayments(prev => sortPaymentsByDate([{
          id: createId(),
          client_id: clientId,
          amount: balance,
          type: 'total',
          date: paymentDate,
          details: paymentDetails,
        }, ...prev]));
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

    const closeAllDebtOffline = async () => {
      const payment = balance > 0
        ? {
            id: createId(),
            client_id: clientId,
            amount: balance,
            type: 'total',
            date: paymentDate,
            details: paymentDetails,
            sync_status: 'queued',
            sync_error: null,
          } as Payment
        : null;

      const queued = await enqueueOfflineOperation(ownerUserId!, 'debt_entries.close_all', {
        clientId,
        payment,
        entryIds: pendingIds,
        paymentDate,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a quitacao na fila offline.');
      }

      if (payment) {
        setPayments(prev => sortPaymentsByDate([payment, ...prev]));
      }

      if (pendingIds.length > 0) {
        setDebtEntries(prev => prev.map(entry =>
          pendingIds.includes(entry.id)
            ? {
                ...entry,
                status: 'paid',
                date_paid: paymentDate,
                deleted: true,
                manual_deleted: false,
                sync_status: 'queued',
                sync_error: null,
              }
            : entry
        ));
      }
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await closeAllDebtOffline();
      return;
    }

    try {
      if (balance > 0) {
        const { error } = await db
          .from('payments')
          .insert({ client_id: clientId, amount: balance, type: 'total', date: paymentDate, details: paymentDetails });

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
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await closeAllDebtOffline();
        return;
      }

      throw error;
    }
  };

  const deleteClientHistory = async (clientId: string) => {
    if (!isAdmin) {
      throw new Error('Operador não pode limpar histórico da caderneta.');
    }

    const entryIds = debtEntries
      .filter(entry => entry.client_id === clientId)
      .map(entry => entry.id);

    if (isDemoMode) {
      setDebtEntries(prev => prev.filter(entry => entry.client_id !== clientId));
      return;
    }

    const deleteOfflineClientHistory = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'debt_entries.clear_history', {
        clientId,
        entryIds,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a limpeza do historico na fila offline.');
      }

      setDebtEntries(prev => prev.filter(entry => !entryIds.includes(entry.id)));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflineClientHistory();
      return;
    }

    try {
      ensureSuccess(await db.from('debt_entries').delete().eq('client_id', clientId));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflineClientHistory();
        return;
      }

      throw error;
    }
  };

  // --- Sales (PDV) ---
  const createSale = async (
    sale: Omit<Sale, 'id' | 'created_at' | 'date'>,
    items: Omit<SaleItem, 'id' | 'sale_id'>[],
  ) => {
    const itemsWithMetrics = buildSaleItemPricingMetrics(items, sale.discount ?? 0);

    ensureStockAvailable(itemsWithMetrics.map(item => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
    })));

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

    const createOfflineSale = async () => {
      const saleId = createId();
      const createdAt = nowIso();
      const saleRow: Sale = {
        id: saleId,
        created_at: createdAt,
        date: createdAt,
        ...sale,
        user_id: ownerUserId!,
        sync_status: 'queued',
        sync_error: null,
      };
      const saleRows = itemsWithMetrics.map(item => ({
        ...item,
        id: createId(),
        sale_id: saleId,
        sync_status: 'queued',
        sync_error: null,
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
          sync_status: 'queued',
          sync_error: null,
        } as StockMovement));

      const queued = await enqueueOfflineOperation(ownerUserId!, 'sale.create', {
        sale: saleRow,
        items: saleRows,
        stockMovements: movements,
        stockAdjustments: saleRows
          .filter(item => item.product_id)
          .map(item => ({
            productId: item.product_id!,
            quantity: item.quantity,
          })),
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a venda na fila offline.');
      }

      setSales(prev => [saleRow, ...prev]);
      setSaleItems(prev => [...saleRows, ...prev]);
      setProducts(prev => prev.map(product => {
        const soldQuantity = itemsWithMetrics
          .filter(item => item.product_id === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (soldQuantity === 0) return product;
        return { ...product, stock: Math.max(0, (product.stock || 0) - soldQuantity) };
      }));
      if (movements.length > 0) {
        setStockMovements(prev => [...movements, ...prev]);
      }

      return {
        sale: saleRow,
        items: saleRows,
      };
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return createOfflineSale();
    }

    try {
      const salePayload = {
        ...sale,
        user_id: ownerUserId!,
      } as Record<string, unknown>;
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

      const productQuantities = itemsWithMetrics
        .filter(item => item.product_id)
        .reduce((map, item) => {
          const productId = item.product_id!;
          map.set(productId, (map.get(productId) || 0) + item.quantity);
          return map;
        }, new Map<string, number>());
      const stockUpdates = Array.from(productQuantities.entries())
        .map(([productId, quantity]) => {
          const product = products.find(p => p.id === productId);
          if (!product) return null;
          const newStock = Math.max(0, product.stock - quantity);
          return db.from('products').update({ stock: newStock }).eq('id', productId);
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
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        return createOfflineSale();
      }

      throw error;
    }
  };

  const cancelSale = async (saleId: string, reason: string) => {
    const buildCancelSaleState = () => {
      const itemsToRestore = saleItems.filter(item => item.sale_id === saleId && item.product_id);
      const cancelledAt = nowIso();
      const changes = {
        status: 'cancelled',
        cancel_reason: reason,
        cancelled_at: cancelledAt,
      };
      const stockMovements = itemsToRestore.map(item => ({
        id: createId(),
        product_id: item.product_id!,
        user_id: ownerUserId!,
        type: 'entrada',
        quantity: item.quantity,
        reason: `Cancelamento venda: ${reason}`,
        date: cancelledAt,
      } as StockMovement));
      const stockRestores = itemsToRestore.map(item => ({
        productId: item.product_id!,
        quantity: item.quantity,
      }));

      return { itemsToRestore, changes, stockMovements, stockRestores };
    };

    const applyCancelSaleState = (
      changes: Partial<Sale>,
      stockMovements: StockMovement[],
      itemsToRestore: SaleItem[],
    ) => {
      setSales(prev => prev.map(item => item.id === saleId ? { ...item, ...changes } : item));
      setProducts(prev => prev.map(product => {
        const restoredQuantity = itemsToRestore
          .filter(item => item.product_id === product.id)
          .reduce((sum, item) => sum + item.quantity, 0);
        if (restoredQuantity === 0) return product;
        return { ...product, stock: (product.stock || 0) + restoredQuantity };
      }));
      if (stockMovements.length > 0) {
        setStockMovements(prev => [...stockMovements, ...prev]);
      }
    };

    if (isDemoMode) {
      const { changes, stockMovements, itemsToRestore } = buildCancelSaleState();
      applyCancelSaleState(changes, stockMovements, itemsToRestore);
      return;
    }

    const cancelOfflineSale = async () => {
      const { changes, stockMovements, stockRestores, itemsToRestore } = buildCancelSaleState();
      const queued = await enqueueOfflineOperation(ownerUserId!, 'sale.cancel', {
        saleId,
        changes: {
          ...changes,
          sync_status: 'queued',
          sync_error: null,
        },
        stockMovements: stockMovements.map(movement => ({ ...movement, sync_status: 'queued', sync_error: null })),
        stockRestores,
      });
      if (!queued) throw new Error('Nao foi possivel registrar o cancelamento da venda na fila offline.');
      applyCancelSaleState({ ...changes, sync_status: 'queued', sync_error: null }, stockMovements, itemsToRestore);
      void recordAuditLog('sale.cancel', 'sale', saleId, {
        reason,
        restoredItems: itemsToRestore.length,
        offline: true,
      });
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await cancelOfflineSale();
      return;
    }

    try {
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
      void recordAuditLog('sale.cancel', 'sale', saleId, {
        reason,
        restoredItems: itemsToRestore.length,
      });
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await cancelOfflineSale();
        return;
      }

      throw error;
    }
  };

  // --- Stock ---
  const addStockMovement = async (productId: string, type: string, quantity: number, reason: string) => {
    const currentProduct = products.find(product => product.id === productId);
    const stockDelta = type === 'entrada' ? quantity : -quantity;
    const nextStock = currentProduct
      ? Math.max(0, Number(currentProduct.stock || 0) + stockDelta)
      : null;
    const applyStockMovementState = (movement: StockMovement) => {
      setStockMovements(prev => [movement, ...prev]);
      if (nextStock === null) return;
      setProducts(prev => prev.map(product => (
        product.id === productId
          ? { ...product, stock: nextStock }
          : product
      )));
    };

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
      applyStockMovementState(movement);
      return;
    }

    const addOfflineStockMovement = async () => {
      const movement: StockMovement = {
        id: createId(),
        product_id: productId,
        user_id: ownerUserId!,
        type,
        quantity,
        reason,
        date: nowIso(),
        sync_status: 'queued',
        sync_error: null,
      };
      const queued = await enqueueOfflineOperation(ownerUserId!, 'stock_movement.create', {
        movement,
        stockAdjustment: nextStock === null ? null : {
          productId,
          delta: stockDelta,
        },
      });
      if (!queued) throw new Error('Nao foi possivel registrar a movimentacao de estoque na fila offline.');
      applyStockMovementState(movement);
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineStockMovement();
      return;
    }

    try {
      const { data, error } = await db.from('stock_movements').insert({ product_id: productId, user_id: ownerUserId!, type, quantity, reason }).select('*').single();
      if (error) throw error;
      if (nextStock !== null) {
        ensureSuccess(await db
          .from('products')
          .update({ stock: nextStock })
          .eq('id', productId));
      }
      applyStockMovementState(data as StockMovement);
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineStockMovement();
        return;
      }

      throw error;
    }
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

    const clearOfflineStock = async () => {
      const movementDate = nowIso();
      const stockMovements = stockedProducts.map(product => ({
        id: createId(),
        product_id: product.id,
        user_id: ownerUserId!,
        type: 'saida',
        quantity: product.stock,
        reason,
        date: movementDate,
        sync_status: 'queued',
        sync_error: null,
      } as StockMovement));
      const productUpdates = stockedProducts.map(product => ({
        productId: product.id,
        stock: 0,
      }));

      const queued = await enqueueOfflineOperation(ownerUserId!, 'stock.clear_all', {
        productUpdates,
        stockMovements,
      });
      if (!queued) throw new Error('Nao foi possivel registrar a limpeza de estoque na fila offline.');

      setProducts(prev => prev.map(product => (product.deleted || (product.stock || 0) <= 0 ? product : { ...product, stock: 0, sync_status: 'queued', sync_error: null })));
      setStockMovements(prev => [...stockMovements, ...prev]);
      void recordAuditLog('stock.clear_all', 'stock', null, {
        reason,
        products: stockedProducts.length,
        offline: true,
      });
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await clearOfflineStock();
      return;
    }

    const stockedIds = stockedProducts.map(product => product.id);
    try {
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
      void recordAuditLog('stock.clear_all', 'stock', null, {
        reason,
        products: stockedProducts.length,
      });
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await clearOfflineStock();
        return;
      }

      throw error;
    }
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

    const addOfflineExpense = async () => {
      const expense: Expense = {
        id: createId(),
        user_id: ownerUserId!,
        operator_user_id: metadata?.operatorUserId ?? null,
        cash_session_id: metadata?.cashSessionId ?? null,
        description,
        amount,
        category,
        date: metadata?.date || nowIso(),
        sync_status: 'queued',
        sync_error: null,
      };

      const queued = await enqueueOfflineOperation(ownerUserId!, 'expense.create', {
        expense,
      });

      if (!queued) {
        throw new Error('Nao foi possivel registrar a despesa na fila offline.');
      }

      setExpenses(prev => [expense, ...prev]);
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineExpense();
      return;
    }

    try {
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
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineExpense();
        return;
      }

      throw error;
    }
  };
  const deleteExpense = async (id: string) => {
    if (isDemoMode) {
      setExpenses(prev => prev.filter(expense => expense.id !== id));
      return;
    }

    const deleteOfflineExpense = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'expense.delete', { id });
      if (!queued) throw new Error('Nao foi possivel registrar a exclusao da despesa na fila offline.');
      setExpenses(prev => prev.filter(expense => expense.id !== id));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflineExpense();
      return;
    }

    try {
      ensureSuccess(await db.from('expenses').delete().eq('id', id));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflineExpense();
        return;
      }

      throw error;
    }
  };

  // --- Rewards ---
  const addReward = async (name: string, description: string, minimum_spending: number, options: Partial<Reward> = {}) => {
    const rewardPayload: Omit<Reward, 'id' | 'created_at' | 'user_id'> = {
      name,
      description,
      minimum_spending,
      enabled: options.enabled ?? true,
      reward_type: options.reward_type ?? 'gift',
      reward_value: Number(options.reward_value ?? 0) || 0,
      points_cost: Number(options.points_cost ?? 0) || 0,
      validity_days: Number(options.validity_days ?? 30) || 30,
      allow_pdv_redemption: options.allow_pdv_redemption ?? true,
      auto_apply: options.auto_apply ?? false,
      notes: options.notes ?? '',
    };

    if (isDemoMode) {
      setRewards(prev => [{
        id: createId(),
        created_at: nowIso(),
        user_id: ownerUserId!,
        ...rewardPayload,
      }, ...prev]);
      return;
    }

    const addOfflineReward = async () => {
      const reward: Reward = {
        id: createId(),
        created_at: nowIso(),
        user_id: ownerUserId!,
        ...rewardPayload,
        name,
        description,
        minimum_spending,
      };
      const queued = await enqueueOfflineOperation(ownerUserId!, 'reward.create', { reward });
      if (!queued) throw new Error('Nao foi possivel registrar a recompensa na fila offline.');
      setRewards(prev => [reward, ...prev]);
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await addOfflineReward();
      return;
    }

    try {
      ensureSuccess(await db.from('rewards').insert(buildRemoteRewardRecord({ user_id: ownerUserId!, ...rewardPayload })));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await addOfflineReward();
        return;
      }

      throw error;
    }
  };

  const updateReward = async (id: string, data: Partial<Reward>) => {
    if (isDemoMode) {
      setRewards(prev => prev.map(reward => reward.id === id ? { ...reward, ...data } : reward));
      return;
    }

    const updateOfflineReward = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'reward.update', {
        rewardId: id,
        changes: data,
      });
      if (!queued) throw new Error('Nao foi possivel registrar a atualizacao da recompensa na fila offline.');
      setRewards(prev => prev.map(reward => reward.id === id ? { ...reward, ...data } : reward));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await updateOfflineReward();
      return;
    }

    try {
      ensureSuccess(await db.from('rewards').update(buildRemoteRewardRecord(data)).eq('id', id));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await updateOfflineReward();
        return;
      }

      throw error;
    }
  };

  const deleteReward = async (id: string) => {
    if (isDemoMode) {
      setRewards(prev => prev.filter(reward => reward.id !== id));
      return;
    }

    const deleteOfflineReward = async () => {
      const queued = await enqueueOfflineOperation(ownerUserId!, 'reward.delete', { id });
      if (!queued) throw new Error('Nao foi possivel registrar a exclusao da recompensa na fila offline.');
      setRewards(prev => prev.filter(reward => reward.id !== id));
    };

    if (canUseOfflineConcentrator && typeof navigator !== 'undefined' && navigator.onLine === false) {
      await deleteOfflineReward();
      return;
    }

    try {
      ensureSuccess(await db.from('rewards').delete().eq('id', id));
      await fetchAll();
    } catch (error) {
      if (canUseOfflineConcentrator && isProbablyOfflineError(error)) {
        await deleteOfflineReward();
        return;
      }

      throw error;
    }
  };

  return (
    <DataContext.Provider value={{
      clients, products, debtEntries, payments, rewards, sales, saleItems, stockMovements, expenses, pricingRules, priceHistory, loading,
      offlinePreparationStatus, offlinePreparationMessage, offlineSnapshotUpdatedAt,
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
