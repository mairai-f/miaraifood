export type StockMovementType = 'entrada' | 'saida' | 'ajuste';

export const STOCK_MOVEMENT_REASONS: Record<StockMovementType, string[]> = {
  entrada: ['Compra', 'Devolucao de cliente', 'Transferencia recebida', 'Correcao de entrada'],
  saida: ['Perda', 'Vencimento', 'Consumo interno', 'Devolucao ao fornecedor', 'Transferencia enviada'],
  ajuste: ['Contagem de inventario', 'Correcao de saldo'],
};

export interface StockMovementCalculation {
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  movementQuantity: number;
}

const normalizeStock = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export const calculateStockMovement = (
  currentStock: number,
  type: StockMovementType,
  quantityOrTarget: number,
): StockMovementCalculation => {
  const balanceBefore = normalizeStock(currentStock);
  const quantity = Number(quantityOrTarget);

  if (!Number.isFinite(quantity) || quantity < 0 || (type !== 'ajuste' && quantity === 0)) {
    throw new Error('Informe uma quantidade valida.');
  }

  const balanceAfter = type === 'entrada'
    ? balanceBefore + quantity
    : type === 'saida'
      ? balanceBefore - quantity
      : quantity;

  if (balanceAfter < 0) {
    throw new Error(`Estoque insuficiente. Saldo atual: ${balanceBefore}.`);
  }

  const delta = balanceAfter - balanceBefore;
  if (delta === 0) {
    throw new Error('O novo saldo deve ser diferente do estoque atual.');
  }

  return {
    balanceBefore,
    balanceAfter,
    delta,
    movementQuantity: Math.abs(delta),
  };
};

export const getStockMovementDirection = (movement: {
  type: string;
  balance_before?: number | null;
  balance_after?: number | null;
}) => {
  if (movement.balance_before != null && movement.balance_after != null) {
    return Number(movement.balance_after) >= Number(movement.balance_before) ? 'entrada' : 'saida';
  }
  return movement.type === 'entrada' ? 'entrada' : 'saida';
};
