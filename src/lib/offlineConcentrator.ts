import type {
  Client,
  DebtEntry,
  Expense,
  Payment,
  Product,
  ProductPackaging,
  ProductCategoryPricingRule,
  ProductPriceHistoryEntry,
  Reward,
  Sale,
  SaleItem,
  ServiceTicket,
  ServiceTicketItem,
  StockMovement,
} from '@/types';

export type OfflineOperationStatus = 'pending' | 'processing' | 'synced' | 'conflict';
export type OfflineOperationType =
  | 'cash_session.open'
  | 'cash_session.close'
  | 'client.create'
  | 'client.update'
  | 'client.soft_delete'
  | 'store_operational_settings.update'
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
  storeOperationalSettings?: {
    blockSaleWithoutStock: boolean;
  };
  productPackagings: ProductPackaging[];
  debtEntries: DebtEntry[];
  payments: Payment[];
  rewards: Reward[];
  sales: Sale[];
  saleItems: SaleItem[];
  serviceTickets: ServiceTicket[];
  serviceTicketItems: ServiceTicketItem[];
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

export interface OfflineStoreOperationalSettingsPayload {
  blockSaleWithoutStock: boolean;
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
  stockMovement?: StockMovement | null;
  stockRestore?: {
    productId: string;
    quantity: number;
  } | null;
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
    location_id?: string | null;
    terminal_id?: string | null;
  };
}

export interface OfflineCashSessionClosePayload {
  sessionId: string;
  closedAt: string;
  closedByUserId: string | null;
  closedByName: string;
  closingBalance: number;
  expectedBalance?: number;
  countedBalance?: number;
  differenceReason?: string | null;
}

export type OfflineOperationPayload =
  | OfflineCashSessionOpenPayload
  | OfflineCashSessionClosePayload
  | OfflineClientPayload
  | OfflineClientMutationPayload
  | OfflineStoreOperationalSettingsPayload
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
  productContext?: 'happycash';
  installerToken?: string | null;
}

export interface DesktopUpdateStatus {
  status: 'disabled' | 'idle' | 'checking' | 'publishing' | 'downloading' | 'downloaded' | 'installing' | 'error';
  channel: string | null;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadedFile: string | null;
  manualDownloadUrl: string | null;
  installStartedAt: string | null;
  progress: number | null;
  bytesPerSecond: number | null;
  transferred: number | null;
  total: number | null;
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
    productContext?: 'happycash';
    installerToken?: string | null;
  };
};

const getNativeOfflineApi = () => {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI?.offline ?? window.happyCashMobileAPI?.offline;
};

const getNativeAppApi = () => {
  if (typeof window === 'undefined') return undefined;
  return window.electronAPI?.app ?? window.happyCashMobileAPI?.app;
};

const isHappyCashMobileUserAgent = () =>
  typeof navigator !== 'undefined' && /HappyCashAndroid\//i.test(navigator.userAgent);

export const isOfflineConcentratorAvailable = () =>
  Boolean(getNativeOfflineApi());

export const isDesktopRuntime = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI);

export const isMobileAppRuntime = () =>
  typeof window !== 'undefined' && (Boolean(window.happyCashMobileAPI) || isHappyCashMobileUserAgent());

export const isLocalAppRuntime = () => isDesktopRuntime() || isMobileAppRuntime();

const noopSnapshotResult = {
  snapshot: null,
  updatedAt: null,
};

export const readDesktopRuntimeInfo = async () => {
  const appApi = getNativeAppApi();
  if (!appApi?.getRuntimeInfo) return null;
  return appApi.getRuntimeInfo() as Promise<DesktopRuntimeInfo>;
};

export const readDesktopUpdateStatus = async () => {
  if (!window.electronAPI?.app) return null;
  return window.electronAPI.app.getUpdateStatus() as Promise<DesktopUpdateStatus>;
};

export const checkDesktopUpdates = async (options?: { autoInstallOnDownloaded?: boolean }) => {
  if (!window.electronAPI?.app) return null;
  return window.electronAPI.app.checkForUpdates(options) as Promise<DesktopUpdateStatus>;
};

export const installDesktopUpdate = async () => {
  if (!window.electronAPI?.app?.installUpdate) return { success: false, error: 'Instalacao indisponivel fora do desktop.' };
  return window.electronAPI.app.installUpdate() as Promise<{ success?: boolean; error?: string }>;
};

export const openDesktopUpdateDownload = async () => {
  if (!window.electronAPI?.app?.openUpdateDownload) return { success: false, error: 'Download manual indisponivel fora do desktop.' };
  return window.electronAPI.app.openUpdateDownload() as Promise<{ success?: boolean; error?: string; url?: string }>;
};

export const onDesktopUpdateStatus = (callback: (status: DesktopUpdateStatus) => void) => {
  if (!window.electronAPI?.app?.onUpdateStatus) return () => {};
  return window.electronAPI.app.onUpdateStatus((status) => callback(status as DesktopUpdateStatus));
};

export const replaceOfflineSnapshot = async (ownerUserId: string, snapshot: OfflineSnapshot) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.replaceSnapshot({ ownerUserId, snapshot });
};

export const getOfflineSnapshot = async (ownerUserId: string): Promise<{
  snapshot: OfflineSnapshot | null;
  updatedAt: string | null;
}> => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return noopSnapshotResult;
  return offlineApi.getSnapshot({ ownerUserId }) as Promise<{
    snapshot: OfflineSnapshot | null;
    updatedAt: string | null;
  }>;
};

export const enqueueOfflineOperation = async (
  ownerUserId: string,
  operationType: OfflineOperationType,
  payload: OfflineOperationPayload,
) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.enqueue({ ownerUserId, operationType, payload }) as Promise<OfflineQueueItem | null>;
};

export const listOfflineQueue = async (
  ownerUserId: string,
  statuses?: OfflineOperationStatus[],
) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return [];
  return offlineApi.listQueue({ ownerUserId, statuses }) as Promise<OfflineQueueItem[]>;
};

export const updateOfflineQueueItem = async (payload: OfflineQueueUpdateInput) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.updateQueueItem(payload) as Promise<OfflineQueueItem | null>;
};

export const recordOfflineConflict = async (
  ownerUserId: string,
  operationId: string,
  operationType: OfflineOperationType,
  message: string,
  payload: OfflineOperationPayload,
) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.recordConflict({
    ownerUserId,
    operationId,
    operationType,
    message,
    payload,
  }) as Promise<OfflineConflictRecord | null>;
};

export const listOfflineConflicts = async (ownerUserId: string) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return [];
  return offlineApi.listConflicts({ ownerUserId }) as Promise<OfflineConflictRecord[]>;
};

export const resolveOfflineConflict = async (id: string, resolved = true) => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.resolveConflict({ id, resolved }) as Promise<OfflineConflictRecord | null>;
};

export const retryOfflineOperation = async (
  operationId: string,
  resolveConflicts = true,
): Promise<OfflineRetryResult | null> => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.retryOperation({ operationId, resolveConflicts }) as Promise<OfflineRetryResult | null>;
};

export const cleanupOfflineData = async (ownerUserId: string): Promise<OfflineCleanupResult | null> => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.cleanupData({ ownerUserId }) as Promise<OfflineCleanupResult | null>;
};

export const getOfflineStatus = async (ownerUserId: string): Promise<OfflineStatus | null> => {
  const offlineApi = getNativeOfflineApi();
  if (!offlineApi) return null;
  return offlineApi.getStatus({ ownerUserId }) as Promise<OfflineStatus>;
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
