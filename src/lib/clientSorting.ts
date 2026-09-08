import type { Client } from '@/types';

type ClientMetricGetter = (clientId: string) => number;

export function compareClientsByDebt(
  a: Client,
  b: Client,
  getClientBalance: ClientMetricGetter,
  getClientTotalSpending: ClientMetricGetter,
) {
  const balanceDiff = getClientBalance(b.id) - getClientBalance(a.id);
  if (balanceDiff !== 0) return balanceDiff;

  const spendingDiff = getClientTotalSpending(b.id) - getClientTotalSpending(a.id);
  if (spendingDiff !== 0) return spendingDiff;

  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

export function sortClientsByDebt(
  clients: Client[],
  getClientBalance: ClientMetricGetter,
  getClientTotalSpending: ClientMetricGetter,
) {
  return [...clients].sort((a, b) =>
    compareClientsByDebt(a, b, getClientBalance, getClientTotalSpending),
  );
}
