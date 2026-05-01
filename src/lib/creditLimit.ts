import type { Client } from '@/types';

export const normalizeCreditLimit = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Number(numericValue.toFixed(2)));
};

export const getClientCreditLimit = (client?: Pick<Client, 'credit_limit'> | null) =>
  normalizeCreditLimit(client?.credit_limit);

export const getAvailableClientCredit = (client: Pick<Client, 'credit_limit'> | null | undefined, balance: number) => {
  const creditLimit = getClientCreditLimit(client);
  if (creditLimit === null) return null;
  return Math.max(0, Number((creditLimit - balance).toFixed(2)));
};

export const getCreditLimitExceededMessage = (
  clientName: string,
  creditLimit: number,
  currentBalance: number,
  requestedAmount: number,
) => {
  const exceededBy = Math.max(0, currentBalance + requestedAmount - creditLimit);
  return `Limite de crédito de ${clientName} excedido em R$ ${exceededBy.toFixed(2)}. Limite: R$ ${creditLimit.toFixed(2)}.`;
};
