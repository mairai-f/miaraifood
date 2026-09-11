// Regras da tela de TV (promoções e produtos escolhidos), sem React, para
// ficarem testáveis. O conteúdo vem pronto da função tv-display.

export const TV_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const TV_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/** Aceita o código digitado com minúsculas, espaços ou hífen. */
export const normalizeTvCode = (value: string) => value.toUpperCase().replace(/[^0-9A-Z]/g, '');

export type TvDiscountType = 'amount' | 'percent' | 'fixed_price';

export interface TvPromotion {
  id: string;
  product_id: string | null;
  title: string;
  product_name: string;
  price: number | null;
  discount_type: TvDiscountType;
  discount_value: number;
  ends_at: string | null;
  image_url: string | null;
  description: string | null;
}

export interface TvProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
}

export interface TvPayload {
  version: string;
  store_name: string | null;
  screen: {
    name: string;
    headline: string;
    footer_message: string;
    slide_seconds: number;
    show_prices: boolean;
  };
  promotions: TvPromotion[];
  products: TvProduct[];
}

export interface TvSlide {
  key: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  originalPrice: number | null;
  price: number | null;
  badge: string | null;
  endsAt: string | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const numberOrNull = (value: unknown) =>
  value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export function promotionPrice(price: number | null, type: TvDiscountType, value: number): number | null {
  if (type === 'fixed_price') return round2(value);
  if (price === null) return null;
  if (type === 'percent') return round2(Math.max(price * (1 - value / 100), 0));
  return round2(Math.max(price - value, 0));
}

export function promotionBadge(type: TvDiscountType, value: number, formatMoney: (value: number) => string): string {
  if (type === 'percent') return `-${value}%`;
  if (type === 'amount') return `-${formatMoney(value)}`;
  return 'Oferta';
}

/** Código novo para a TV. Descarta bytes >= 248 para não enviesar o módulo 31. */
export function generateTvCode(randomBytes: (array: Uint8Array) => Uint8Array = (array) => crypto.getRandomValues(array)): string {
  let code = '';
  while (code.length < 8) {
    for (const byte of randomBytes(new Uint8Array(16))) {
      if (byte < 248 && code.length < 8) code += TV_CODE_ALPHABET[byte % TV_CODE_ALPHABET.length];
    }
  }
  return code;
}

/** Promoções primeiro; depois os produtos escolhidos para a TV, sem repetir produto em promoção. */
export function buildTvSlides(payload: TvPayload, formatMoney: (value: number) => string): TvSlide[] {
  const promotedProductIds = new Set<string>();
  const slides: TvSlide[] = [];

  for (const promotion of payload.promotions ?? []) {
    const price = numberOrNull(promotion.price);
    const value = Number(promotion.discount_value) || 0;
    if (promotion.product_id) promotedProductIds.add(promotion.product_id);
    const title = promotion.title || promotion.product_name;
    slides.push({
      key: `promotion-${promotion.id}`,
      title,
      subtitle: promotion.description || (title !== promotion.product_name ? promotion.product_name : null),
      imageUrl: promotion.image_url || null,
      originalPrice: price,
      price: promotionPrice(price, promotion.discount_type, value),
      badge: promotionBadge(promotion.discount_type, value, formatMoney),
      endsAt: promotion.ends_at,
    });
  }

  for (const product of payload.products ?? []) {
    if (promotedProductIds.has(product.id)) continue;
    slides.push({
      key: `product-${product.id}`,
      title: product.name,
      subtitle: product.description || null,
      imageUrl: product.image_url || null,
      originalPrice: null,
      price: numberOrNull(product.price),
      badge: null,
      endsAt: null,
    });
  }

  return slides;
}
