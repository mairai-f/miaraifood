import { describe, expect, it } from 'vitest';
import type { Product, ProductPackaging } from '@/types';
import { calculatePackagingPrice, filterProductsWithPackagings, findExactPackagingMatch } from '@/lib/productPackaging';

const product = { id: 'bud', name: 'BUDWEISER LONG NECK', price: 9, category: 'BEBIDAS', barcode: 'UNIT', stock: 30, min_stock: 0, cost_price: 7, user_id: 'owner' } as Product;
const packaging = {
  id: 'pack-6', product_id: 'bud', name: 'FARDO COM 6', base_quantity: 6,
  barcode: 'PACK6', purchase_cost: 45, sale_price: 50, auto_apply: true,
  closed_only: false, active: true, store_account_id: 'store', owner_user_id: 'owner',
  created_at: '', updated_at: '',
} as ProductPackaging;

describe('product packaging pricing', () => {
  it('charges complete packages and loose remainder', () => {
    expect(calculatePackagingPrice(product, 6, [packaging]).total).toBe(50);
    expect(calculatePackagingPrice(product, 6, [packaging]).totalCost).toBe(45);
    expect(calculatePackagingPrice(product, 7, [packaging]).total).toBe(59);
    expect(calculatePackagingPrice(product, 7, [packaging]).totalCost).toBe(52);
    expect(calculatePackagingPrice(product, 12, [packaging]).total).toBe(100);
  });

  it('keeps loose pricing below a complete package', () => {
    expect(calculatePackagingPrice(product, 5, [packaging]).total).toBe(45);
  });

  it('does not auto apply packaging when disabled unless explicitly selected', () => {
    const manual = { ...packaging, auto_apply: false };
    expect(calculatePackagingPrice(product, 6, [manual]).total).toBe(54);
    expect(calculatePackagingPrice(product, 6, [manual], manual.id).total).toBe(50);
  });

  it('finds products and exact packaging by package barcode or name', () => {
    expect(filterProductsWithPackagings([product], [packaging], 'fardo 6')).toHaveLength(1);
    expect(findExactPackagingMatch([packaging], 'pack6')?.id).toBe('pack-6');
  });
});
