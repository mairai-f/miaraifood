export type CommissionType = 'none' | 'percent' | 'amount';

export interface CatalogOption {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface ProductSubgroupOption extends CatalogOption {
  product_group_id: string;
}

export interface MeasurementUnitOption extends CatalogOption {
  symbol: string;
  decimal_places: number;
}

export interface ProductPriceTableOption extends CatalogOption {
  description: string;
  is_default: boolean;
}

export interface ProductPriceTableItem {
  id?: string;
  price_table_id: string;
  product_id: string;
  min_quantity: number;
  price: number;
  max_discount_pct: number;
  active: boolean;
}

export interface TransportCompanyOption extends CatalogOption {
  document: string;
  contact_name: string;
  phone: string;
  email: string;
}

/** Gera codigos curtos e previsiveis para filtros, importacao e integracoes. */
export const normalizeCatalogCode = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleUpperCase('pt-BR')
  .replace(/[^A-Z0-9_-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^[-_]+|[-_]+$/g, '')
  .slice(0, 32);

export const isValidCatalogCode = (value: string) => /^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(value);

export const clampPercentage = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

export const getCommissionValidationError = (type: CommissionType, value: number) => {
  if (!Number.isFinite(value) || value < 0) return 'A comissao nao pode ser negativa.';
  if (type === 'percent' && value > 100) return 'A comissao percentual nao pode passar de 100%.';
  if (type === 'none' && value !== 0) return 'Produto sem comissao deve ter valor zero.';
  return null;
};

export const calculateCommission = (type: CommissionType, value: number, salePrice: number) => {
  if (type === 'percent') return Math.max(0, salePrice) * clampPercentage(value) / 100;
  if (type === 'amount') return Math.max(0, value);
  return 0;
};

export const filterSubgroupsByGroup = (
  subgroups: ProductSubgroupOption[],
  groupId: string,
) => subgroups.filter((subgroup) => subgroup.active && subgroup.product_group_id === groupId);
