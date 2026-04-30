import { describe, expect, it } from 'vitest';
import {
  allocateDiscountAcrossItems,
  applyPricingRounding,
  buildSaleItemPricingMetrics,
  getRealCost,
  getSuggestedPrice,
} from '@/lib/pricing';

describe('pricing helpers', () => {
  it('sums purchase and extra costs into the real product cost', () => {
    expect(getRealCost({
      purchase_cost: 10,
      freight_cost: 1.25,
      tax_cost: 0.75,
      packaging_cost: 0.5,
      operational_cost: 0.25,
    })).toBe(12.75);
  });

  it('rounds suggested prices upward according to the selected rule', () => {
    expect(applyPricingRounding(12.31, '0.50')).toBe(12.5);
    expect(applyPricingRounding(12.91, 'whole_99')).toBe(12.99);
    expect(applyPricingRounding(12.991, 'whole_99')).toBe(13.99);
  });

  it('honors minimum markup, minimum price, and rounding when suggesting a price', () => {
    expect(getSuggestedPrice(
      { purchase_cost: 10, target_markup_pct: 20, minimum_markup_pct: 50, minimum_price: 18, rounding_rule: '0.10' },
      { default_markup_pct: 30, minimum_price: 16 },
    )).toBe(18);
  });

  it('allocates discount across sale items without losing cents', () => {
    expect(allocateDiscountAcrossItems([
      { quantity: 1, unit_price: 10 },
      { quantity: 1, unit_price: 20 },
      { quantity: 1, unit_price: 30 },
    ], 10)).toEqual([1.67, 3.33, 5]);
  });

  it('builds sale item profit metrics from net total after discount', () => {
    expect(buildSaleItemPricingMetrics([
      { quantity: 2, unit_price: 10, cost_price: 6 },
      { quantity: 1, unit_price: 20, cost_price: 9 },
    ], 4)).toEqual([
      expect.objectContaining({
        total: 20,
        discount_amount: 2,
        net_total: 18,
        total_profit: 6,
        unit_profit: 3,
      }),
      expect.objectContaining({
        total: 20,
        discount_amount: 2,
        net_total: 18,
        total_profit: 9,
        unit_profit: 9,
      }),
    ]);
  });
});
