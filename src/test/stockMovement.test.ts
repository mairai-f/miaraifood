import { describe, expect, it } from 'vitest';
import { calculateStockMovement, getStockMovementDirection } from '@/lib/stockMovement';

describe('stock movement rules', () => {
  it('calculates entries and exits from the current balance', () => {
    expect(calculateStockMovement(10, 'entrada', 3)).toEqual({
      balanceBefore: 10,
      balanceAfter: 13,
      delta: 3,
      movementQuantity: 3,
    });
    expect(calculateStockMovement(10, 'saida', 4).balanceAfter).toBe(6);
  });

  it('treats an inventory adjustment as the new counted balance', () => {
    expect(calculateStockMovement(10, 'ajuste', 7)).toEqual({
      balanceBefore: 10,
      balanceAfter: 7,
      delta: -3,
      movementQuantity: 3,
    });
  });

  it('blocks negative balances and no-op adjustments', () => {
    expect(() => calculateStockMovement(2, 'saida', 3)).toThrow('Estoque insuficiente');
    expect(() => calculateStockMovement(2, 'ajuste', 2)).toThrow('diferente');
  });

  it('uses recorded balances to render adjustment direction', () => {
    expect(getStockMovementDirection({ type: 'ajuste', balance_before: 5, balance_after: 8 })).toBe('entrada');
    expect(getStockMovementDirection({ type: 'ajuste', balance_before: 5, balance_after: 2 })).toBe('saida');
  });
});
