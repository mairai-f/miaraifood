import { describe, expect, it } from 'vitest';
import { buildDreStatement, getFinancialAccountPaidAmountInRange, getPreviousPeriodRange, getVariationPct } from '@/lib/dre';
import type { Expense, Sale, SaleItem } from '@/types';
import type { FinancialAccount } from '@/types/operations';

const sale = (patch: Partial<Sale>): Sale => ({
  id: 'sale-1',
  user_id: 'owner-1',
  status: 'completed',
  total: 100,
  discount: 10,
  payment_method: 'pix',
  cash_received: 0,
  change_amount: 0,
  date: '2026-07-10T10:00:00.000Z',
  created_at: '2026-07-10T10:00:00.000Z',
  ...patch,
});

const item = (patch: Partial<SaleItem>): SaleItem => ({
  id: 'item-1',
  sale_id: 'sale-1',
  product_id: 'product-1',
  product_name: 'Produto',
  quantity: 2,
  unit_price: 50,
  cost_price: 30,
  total: 100,
  discount_amount: 0,
  net_total: 100,
  total_profit: 40,
  ...patch,
});

const expense = (patch: Partial<Expense>): Expense => ({
  id: 'expense-1',
  user_id: 'owner-1',
  description: 'Aluguel',
  amount: 20,
  category: 'Operacao',
  date: '2026-07-10T12:00:00.000Z',
  ...patch,
});

const account = (patch: Partial<FinancialAccount>): FinancialAccount => ({
  id: 'account-1',
  account_type: 'payable',
  description: 'Conta',
  party_name: 'Fornecedor',
  amount: 50,
  paid_amount: 50,
  due_date: '2026-07-10',
  paid_at: '2026-07-10T12:00:00.000Z',
  status: 'paid',
  source: 'manual',
  notes: '',
  ...patch,
});

describe('DRE helpers', () => {
  it('calculates net income without double-counting purchase payables as expenses', () => {
    const dre = buildDreStatement({
      sales: [sale({})],
      saleItems: [item({})],
      expenses: [expense({ amount: 20 })],
      financialAccounts: [
        account({ amount: 30, paid_amount: 30, source: 'manual', cost_center: 'Administrativo' }),
        account({ id: 'purchase-payable', amount: 80, paid_amount: 80, source: 'purchase' }),
        account({ id: 'other-revenue', account_type: 'receivable', amount: 15, paid_amount: 15, source: 'manual' }),
      ],
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(dre.netRevenue).toBe(100);
    expect(dre.cogs).toBe(60);
    expect(dre.operatingExpenses).toBe(50);
    expect(dre.otherRevenue).toBe(15);
    expect(dre.netIncome).toBe(5);
  });

  it('uses partial payment history inside the period', () => {
    const partialPayable = account({
      amount: 100,
      paid_amount: 60,
      status: 'pending',
      paid_at: null,
      payment_history: [
        { id: 'p1', paid_at: '2026-06-30T12:00:00.000Z', amount: 20 },
        { id: 'p2', paid_at: '2026-07-10T12:00:00.000Z', amount: 40 },
      ],
    });

    expect(getFinancialAccountPaidAmountInRange(partialPayable, '2026-07-01', '2026-07-31')).toBe(40);

    const dre = buildDreStatement({
      sales: [sale({})],
      saleItems: [item({})],
      expenses: [],
      financialAccounts: [partialPayable],
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(dre.operatingExpenses).toBe(40);
    expect(dre.netIncome).toBe(0);
  });

  it('ignores canceled sales in the DRE', () => {
    const dre = buildDreStatement({
      sales: [sale({ status: 'canceled', total: 100 })],
      saleItems: [item({})],
      expenses: [],
      financialAccounts: [],
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    });

    expect(dre.netRevenue).toBe(0);
    expect(dre.cogs).toBe(0);
  });

  it('builds the previous range with the same number of days', () => {
    expect(getPreviousPeriodRange('2026-07-10', '2026-07-12')).toEqual({
      startDate: '2026-07-07',
      endDate: '2026-07-09',
    });
  });

  it('calculates percentage variation from the previous period', () => {
    expect(getVariationPct(150, 100)).toBe(50);
    expect(getVariationPct(0, 0)).toBe(0);
  });
});
