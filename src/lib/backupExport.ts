import type { Client, DebtEntry, Expense, Payment, Product, ProductCategoryPricingRule, ProductPriceHistoryEntry, Reward, Sale, SaleItem, StockMovement } from '@/types';

export interface BackupPayload {
  exportedAt: string;
  version: 1;
  source: 'happycash';
  data: {
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
  };
}

export const downloadTextFile = (filename: string, content: string, type = 'application/json;charset=utf-8') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildBackupPayload = (data: BackupPayload['data']): BackupPayload => ({
  exportedAt: new Date().toISOString(),
  version: 1,
  source: 'happycash',
  data,
});

export const downloadJsonBackup = (payload: BackupPayload) => {
  const stamp = payload.exportedAt.slice(0, 19).replace(/[:T]/g, '-');
  downloadTextFile(`happycash-backup-${stamp}.json`, JSON.stringify(payload, null, 2));
};
