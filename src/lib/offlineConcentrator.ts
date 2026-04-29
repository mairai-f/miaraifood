import type {
  Client,
  DebtEntry,
  Expense,
  Payment,
  Product,
  ProductCategoryPricingRule,
  ProductPriceHistoryEntry,
  Reward,
  Sale,
  SaleItem,
  StockMovement,
} from '@/types';

export type OfflineOperationStatus = 'pending' | 'processing' | 'synced' | 'conflict';
export type OfflineOperationType =
  | 'cash_session.open'
  | 'cash_session.close'
  | 'client.create'
  | 'client.update'
  | 'client.soft_delete'
  | 'product.create'
  | 'product.update'
  | 'product.soft_delete'
  | 'pricing_rule.create'
  | 'pricing_rule.update'
  | 'pricing_rule.delete'
  | 'sale.create'
  | 'sale.cancel'
  | 'debt_entries.add_many'
  | 'debt_entry.update'
  | 'debt_entry.delete'
  | 'debt_entries.close_all'
  | 'debt_entries.clear_history'
  | 'payment.create'
  | 'payment.delete'
  | 'stock_movement.create'
  | 'stock.clear_all'
  | 'expense.create'
  | 'expense.delete'
  | 'reward.create'
  | 'reward.update'
  | 'reward.delete';

export interface OfflineSnapshot {
  clients: Client[];
  products: Product[];
  debtEntries: DebtEntry[];
  payments: Payment[];
  rewards: Reward[];
  sales: Sale[];
  saleItems: SaleItem[];
  stockMovements: StockMovement[];
  expenses: Expense[];
  pricingRules: ProductCategoryPricingRule[];
  priceHistory: ProductPriceHistoryEntry[];
  savedAt: string;
}

export interface OfflineSaleCreatePayload {
  sale: Sale;
  items: SaleItem[];
  stockMovements: StockMovement[];
  stockAdjustments: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface OfflineDebtEntriesPayload {
  entries: DebtEntry[];
  stockMovements?: StockMovement[];
}

export interface OfflineClientPayload {
  client: Client;
}

export interface OfflineClientMutationPayload {
  clientId: string;
  changes: Partial<Client>;
}

export interface OfflineProductPayload {
  product: Product;
}

export interface OfflineProductMutationPayload {
  productId: string;
  changes: Partial<Product>;
}

export interface OfflinePricingRulePayload {
  rule: ProductCategoryPricingRule;
}

export interface OfflinePricingRuleMutationPayload {
  ruleId: string;
  changes: Partial<ProductCategoryPricingRule>;
}

export interface OfflineDeletePayload {
  id: string;
}

export interface OfflinePaymentPayload {
  payment: Payment;
}

export interface OfflineDebtEntryMutationPayload {
  entryId: string;
  changes: Partial<DebtEntry>;
}

export interface OfflineSaleCancelPayload {
  saleId: string;
  changes: Partial<Sale>;
  stockMovements: StockMovement[];
  stockRestores: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface OfflineCloseAllDebtPayload {
  clientId: string;
  payment: Payment | null;
  entryIds: string[];
  paymentDate: string;
}

export interface OfflineClearHistoryPayload {
  clientId: string;
  entryIds: string[];
}

export interface OfflineExpensePayload {
  expense: Expense;
}

export interface OfflineStockMovementPayload {
  movement: StockMovement;
  stockAdjustment?: {
    productId: string;
    delta: number;
  } | null;
}

export interface OfflineClearAllStockPayload {
  productUpdates: Array<{
    productId: string;
    stock: number;
  }>;
  stockMovements: StockMovement[];
}

export interface OfflineRewardPayload {
  reward: Reward;
}

export interface OfflineRewardMutationPayload {
  rewardId: string;
  changes: Partial<Reward>;
}

export interface OfflineCashSessionOpenPayload {
  session: {
    id: string;
    owner_user_id: string;
    operator_user_id: string;
    operator_name: string;
    opened_by_name: string;
    opening_amount: number;
    opened_at: string;
    status: 'open';
  };
}

export interface OfflineCashSessionClosePayload {
  sessionId: string;
  closedAt: string;
  closedByUserId: string | null;
  closedByName: string;
  closingBalance: number;
}

export type OfflineOperationPayload =
  | OfflineCashSessionOpenPayload
  | OfflineCashSessionClosePayload
  | OfflineClientPayload
  | OfflineClientMutationPayload
  | OfflineProductPayload
  | OfflineProductMutationPayload
  | OfflinePricingRulePayload
  | OfflinePricingRuleMutationPayload
  | OfflineDeletePayload
  | OfflineSaleCreatePayload
  | OfflineSaleCancelPayload
  | OfflineDebtEntriesPayload
  | OfflineDebtEntryMutationPayload
  | OfflineCloseAllDebtPayload
  | OfflineClearHistoryPayload
  | OfflinePaymentPayload
  | OfflineExpensePayload
  | OfflineStockMovementPayload
  | OfflineClearAllStockPayload
  | OfflineRewardPayload
  | OfflineRewardMutationPayload;

export interface OfflineQueueItem {
  id: string;
  ownerUserId: string;
  operationType: OfflineOperationType;
  payload: OfflineOperationPayload | null;
  status: OfflineOperationStatus;
  lastError: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
}

export interface OfflineConflictRecord {
  id: string;
  ownerUserId: string;
  operationId: string;
  operationType: OfflineOperationType;
  message: string;
  payload: OfflineOperationPayload | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface OfflineRetryResult {
  queueItem: OfflineQueueItem | null;
  conflicts: OfflineConflictRecord[];
}

export interface OfflineCleanupResult {
  deletedSyncedQueueItems: number;
  deletedResolvedConflicts: number;
}

export interface DesktopRuntimeInfo {
  appVersion: string;
  isPackaged: boolean;
  platform: string;
  databasePath: string;
  updateChannel: string;
}

export interface DesktopUpdateStatus {
  status: 'disabled' | 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error';
  channel: string | null;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  checkedAt: string | null;
  error: string | null;
}

type OfflineQueueUpdateInput = {
  id: string;
  status?: OfflineOperationStatus;
  lastError?: string | null;
  syncedAt?: string | null;
  incrementAttempt?: boolean;
};

export type OfflineStatus = {
  pendingCount: number;
  processingCount: number;
  syncedCount: number;
  conflictCount: number;
  recordedConflictCount: number;
  snapshotUpdatedAt: string | null;
  runtime: {
    appVersion: string;
    isPackaged: boolean;
    platform: string;
    databasePath: string;
    updateChannel: string;
  };
};

export const isOfflineConcentratorAvailable = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI?.offline);

export const isDesktopRuntime = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI);

const noopSnapshotResult = {
  snapshot: null,
  updatedAt: null,
};

export const readDesktopRuntimeInfo = async () => {
  if (!window.electronAPI?.app) return null;
  return window.electronAPI.app.getRuntimeInfo() as Promise<DesktopRuntimeInfo>;
};

export const readDesktopUpdateStatus = async () => {
  if (!window.electronAPI?.app) return null;
  return window.electronAPI.app.getUpdateStatus() as Promise<DesktopUpdateStatus>;
};

export const checkDesktopUpdates = async () => {
  if (!window.electronAPI?.app) return null;
  return window.electronAPI.app.checkForUpdates() as Promise<DesktopUpdateStatus>;
};

export const replaceOfflineSnapshot = async (ownerUserId: string, snapshot: OfflineSnapshot) => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.replaceSnapshot({ ownerUserId, snapshot });
};

