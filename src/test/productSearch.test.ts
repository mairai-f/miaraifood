import { describe, expect, it } from 'vitest';
import type { Product } from '@/types';
import {
  filterProductsBySearch,
  isExactProductSearchMatch,
  productMatchesSearch,
  toProductUppercase,
} from '@/lib/productSearch';

const makeProduct = (overrides: Partial<Product>): Product => ({
  id: 'product-1',
  user_id: 'user-1',
  name: 'CIGARRO MARLBORO MELANCIA',
  price: 10,
  cost_price: 7,
  category: 'TABACARIA',
  barcode: '789123',
  stock: 5,
  min_stock: 1,
  deleted: false,
  ...overrides,
});

describe('product search helpers', () => {
  it('uppercases product text using Brazilian Portuguese casing', () => {
    expect(toProductUppercase('cigarro marlboro melancia')).toBe('CIGARRO MARLBORO MELANCIA');
  });

  it('finds products by any word inside the product name', () => {
    const product = makeProduct({});

    expect(productMatchesSearch(product, 'marlboro')).toBe(true);
    expect(productMatchesSearch(product, 'mel')).toBe(true);
    expect(productMatchesSearch(product, 'cig mar')).toBe(true);
  });

  it('matches text without requiring accents or exact casing', () => {
    const product = makeProduct({ name: 'CAFÉ PILÃO 500G' });

    expect(productMatchesSearch(product, 'cafe pil')).toBe(true);
  });

  it('searches across name, category, supplier and barcode', () => {
    const product = makeProduct({
      name: 'REFRIGERANTE 2L',
      category: 'BEBIDAS',
      supplier_name: 'DISTRIBUIDORA NORTE',
      barcode: '789555',
    });

    expect(productMatchesSearch(product, 'bebidas')).toBe(true);
    expect(productMatchesSearch(product, 'norte')).toBe(true);
    expect(productMatchesSearch(product, '955')).toBe(true);
    expect(productMatchesSearch(product, '42')).toBe(false);
  });

  it('filters products with the shared matcher', () => {
    const products = [
      makeProduct({ id: '1', name: 'CIGARRO MARLBORO MELANCIA' }),
      makeProduct({ id: '2', name: 'ARROZ TIPO 1' }),
    ];

    expect(filterProductsBySearch(products, 'marlboro').map(product => product.id)).toEqual(['1']);
  });

  it('detects exact barcode or product name matches', () => {
    const product = makeProduct({ code: 7, barcode: 'ABC123' });

    expect(isExactProductSearchMatch(product, '7')).toBe(false);
    expect(isExactProductSearchMatch(product, 'abc123')).toBe(true);
    expect(isExactProductSearchMatch(product, 'cigarro marlboro melancia')).toBe(true);
  });
});
