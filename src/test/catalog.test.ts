import { describe, expect, it } from 'vitest';
import {
  calculateCommission,
  filterSubgroupsByGroup,
  getCommissionValidationError,
  isValidCatalogCode,
  normalizeCatalogCode,
} from '@/lib/catalog';

describe('catalog helpers', () => {
  it('normaliza codigo sem acentos e caracteres inseguros', () => {
    expect(normalizeCatalogCode('  Bebidas quentes / verão  ')).toBe('BEBIDAS-QUENTES-VERAO');
    expect(isValidCatalogCode('BEBIDAS-01')).toBe(true);
    expect(isValidCatalogCode('-INVALIDO')).toBe(false);
  });

  it('valida e calcula comissao', () => {
    expect(getCommissionValidationError('percent', 101)).toContain('100%');
    expect(getCommissionValidationError('none', 1)).toContain('zero');
    expect(getCommissionValidationError('amount', 3)).toBeNull();
    expect(calculateCommission('percent', 10, 50)).toBe(5);
    expect(calculateCommission('amount', 3.5, 50)).toBe(3.5);
    expect(calculateCommission('none', 99, 50)).toBe(0);
  });

  it('filtra subgrupos ativos do grupo selecionado', () => {
    const rows = [
      { id: '1', code: 'A', name: 'A', active: true, product_group_id: 'g1' },
      { id: '2', code: 'B', name: 'B', active: false, product_group_id: 'g1' },
      { id: '3', code: 'C', name: 'C', active: true, product_group_id: 'g2' },
    ];
    expect(filterSubgroupsByGroup(rows, 'g1').map((row) => row.id)).toEqual(['1']);
  });
});
