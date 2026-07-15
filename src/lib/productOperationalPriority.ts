export type ProductPriorityProduct = {
  id: string;
  name: string;
  stock?: number | null;
  min_stock?: number | null;
  control_stock?: boolean | null;
};

export type ProductPriorityBatch = {
  product_id?: string | null;
  expiration_date: string;
  alert_days?: number | null;
};

export type ProductPriorityState<TBatch extends ProductPriorityBatch = ProductPriorityBatch> = {
  batch: TBatch | null;
  daysRemaining: number | null;
  expired: boolean;
  expiring: boolean;
  hasBatch: boolean;
  lowStock: boolean;
  priority: number;
};

const dayTimestamp = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).getTime();

export const getBatchDaysRemaining = (batch: ProductPriorityBatch | null | undefined, todayKey: string) => {
  if (!batch?.expiration_date) return null;
  const expiration = dayTimestamp(batch.expiration_date);
  const current = dayTimestamp(todayKey);
  if (!Number.isFinite(expiration) || !Number.isFinite(current)) return null;
  return Math.ceil((expiration - current) / 86400000);
};

export const buildNextBatchByProductId = <TBatch extends ProductPriorityBatch>(batches: TBatch[]) => {
  const result = new Map<string, TBatch>();
  [...batches]
    .filter((batch) => Boolean(batch.product_id))
    .sort((left, right) => String(left.expiration_date).localeCompare(String(right.expiration_date)))
    .forEach((batch) => {
      const productId = batch.product_id as string;
      if (!result.has(productId)) result.set(productId, batch);
    });
  return result;
};

export const getProductPriorityState = <TBatch extends ProductPriorityBatch>(
  product: ProductPriorityProduct,
  batch: TBatch | null | undefined,
  todayKey: string,
): ProductPriorityState<TBatch> => {
  const daysRemaining = getBatchDaysRemaining(batch, todayKey);
  const hasBatch = Boolean(batch);
  const expired = daysRemaining !== null && daysRemaining < 0;
  const expiring = daysRemaining !== null && !expired && daysRemaining <= Number(batch?.alert_days ?? 30);
  const lowStock = product.control_stock !== false
    && Number(product.min_stock ?? 0) > 0
    && Number(product.stock ?? 0) <= Number(product.min_stock ?? 0);
  const priority = expired ? 0 : expiring ? 1 : lowStock ? 2 : hasBatch ? 3 : 4;

  return {
    batch: batch ?? null,
    daysRemaining,
    expired,
    expiring,
    hasBatch,
    lowStock,
    priority,
  };
};

export const compareProductsByOperationalPriority = <TProduct extends ProductPriorityProduct, TBatch extends ProductPriorityBatch>(
  left: TProduct,
  right: TProduct,
  batchByProductId: Map<string, TBatch>,
  todayKey: string,
) => {
  const leftState = getProductPriorityState(left, batchByProductId.get(left.id), todayKey);
  const rightState = getProductPriorityState(right, batchByProductId.get(right.id), todayKey);

  if (leftState.priority !== rightState.priority) return leftState.priority - rightState.priority;
  if (leftState.daysRemaining !== null && rightState.daysRemaining !== null && leftState.daysRemaining !== rightState.daysRemaining) {
    return leftState.daysRemaining - rightState.daysRemaining;
  }
  if (leftState.lowStock && rightState.lowStock) {
    const leftGap = Number(left.min_stock ?? 0) - Number(left.stock ?? 0);
    const rightGap = Number(right.min_stock ?? 0) - Number(right.stock ?? 0);
    if (leftGap !== rightGap) return rightGap - leftGap;
  }

  return left.name.localeCompare(right.name, 'pt-BR');
};
