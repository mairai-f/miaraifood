import { describe, expect, it } from 'vitest';

import {
  buildClientCrmSummary,
  buildLowStockPurchaseSuggestion,
  INACTIVE_CLIENT_DAYS,
  OLD_DEBT_DAYS,
} from '@/lib/managementInsights';
import type { Client, DebtEntry, Payment, Product } from '@/types';

const client: Client = {
  id: 'client-1',
  name: 'Maria',
  phone: '11999999999',
  created_at: '2026-01-01T10:00:00.000Z',
  deleted: false,
  user_id: 'owner-1',
};

const debtEntry: DebtEntry = {
  id: 'debt-1',
  client_id: client.id,
  product_id: 'product-1',
  product_name: 'Produto',
  quantity: 1,
  unit_price: 50,
  total: 50,
  date_added: '2026-05-01T10:00:00.000Z',
  status: 'pending',
  deleted: false,
};

const payment: Payment = {
  id: 'payment-1',
  client_id: client.id,
  amount: 20,
  date: '2026-05-02T10:00:00.000Z',
  type: 'partial',
};

const product: Product = {
  id: 'product-1',
  user_id: 'owner-1',
  name: 'ARROZ 5KG',
  price: 25,
  cost_price: 18,
  category: 'MERCEARIA',
  barcode: '789',
  stock: 1,
  min_stock: 3,
  supplier_name: 'DISTRIBUIDORA NORTE',
};

describe('management insights', () => {
  it('classifica cliente com fiado antigo e inatividade', () => {
    const summary = buildClientCrmSummary({
      client,
      debtEntries: [debtEntry],
      payments: [payment],
      balance: 50,
      totalSpending: 600,
      now: new Date('2026-06-18T12:00:00.000Z'),
    });

    expect(summary.hasOldDebt).toBe(true);
    expect(summary.isInactive).toBe(true);
    expect(summary.oldestDebtDays).toBeGreaterThanOrEqual(OLD_DEBT_DAYS);
    expect(summary.daysInactive).toBeGreaterThanOrEqual(INACTIVE_CLIENT_DAYS);
    expect(summary.tags).toEqual(expect.arrayContaining(['VIP', 'Devedor', 'Fiado antigo', 'Inativo']));
  });

  it('sugere compra quando estoque fica no minimo ou abaixo', () => {
    const suggestion = buildLowStockPurchaseSuggestion(product);

    expect(suggestion).toMatchObject({
      productId: product.id,
      supplierName: 'DISTRIBUIDORA NORTE',
      currentStock: 1,
      minStock: 3,
      suggestedQuantity: 5,
      severity: 'attention',
    });
  });
});
