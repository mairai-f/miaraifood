import { describe, expect, it } from 'vitest';

import {
  buildTvSlides,
  generateTvCode,
  normalizeTvCode,
  promotionPrice,
  TV_CODE_PATTERN,
  type TvPayload,
} from '../features/tv/tvSlides';

const money = (value: number) => `R$ ${value.toFixed(2)}`;

const payload = (overrides: Partial<TvPayload> = {}): TvPayload => ({
  version: 'v1',
  store_name: 'Loja',
  screen: { name: 'TV', headline: '', footer_message: '', slide_seconds: 10, show_prices: true },
  promotions: [],
  products: [],
  ...overrides,
});

describe('tela de TV', () => {
  it('calcula o preço promocional de cada tipo sem ficar negativo', () => {
    expect(promotionPrice(30, 'percent', 20)).toBe(24);
    expect(promotionPrice(12, 'amount', 5)).toBe(7);
    expect(promotionPrice(4, 'amount', 5)).toBe(0);
    expect(promotionPrice(null, 'fixed_price', 9.9)).toBe(9.9);
    expect(promotionPrice(null, 'percent', 10)).toBeNull();
  });

  it('mostra promoções antes dos produtos escolhidos e não repete produto promovido', () => {
    const slides = buildTvSlides(payload({
      promotions: [{
        id: 'p1', product_id: 'burger', title: 'Terça do Burguer', product_name: 'X-Burguer',
        price: 30, discount_type: 'percent', discount_value: 10, ends_at: '2026-09-30', image_url: null, description: null,
      }],
      products: [
        { id: 'burger', name: 'X-Burguer', price: 30, image_url: null, description: null },
        { id: 'suco', name: 'Suco', price: 8, image_url: 'https://img/suco.webp', description: 'Natural' },
      ],
    }), money);

    expect(slides.map((slide) => slide.key)).toEqual(['promotion-p1', 'product-suco']);
    expect(slides[0]).toMatchObject({ title: 'Terça do Burguer', subtitle: 'X-Burguer', price: 27, originalPrice: 30, badge: '-10%' });
    expect(slides[1]).toMatchObject({ badge: null, price: 8, imageUrl: 'https://img/suco.webp' });
  });

  it('aceita o código digitado de qualquer jeito no controle da TV', () => {
    expect(normalizeTvCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(TV_CODE_PATTERN.test('ABCD2345')).toBe(true);
    expect(TV_CODE_PATTERN.test('ABCD0O1I')).toBe(false);
  });

  it('gera códigos válidos descartando bytes que enviesariam o sorteio', () => {
    const bytes = [255, 250, 0, 1, 2, 3, 4, 5, 6, 7, 30, 31];
    const code = generateTvCode((array) => {
      array.set(bytes.slice(0, array.length));
      return array;
    });
    expect(code).toBe('23456789');
    expect(TV_CODE_PATTERN.test(generateTvCode())).toBe(true);
  });
});
