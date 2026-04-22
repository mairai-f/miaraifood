export type PricingRoundingRule =
  | 'none'
  | '0.01'
  | '0.05'
  | '0.10'
  | '0.50'
  | '1.00'
  | 'whole_90'
  | 'whole_99';

export interface PricingProductLike {
  price?: number | null;
  cost_price?: number | null;
  purchase_cost?: number | null;
  freight_cost?: number | null;
  tax_cost?: number | null;
  commission_cost?: number | null;
  card_fee_cost?: number | null;
  packaging_cost?: number | null;
  operational_cost?: number | null;
  other_extra_cost?: number | null;
  supplier_name?: string | null;
  target_markup_pct?: number | null;
  minimum_markup_pct?: number | null;
  minimum_price?: number | null;
  rounding_rule?: string | null;
  pricing_notes?: string | null;
}

export interface PricingRuleLike {
  category?: string | null;
  default_markup_pct?: number | null;
  minimum_markup_pct?: number | null;
  minimum_price?: number | null;
  rounding_rule?: string | null;
  notes?: string | null;
}

export interface PricingLineLike {
  quantity: number;
  unit_price: number;
  cost_price?: number | null;
  total?: number | null;
}

const money = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const percent = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export const PRICING_ROUNDING_RULES: PricingRoundingRule[] = [
  'none',
  '0.01',
  '0.05',
  '0.10',
  '0.50',
  '1.00',
  'whole_90',
  'whole_99',
];

export const pricingRoundingLabels: Record<PricingRoundingRule, string> = {
  none: 'Sem arredondamento',
  '0.01': 'Centavos exatos',
  '0.05': 'Múltiplos de R$ 0,05',
  '0.10': 'Múltiplos de R$ 0,10',
  '0.50': 'Múltiplos de R$ 0,50',
  '1.00': 'Múltiplos de R$ 1,00',
  whole_90: 'Final .90',
  whole_99: 'Final .99',
};

export const normalizePricingRoundingRule = (value: string | null | undefined): PricingRoundingRule => {
  if (value && PRICING_ROUNDING_RULES.includes(value as PricingRoundingRule)) {
    return value as PricingRoundingRule;
  }

  return 'none';
};

export const getTotalExtraCosts = (product: Partial<PricingProductLike>) => money(
  nonNegative(product.freight_cost ?? 0)
  + nonNegative(product.tax_cost ?? 0)
  + nonNegative(product.commission_cost ?? 0)
  + nonNegative(product.card_fee_cost ?? 0)
  + nonNegative(product.packaging_cost ?? 0)
  + nonNegative(product.operational_cost ?? 0)
  + nonNegative(product.other_extra_cost ?? 0),
);

export const getPurchaseCost = (product: Partial<PricingProductLike>) => money(
  nonNegative(product.purchase_cost ?? product.cost_price ?? 0),
);

export const getRealCost = (product: Partial<PricingProductLike>) => money(
  getPurchaseCost(product) + getTotalExtraCosts(product),
);

export const getMarkupPercent = (price: number, cost: number) => {
  const normalizedCost = nonNegative(cost);
  if (normalizedCost <= 0) return 0;
  return percent(((nonNegative(price) - normalizedCost) / normalizedCost) * 100);
};

export const getMarginPercent = (price: number, cost: number) => {
  const normalizedPrice = nonNegative(price);
  if (normalizedPrice <= 0) return 0;
  return percent(((normalizedPrice - nonNegative(cost)) / normalizedPrice) * 100);
};

export const getUnitProfit = (price: number, cost: number) => money(nonNegative(price) - nonNegative(cost));

export const getPriceFromMarkup = (cost: number, markupPct: number) => money(nonNegative(cost) * (1 + (Number.isFinite(markupPct) ? markupPct : 0) / 100));

export const getMarkupFromPrice = (cost: number, price: number) => getMarkupPercent(price, cost);

export const applyPricingRounding = (value: number, roundingRule: string | null | undefined) => {
  const normalizedValue = nonNegative(value);
  const rule = normalizePricingRoundingRule(roundingRule);

  switch (rule) {
    case '0.01':
      return money(normalizedValue);
    case '0.05':
      return money(Math.ceil(normalizedValue / 0.05) * 0.05);
    case '0.10':
      return money(Math.ceil(normalizedValue / 0.1) * 0.1);
    case '0.50':
      return money(Math.ceil(normalizedValue / 0.5) * 0.5);
    case '1.00':
      return money(Math.ceil(normalizedValue));
    case 'whole_90': {
      const integerPart = Math.floor(normalizedValue);
      const candidate = integerPart + 0.9;
      return money(candidate >= normalizedValue ? candidate : integerPart + 1.9);
    }
    case 'whole_99': {
      const integerPart = Math.floor(normalizedValue);
      const candidate = integerPart + 0.99;
      return money(candidate >= normalizedValue ? candidate : integerPart + 1.99);
    }
    case 'none':
    default:
      return money(normalizedValue);
  }
};

