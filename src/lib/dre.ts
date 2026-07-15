import type { Expense, Sale, SaleItem } from '@/types';
import type { FinancialAccount } from '@/types/operations';
import { getFinancialAccountPaidAmount } from '@/lib/erpFinance';

type DreInput = {
  sales: Sale[];
  saleItems: SaleItem[];
  expenses: Expense[];
  financialAccounts: FinancialAccount[];
  startDate: string;
  endDate: string;
};

export type DreStatement = {
  grossRevenue: number;
  salesDiscounts: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  manualExpenses: number;
  paidOperatingPayables: number;
  operatingExpenses: number;
  otherRevenue: number;
  operatingProfit: number;
  netIncome: number;
  grossMarginPct: number;
  netMarginPct: number;
  expenseRatioPct: number;
  validSalesCount: number;
  expenseBreakdown: Array<{ name: string; amount: number }>;
};

const isDateInRange = (value: string | null | undefined, startDate: string, endDate: string) => {
  if (!value) return false;
  const timestamp = new Date(value.includes('T') ? value : `${value}T12:00:00`).getTime();
  return timestamp >= new Date(`${startDate}T00:00:00`).getTime()
    && timestamp <= new Date(`${endDate}T23:59:59`).getTime();
};

const isActiveSale = (sale: Sale) =>
  !['canceled', 'cancelled'].includes(String(sale.status ?? '').toLowerCase());

const isPurchasePayable = (account: FinancialAccount) =>
  account.account_type === 'payable' && account.source === 'purchase';

export const getFinancialAccountPaidAmountInRange = (
  account: FinancialAccount,
  startDate: string,
  endDate: string,
) => {
  const history = Array.isArray(account.payment_history) ? account.payment_history : [];
  if (history.length > 0) {
    return history
      .filter((payment) => isDateInRange(payment.paid_at, startDate, endDate))
      .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  }

  if (account.status !== 'paid' || !isDateInRange(account.paid_at, startDate, endDate)) {
    return 0;
  }

  return getFinancialAccountPaidAmount(account);
};

export const getPreviousPeriodRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - days + 1);
  return {
    startDate: previousStart.toISOString().slice(0, 10),
    endDate: previousEnd.toISOString().slice(0, 10),
  };
};

export const getVariationPct = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const buildDreStatement = ({
  sales,
  saleItems,
  expenses,
  financialAccounts,
  startDate,
  endDate,
}: DreInput): DreStatement => {
  const validSales = sales.filter((sale) => isActiveSale(sale) && isDateInRange(sale.date, startDate, endDate));
  const validSaleIds = new Set(validSales.map((sale) => sale.id));
  const items = saleItems.filter((item) => validSaleIds.has(item.sale_id));

  const netRevenue = validSales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0);
  const salesDiscounts = validSales.reduce((sum, sale) => sum + Number(sale.discount ?? 0), 0);
  const grossRevenue = netRevenue + salesDiscounts;
  const cogs = items.reduce((sum, item) => sum + Number(item.cost_price ?? 0) * Number(item.quantity ?? 0), 0);
  const grossProfit = netRevenue - cogs;

  const expensesInPeriod = expenses.filter((expense) => isDateInRange(expense.date, startDate, endDate));
  const manualExpenses = expensesInPeriod.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  const accountsWithPaidAmount = financialAccounts
    .map((account) => ({
      account,
      paidAmountInPeriod: getFinancialAccountPaidAmountInRange(account, startDate, endDate),
    }))
    .filter(({ paidAmountInPeriod }) => paidAmountInPeriod > 0);
  const paidOperatingPayables = accountsWithPaidAmount
    .filter(({ account }) => account.account_type === 'payable' && !isPurchasePayable(account))
    .reduce((sum, { paidAmountInPeriod }) => sum + paidAmountInPeriod, 0);
  const otherRevenue = accountsWithPaidAmount
    .filter(({ account }) => account.account_type === 'receivable')
    .reduce((sum, { paidAmountInPeriod }) => sum + paidAmountInPeriod, 0);

  const operatingExpenses = manualExpenses + paidOperatingPayables;
  const operatingProfit = grossProfit - operatingExpenses;
  const netIncome = operatingProfit + otherRevenue;
  const denominator = netRevenue + otherRevenue;

  const breakdown = new Map<string, number>();
  expensesInPeriod.forEach((expense) => {
    const key = expense.cost_center || expense.category || 'Despesas';
    breakdown.set(key, (breakdown.get(key) ?? 0) + Number(expense.amount ?? 0));
  });
  accountsWithPaidAmount
    .filter(({ account }) => account.account_type === 'payable' && !isPurchasePayable(account))
    .forEach(({ account, paidAmountInPeriod }) => {
      const key = account.cost_center || 'Contas pagas';
      breakdown.set(key, (breakdown.get(key) ?? 0) + paidAmountInPeriod);
    });

  return {
    grossRevenue,
    salesDiscounts,
    netRevenue,
    cogs,
    grossProfit,
    manualExpenses,
    paidOperatingPayables,
    operatingExpenses,
    otherRevenue,
    operatingProfit,
    netIncome,
    grossMarginPct: netRevenue > 0 ? grossProfit / netRevenue * 100 : 0,
    netMarginPct: denominator > 0 ? netIncome / denominator * 100 : 0,
    expenseRatioPct: netRevenue > 0 ? operatingExpenses / netRevenue * 100 : 0,
    validSalesCount: validSales.length,
    expenseBreakdown: Array.from(breakdown.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount),
  };
};
