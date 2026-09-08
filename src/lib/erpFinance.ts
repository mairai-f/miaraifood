import type { FinancialAccount, PurchaseOrderItem } from '@/types/operations';

export type FinancialAccountDraft = {
  id: string;
  account_type: 'payable' | 'receivable';
  description: string;
  party_name: string;
  amount: number;
  due_date: string;
  notes: string;
  payment_method: string;
  cost_center: string;
  attachment_url: string;
  recurrence_type: 'none' | 'monthly' | 'weekly' | 'yearly' | 'installment';
  recurrence_parent_id: string | null;
  installment_number: number;
  installment_total: number;
};

const addDaysToIsoDate = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const addMonthsToIsoDate = (isoDate: string, months: number) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
};

export const getFinancialAccountPaidAmount = (account: Pick<FinancialAccount, 'amount' | 'paid_amount' | 'status'>) =>
  Math.min(Number(account.amount ?? 0), Math.max(0, Number(account.paid_amount ?? (account.status === 'paid' ? account.amount : 0))));

export const getFinancialAccountRemainingAmount = (account: Pick<FinancialAccount, 'amount' | 'paid_amount' | 'status'>) =>
  account.status === 'canceled' ? 0 : Math.max(0, Number(account.amount ?? 0) - getFinancialAccountPaidAmount(account));

export const buildRecurringFinancialAccountDrafts = (
  base: Omit<FinancialAccountDraft, 'id' | 'recurrence_parent_id' | 'installment_number' | 'installment_total'>,
  count: number,
  createId: () => string,
) => {
  const total = Math.max(1, Math.min(60, Math.trunc(count) || 1));
  const parentId = createId();
  const type = total > 1 ? base.recurrence_type : 'none';

  return Array.from({ length: total }, (_, index): FinancialAccountDraft => {
    const dueDate = type === 'weekly'
      ? addDaysToIsoDate(base.due_date, index * 7)
      : type === 'yearly'
        ? addMonthsToIsoDate(base.due_date, index * 12)
        : type === 'monthly' || type === 'installment'
          ? addMonthsToIsoDate(base.due_date, index)
          : base.due_date;
    return {
      ...base,
      id: index === 0 ? parentId : createId(),
      due_date: dueDate,
      recurrence_type: type,
      recurrence_parent_id: total > 1 ? parentId : null,
      installment_number: index + 1,
      installment_total: total,
    };
  });
};

export const getReceiptDivergenceQuantity = (
  items: Pick<PurchaseOrderItem, 'id' | 'quantity' | 'received_quantity'>[],
  receipts: Array<{ item_id: string; quantity: number }>,
) => receipts.reduce((sum, receipt) => {
  const item = items.find((candidate) => candidate.id === receipt.item_id);
  if (!item) return sum;
  const remaining = Math.max(0, Number(item.quantity ?? 0) - Number(item.received_quantity ?? 0));
  return sum + Math.max(0, remaining - Number(receipt.quantity ?? 0));
}, 0);
