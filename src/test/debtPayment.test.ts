import { describe, expect, it } from 'vitest';

import {
  getDebtPaymentCreditedAmount,
  getDebtPaymentMaxAmount,
  getDebtPaymentValidationMessage,
} from '@/lib/debtPayment';

describe('debt payment rules', () => {
  it('bloqueia valor pago acima do saldo da divida', () => {
    expect(getDebtPaymentValidationMessage(100, 120, 0)).toBe(
      'O valor pago não pode ser maior que o saldo da dívida.',
    );
  });

  it('bloqueia quando pagamento e desconto ultrapassam o saldo', () => {
    expect(getDebtPaymentValidationMessage(100, 90, 20)).toBe(
      'O valor pago somado ao desconto não pode ultrapassar o saldo da dívida.',
    );
  });

  it('calcula o valor maximo restante quando ha desconto', () => {
    expect(getDebtPaymentMaxAmount(100, 15)).toBe(85);
    expect(getDebtPaymentCreditedAmount(100, 85, 15)).toBe(100);
  });
});
