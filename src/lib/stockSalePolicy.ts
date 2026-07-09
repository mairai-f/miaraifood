import type { Product } from '@/types';

type ProductStockPolicyInput = Pick<Product, 'control_stock' | 'block_sale_without_stock'>;

export const tracksProductStock = (product: ProductStockPolicyInput | null | undefined) =>
  product?.control_stock !== false;

export const blocksSaleWithoutStock = (
  product: ProductStockPolicyInput | null | undefined,
  storeBlocksSaleWithoutStock: boolean,
) => storeBlocksSaleWithoutStock && tracksProductStock(product) && product?.block_sale_without_stock !== false;

export const allowsSaleWithoutStock = (
  product: ProductStockPolicyInput | null | undefined,
  storeBlocksSaleWithoutStock: boolean,
) => !blocksSaleWithoutStock(product, storeBlocksSaleWithoutStock);

export const clampTrackedStock = (
  product: ProductStockPolicyInput | null | undefined,
  nextStock: number,
  storeBlocksSaleWithoutStock: boolean,
) => (blocksSaleWithoutStock(product, storeBlocksSaleWithoutStock) ? Math.max(0, nextStock) : nextStock);