export const getSuggestedPrice = (
  product: Partial<PricingProductLike>,
  rule?: Partial<PricingRuleLike> | null,
) => {
  const realCost = getRealCost(product);
  const productTargetMarkup = nonNegative(product.target_markup_pct ?? 0);
  const targetMarkup = productTargetMarkup > 0 ? productTargetMarkup : nonNegative(rule?.default_markup_pct ?? 0);
  const minimumMarkup = Math.max(nonNegative(product.minimum_markup_pct ?? 0), nonNegative(rule?.minimum_markup_pct ?? 0));
  const minimumPrice = Math.max(nonNegative(product.minimum_price ?? 0), nonNegative(rule?.minimum_price ?? 0));
  const roundingRule = normalizePricingRoundingRule(product.rounding_rule ?? rule?.rounding_rule);

  const priceByMarkup = getPriceFromMarkup(realCost, Math.max(targetMarkup, minimumMarkup));
  return applyPricingRounding(Math.max(priceByMarkup, minimumPrice), roundingRule);
};

export const applyPricingRuleToProduct = (
  product: Partial<PricingProductLike>,
  rule?: Partial<PricingRuleLike> | null,
) => {
  const nextProduct = {
    ...normalizeProductPricing(product),
    target_markup_pct: percent(nonNegative(product.target_markup_pct ?? 0) || nonNegative(rule?.default_markup_pct ?? 0)),
    minimum_markup_pct: percent(Math.max(nonNegative(product.minimum_markup_pct ?? 0), nonNegative(rule?.minimum_markup_pct ?? 0))),
    minimum_price: money(Math.max(nonNegative(product.minimum_price ?? 0), nonNegative(rule?.minimum_price ?? 0))),
    rounding_rule: normalizePricingRoundingRule(product.rounding_rule ?? rule?.rounding_rule),
  };

  return {
    ...nextProduct,
    price: getSuggestedPrice(nextProduct, rule),
  };
};

export const normalizeProductPricing = <T extends Partial<PricingProductLike>>(product: T) => {
  const normalized = {
    ...product,
    purchase_cost: getPurchaseCost(product),
    freight_cost: money(nonNegative(product.freight_cost ?? 0)),
    tax_cost: money(nonNegative(product.tax_cost ?? 0)),
    commission_cost: money(nonNegative(product.commission_cost ?? 0)),
    card_fee_cost: money(nonNegative(product.card_fee_cost ?? 0)),
    packaging_cost: money(nonNegative(product.packaging_cost ?? 0)),
    operational_cost: money(nonNegative(product.operational_cost ?? 0)),
    other_extra_cost: money(nonNegative(product.other_extra_cost ?? 0)),
    supplier_name: product.supplier_name?.trim() ?? '',
    target_markup_pct: percent(nonNegative(product.target_markup_pct ?? getMarkupPercent(product.price ?? 0, getRealCost(product)))),
    minimum_markup_pct: percent(nonNegative(product.minimum_markup_pct ?? 0)),
    minimum_price: money(nonNegative(product.minimum_price ?? 0)),
    rounding_rule: normalizePricingRoundingRule(product.rounding_rule),
    pricing_notes: product.pricing_notes?.trim() ?? '',
  };

  return {
    ...normalized,
    cost_price: getRealCost(normalized),
    price: money(nonNegative(product.price ?? 0)),
  };
};

export const allocateDiscountAcrossItems = (items: PricingLineLike[], totalDiscount: number) => {
  const safeDiscount = money(nonNegative(totalDiscount));
  if (items.length === 0 || safeDiscount <= 0) {
    return items.map(() => 0);
  }

  const grossTotal = items.reduce((sum, item) => sum + money(item.total ?? item.unit_price * item.quantity), 0);

  if (grossTotal <= 0) {
    return items.map(() => 0);
  }

  let allocated = 0;

  return items.map((item, index) => {
    if (index === items.length - 1) {
      return money(Math.max(0, safeDiscount - allocated));
    }

    const lineTotal = money(item.total ?? item.unit_price * item.quantity);
    const lineDiscount = money((lineTotal / grossTotal) * safeDiscount);
    allocated = money(allocated + lineDiscount);
    return lineDiscount;
  });
};

export const buildSaleItemPricingMetrics = <T extends PricingLineLike>(items: T[], totalDiscount: number) => {
  const discountByItem = allocateDiscountAcrossItems(items, totalDiscount);

  return items.map((item, index) => {
    const lineTotal = money(item.total ?? item.unit_price * item.quantity);
    const realCost = money(nonNegative(item.cost_price ?? 0));
    const netTotal = money(Math.max(0, lineTotal - discountByItem[index]));
    const totalProfit = money(netTotal - realCost * item.quantity);
    const unitProfit = item.quantity > 0 ? money(totalProfit / item.quantity) : 0;

    return {
      ...item,
      total: lineTotal,
      cost_price: realCost,
      discount_amount: discountByItem[index],
      net_total: netTotal,
      unit_profit: unitProfit,
      total_profit: totalProfit,
      markup_pct: getMarkupPercent(item.unit_price, realCost),
      margin_pct: getMarginPercent(item.unit_price, realCost),
    };
  });
};