export const getOfflineSnapshot = async (ownerUserId: string): Promise<{
  snapshot: OfflineSnapshot | null;
  updatedAt: string | null;
}> => {
  if (!window.electronAPI?.offline) return noopSnapshotResult;
  return window.electronAPI.offline.getSnapshot({ ownerUserId });
};

export const enqueueOfflineOperation = async (
  ownerUserId: string,
  operationType: OfflineOperationType,
  payload: OfflineOperationPayload,
) => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.enqueue({ ownerUserId, operationType, payload }) as Promise<OfflineQueueItem | null>;
};

export const listOfflineQueue = async (
  ownerUserId: string,
  statuses?: OfflineOperationStatus[],
) => {
  if (!window.electronAPI?.offline) return [];
  return window.electronAPI.offline.listQueue({ ownerUserId, statuses }) as Promise<OfflineQueueItem[]>;
};

export const updateOfflineQueueItem = async (payload: OfflineQueueUpdateInput) => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.updateQueueItem(payload) as Promise<OfflineQueueItem | null>;
};

export const recordOfflineConflict = async (
  ownerUserId: string,
  operationId: string,
  operationType: OfflineOperationType,
  message: string,
  payload: OfflineOperationPayload,
) => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.recordConflict({
    ownerUserId,
    operationId,
    operationType,
    message,
    payload,
  }) as Promise<OfflineConflictRecord | null>;
};

export const listOfflineConflicts = async (ownerUserId: string) => {
  if (!window.electronAPI?.offline) return [];
  return window.electronAPI.offline.listConflicts({ ownerUserId }) as Promise<OfflineConflictRecord[]>;
};

export const resolveOfflineConflict = async (id: string, resolved = true) => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.resolveConflict({ id, resolved }) as Promise<OfflineConflictRecord | null>;
};

export const retryOfflineOperation = async (
  operationId: string,
  resolveConflicts = true,
): Promise<OfflineRetryResult | null> => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.retryOperation({ operationId, resolveConflicts }) as Promise<OfflineRetryResult | null>;
};

export const cleanupOfflineData = async (ownerUserId: string): Promise<OfflineCleanupResult | null> => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.cleanupData({ ownerUserId }) as Promise<OfflineCleanupResult | null>;
};

export const getOfflineStatus = async (ownerUserId: string): Promise<OfflineStatus | null> => {
  if (!window.electronAPI?.offline) return null;
  return window.electronAPI.offline.getStatus({ ownerUserId }) as Promise<OfflineStatus>;
};

export const isProbablyOfflineError = (error: unknown) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch')
  );
};
