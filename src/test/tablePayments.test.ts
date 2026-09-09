import { describe, expect, it } from 'vitest';
import { planTablePaymentConfirmation } from '@/lib/tablePayments';

describe('fechamento de pagamento da mesa', () => {
  it('confirma o que ja foi adicionado, sem exigir valor novo no campo', () => {
    // Era exatamente aqui que a tela travava: total lancado em Adicionar e
    // campo vazio ao confirmar.
    const plan = planTablePaymentConfirmation(18, [18], Number.NaN);

    expect(plan).toEqual({ status: 'ready', amounts: [18], confirmedTotal: 18 });
  });

  it('aceita o valor ainda digitado como ultima parte', () => {
    const plan = planTablePaymentConfirmation(18, [], 18);

    expect(plan).toEqual({ status: 'ready', amounts: [18], confirmedTotal: 18 });
  });

  it('soma pagamentos parciais de metodos diferentes', () => {
    const plan = planTablePaymentConfirmation(18, [10], 8);

    expect(plan).toEqual({ status: 'ready', amounts: [10, 8], confirmedTotal: 18 });
  });

  it('avisa quanto falta quando a conta nao esta coberta', () => {
    expect(planTablePaymentConfirmation(18, [10], Number.NaN)).toEqual({
      status: 'short',
      missing: 8,
    });
  });

  it('recusa valor acima do saldo restante', () => {
    expect(planTablePaymentConfirmation(18, [10], 15)).toEqual({ status: 'over', remaining: 8 });
  });

  it('nao confirma conta sem nenhum pagamento', () => {
    expect(planTablePaymentConfirmation(18, [], Number.NaN)).toEqual({ status: 'empty' });
  });

  it('tolera centavo de arredondamento', () => {
    const plan = planTablePaymentConfirmation(18, [5.99, 12], Number.NaN);

    expect(plan.status).toBe('ready');
  });
});
