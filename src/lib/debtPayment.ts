const PAYMENT_TOLERANCE = 0.009;

const roundCurrency = (value: number) => Number(value.toFixed(2));

export const getDebtPaymentCreditedAmount = (balance: number, amount: number, discountAmount: number) =>
  roundCurrency(Math.min(balance, amount + discountAmount));

export const getDebtPaymentMaxAmount = (balance: number, discountAmount: number) =>
  roundCurrency(Math.max(0, balance - discountAmount));

export const getDebtPaymentValidationMessage = (balance: number, amount: number, discountAmount: number) => {
  const normalizedAmount = roundCurrency(amount);
  const normalizedDiscountAmount = roundCurrency(Math.max(0, discountAmount));
  const creditedAmount = getDebtPaymentCreditedAmount(balance, normalizedAmount, normalizedDiscountAmount);
  const maxAmount = getDebtPaymentMaxAmount(balance, normalizedDiscountAmount);

  if (normalizedAmount < 0 || creditedAmount <= 0) return 'Valor inválido';
  if (normalizedAmount > balance + PAYMENT_TOLERANCE) return 'O valor pago não pode ser maior que o saldo da dívida.';
  if (normalizedAmount > maxAmount + PAYMENT_TOLERANCE) {
    return 'O valor pago somado ao desconto não pode ultrapassar o saldo da dívida.';
  }
  if (normalizedDiscountAmount > 0 && creditedAmount < balance - PAYMENT_TOLERANCE) {
    return 'Desconto só pode ser usado para pagamento total.';
  }

  return null;
};
