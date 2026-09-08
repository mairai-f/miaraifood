import { describe, expect, it } from 'vitest';
import {
  addMonthsToIsoDate,
  buildRecurringFinancialAccountDrafts,
  getFinancialAccountRemainingAmount,
  getReceiptDivergenceQuantity,
} from '@/lib/erpFinance';

describe('ERP finance helpers', () => {
  it('keeps monthly recurrence on a valid calendar day', () => {
    expect(addMonthsToIsoDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToIsoDate('2026-01-31', 2)).toBe('2026-03-31');
  });

  it('builds recurring payable installments with independent due dates', () => {
    let next = 0;
    const rows = buildRecurringFinancialAccountDrafts({
      account_type: 'payable',
      description: 'Aluguel',
      party_name: 'Imobiliaria',
      amount: 1000,
      due_date: '2026-07-10',
      payment_method: 'Boleto',
      cost_center: 'Operacao',
      attachment_url: '',
      recurrence_type: 'installment',
      notes: '',
    }, 3, () => `id-${++next}`);

    expect(rows.map(row => row.due_date)).toEqual(['2026-07-10', '2026-08-10', '2026-09-10']);
    expect(rows.map(row => row.installment_number)).toEqual([1, 2, 3]);
    expect(new Set(rows.map(row => row.recurrence_parent_id))).toEqual(new Set(['id-1']));
  });

  it('calculates the open balance after a partial payment', () => {
    expect(getFinancialAccountRemainingAmount({
      amount: 100,
      paid_amount: 40,
      status: 'pending',
    })).toBe(60);
  });

  it('detects purchase receipt divergence against remaining quantity', () => {
    expect(getReceiptDivergenceQuantity([
      { id: 'item-1', quantity: 10, received_quantity: 2 },
      { id: 'item-2', quantity: 5, received_quantity: 0 },
    ], [
      { item_id: 'item-1', quantity: 6 },
      { item_id: 'item-2', quantity: 5 },
    ])).toBe(2);
  });
});
