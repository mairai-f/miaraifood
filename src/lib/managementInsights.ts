import type { Client, DebtEntry, Payment, Product, Sale } from '@/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const INACTIVE_CLIENT_DAYS = 30;
export const OLD_DEBT_DAYS = 15;
export const VIP_SPENDING_THRESHOLD = 500;
export const RECURRENT_ACTIVITY_THRESHOLD = 5;

const parseTime = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

export const getDaysSince = (value: string | null | undefined, now = new Date()) => {
  const timestamp = parseTime(value);
  if (!timestamp) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / MS_PER_DAY));
};

const isPendingVisibleDebt = (entry: DebtEntry) =>
  entry.status === 'pending'
  && !entry.deleted
  && entry.manual_deleted !== true;

export const getClientLastActivityAt = (
  client: Client,
  debtEntries: DebtEntry[],
  payments: Payment[],
  sales: Sale[] = [],
) => {
  const timestamps = [
    parseTime(client.created_at),
    ...debtEntries
      .filter((entry) => entry.client_id === client.id && !entry.deleted && entry.manual_deleted !== true)
      .map((entry) => parseTime(entry.date_paid || entry.date_added)),
    ...payments
      .filter((payment) => payment.client_id === client.id)
      .map((payment) => parseTime(payment.date)),
    ...sales
      .filter((sale) => sale.client_id === client.id && sale.status !== 'canceled')
      .map((sale) => parseTime(sale.date || sale.created_at)),
  ].filter((timestamp): timestamp is number => typeof timestamp === 'number');

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

export const getClientOldestPendingDebtAt = (clientId: string, debtEntries: DebtEntry[]) => {
  const timestamps = debtEntries
    .filter((entry) => entry.client_id === clientId && isPendingVisibleDebt(entry))
    .map((entry) => parseTime(entry.date_added))
    .filter((timestamp): timestamp is number => typeof timestamp === 'number');

  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps)).toISOString();
};

export type ClientCrmTag = 'VIP' | 'Recorrente' | 'Devedor' | 'Fiado antigo' | 'Inativo' | 'Em dia';

export type ClientCrmSummary = {
  clientId: string;
  lastActivityAt: string | null;
  daysInactive: number | null;
  oldestPendingDebtAt: string | null;
  oldestDebtDays: number | null;
  hasOldDebt: boolean;
  isInactive: boolean;
  tags: ClientCrmTag[];
  priority: number;
};

export const buildClientCrmSummary = ({
  client,
  debtEntries,
  payments,
  sales = [],
  balance,
  totalSpending,
  now = new Date(),
}: {
  client: Client;
  debtEntries: DebtEntry[];
  payments: Payment[];
  sales?: Sale[];
  balance: number;
  totalSpending: number;
  now?: Date;
}): ClientCrmSummary => {
  const lastActivityAt = getClientLastActivityAt(client, debtEntries, payments, sales);
  const daysInactive = getDaysSince(lastActivityAt, now);
  const oldestPendingDebtAt = getClientOldestPendingDebtAt(client.id, debtEntries);
  const oldestDebtDays = getDaysSince(oldestPendingDebtAt, now);
  const clientDebtCount = debtEntries.filter((entry) => entry.client_id === client.id && !entry.deleted).length;
  const clientPaymentCount = payments.filter((payment) => payment.client_id === client.id).length;
  const hasOldDebt = Boolean(balance > 0 && oldestDebtDays !== null && oldestDebtDays >= OLD_DEBT_DAYS);
  const isInactive = Boolean(daysInactive !== null && daysInactive >= INACTIVE_CLIENT_DAYS);
  const tags: ClientCrmTag[] = [];

  if (totalSpending >= VIP_SPENDING_THRESHOLD) tags.push('VIP');
  if (clientDebtCount + clientPaymentCount >= RECURRENT_ACTIVITY_THRESHOLD) tags.push('Recorrente');
  if (balance > 0) tags.push('Devedor');
  if (hasOldDebt) tags.push('Fiado antigo');
  if (isInactive) tags.push('Inativo');
  if (balance <= 0 && totalSpending > 0) tags.push('Em dia');

  return {
    clientId: client.id,
    lastActivityAt,
    daysInactive,
    oldestPendingDebtAt,
    oldestDebtDays,
    hasOldDebt,
    isInactive,
    tags,
    priority: (hasOldDebt ? 50 : 0) + (balance > 0 ? 20 : 0) + (isInactive ? 15 : 0) + (totalSpending >= VIP_SPENDING_THRESHOLD ? 10 : 0),
  };
};

export type PurchaseSuggestion = {
  productId: string;
  productName: string;
  supplierName: string;
  currentStock: number;
  minStock: number;
  suggestedQuantity: number;
  severity: 'critical' | 'attention';
};

export const buildLowStockPurchaseSuggestion = (product: Product): PurchaseSuggestion | null => {
  const currentStock = Number(product.stock ?? 0);
  const minStock = Number(product.min_stock ?? 0);

  if (product.deleted || minStock <= 0 || currentStock > minStock) {
    return null;
  }

  const targetStock = Math.max(minStock * 2, minStock + 1);
  const suggestedQuantity = Math.max(1, Math.ceil(targetStock - currentStock));

  return {
    productId: product.id,
    productName: product.name,
    supplierName: product.supplier_name?.trim() || 'Fornecedor nao informado',
    currentStock,
    minStock,
    suggestedQuantity,
    severity: currentStock <= 0 ? 'critical' : 'attention',
  };
};
