import type { Product, ProductPackaging } from '@/types';
import { getProductSearchTokens, normalizeProductSearchText, productMatchesSearch } from '@/lib/productSearch';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface PackagingPriceResult {
  total: number;
  effectiveUnitPrice: number;
  totalCost: number;
  effectiveUnitCost: number;
  packaging: ProductPackaging | null;
  packageCount: number;
  remainderQuantity: number;
}

/** Permite localizar uma embalagem pelo nome comercial ou codigo do fabricante. */
export const packagingMatchesSearch = (packaging: ProductPackaging, query: string) => {
  const tokens = getProductSearchTokens(query);
  if (tokens.length === 0 || !packaging.active) return false;
  const fields = [packaging.name, packaging.barcode].map(normalizeProductSearchText);
  return tokens.every((token) => fields.some((field) => field.includes(token)));
};

/** Resolve leitura de scanner sem confundir uma correspondencia parcial de texto. */
export const findExactPackagingMatch = (packagings: ProductPackaging[], query: string) => {
  const term = normalizeProductSearchText(query);
  if (!term) return null;
  return packagings.find((packaging) => packaging.active && [packaging.barcode, packaging.name]
    .some((value) => normalizeProductSearchText(value) === term)) ?? null;
};

/** Reutiliza a mesma busca no PDV e no fiado, incluindo os apelidos das embalagens. */
export const filterProductsWithPackagings = <T extends Product>(
  products: T[],
  packagings: ProductPackaging[],
  query: string,
) => {
  const productIdsFromPackaging = new Set(packagings
    .filter((packaging) => packagingMatchesSearch(packaging, query))
    .map((packaging) => packaging.product_id));
  return products.filter((product) => productMatchesSearch(product, query) || productIdsFromPackaging.has(product.id));
};

/**
 * Calcula o valor comercial sem converter o estoque em dois produtos.
 * Blocos completos usam preco/custo da embalagem e a sobra continua avulsa.
 */
export const calculatePackagingPrice = (
  product: Pick<Product, 'id' | 'price' | 'cost_price'>,
  quantity: number,
  packagings: ProductPackaging[],
  explicitPackagingId?: string | null,
): PackagingPriceResult => {
  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const basePrice = Math.max(0, Number(product.price) || 0);
  const baseCost = Math.max(0, Number(product.cost_price) || 0);
  const eligible = packagings.filter((packaging) => (
    packaging.active
    && packaging.product_id === product.id
    && packaging.base_quantity > 1
    && safeQuantity >= packaging.base_quantity
    && (packaging.id === explicitPackagingId || packaging.auto_apply)
  ));

  const candidates = eligible.map((packaging) => {
    const packageCount = Math.floor(safeQuantity / packaging.base_quantity);
    const remainderQuantity = safeQuantity - packageCount * packaging.base_quantity;
    const total = money(packageCount * packaging.sale_price + remainderQuantity * basePrice);
    const packageCost = packaging.purchase_cost > 0
      ? packaging.purchase_cost
      : baseCost * packaging.base_quantity;
    const totalCost = money(packageCount * packageCost + remainderQuantity * baseCost);
    return { packaging, packageCount, remainderQuantity, total, totalCost };
  });

  const explicit = explicitPackagingId
    ? candidates.find((candidate) => candidate.packaging.id === explicitPackagingId)
    : null;
  const best = explicit ?? candidates.sort((left, right) => (
    left.total - right.total || right.packaging.base_quantity - left.packaging.base_quantity
  ))[0] ?? null;
  const total = best?.total ?? money(safeQuantity * basePrice);
  const totalCost = best?.totalCost ?? money(safeQuantity * baseCost);

  return {
    total,
    effectiveUnitPrice: safeQuantity > 0 ? total / safeQuantity : basePrice,
    totalCost,
    effectiveUnitCost: safeQuantity > 0 ? totalCost / safeQuantity : baseCost,
    packaging: best?.packaging ?? null,
    packageCount: best?.packageCount ?? 0,
    remainderQuantity: best?.remainderQuantity ?? safeQuantity,
  };
};
