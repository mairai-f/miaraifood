import type { Product } from '@/types';

const PRODUCT_TEXT_LOCALE = 'pt-BR';

export const toProductUppercase = (value: string) => value.toLocaleUpperCase(PRODUCT_TEXT_LOCALE);

export const normalizeProductSearchText = (value: string | number | null | undefined) =>
  toProductUppercase(String(value ?? ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const getProductSearchTokens = (query: string) =>
  normalizeProductSearchText(query)
    .split(' ')
    .filter(Boolean);

const getProductSearchFields = (product: Product) => [
  product.code,
  product.name,
  product.category,
  product.supplier_name,
  product.barcode,
  product.reference,
].map(normalizeProductSearchText);

export const productMatchesSearch = (product: Product, query: string) => {
  const tokens = getProductSearchTokens(query);
  if (tokens.length === 0) return true;

  const fields = getProductSearchFields(product);
  return tokens.every(token => fields.some(field => field.includes(token)));
};

export const filterProductsBySearch = <T extends Product>(products: T[], query: string) =>
  products.filter(product => productMatchesSearch(product, query));

export const isExactProductSearchMatch = (product: Product, query: string) => {
  const term = normalizeProductSearchText(query);
  if (!term) return false;

  return [
    product.barcode,
    product.name,
  ].some(value => normalizeProductSearchText(value) === term);
};
