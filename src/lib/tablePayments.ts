/**
 * Decide se os pagamentos lançados fecham a conta da mesa.
 *
 * A regra vivia dentro da tela e confundia duas coisas: adicionar mais uma
 * parte e confirmar as que já existiam. Quem lançava o total e clicava em
 * confirmar era barrado por "saldo restante", e a mesa nunca era paga.
 */
export type TablePaymentPlan =
  | { status: 'over'; remaining: number }
  | { status: 'empty' }
  | { status: 'short'; missing: number }
  | { status: 'ready'; amounts: number[]; confirmedTotal: number };

/** Centavos perdidos no arredondamento nao podem travar o fechamento. */
const TOLERANCE = 0.01;

export const planTablePaymentConfirmation = (
  total: number,
  paidAmounts: number[],
  pendingAmount: number,
): TablePaymentPlan => {
  const paid = paidAmounts.reduce((sum, amount) => sum + amount, 0);
  const remaining = Math.max(0, total - paid);
  const hasPending = Number.isFinite(pendingAmount) && pendingAmount > 0;

  if (hasPending && pendingAmount > remaining + TOLERANCE) {
    return { status: 'over', remaining };
  }

  const amounts = hasPending ? [...paidAmounts, pendingAmount] : [...paidAmounts];
  if (!amounts.length) return { status: 'empty' };

  const confirmedTotal = amounts.reduce((sum, amount) => sum + amount, 0);
  if (confirmedTotal < total - TOLERANCE) {
    return { status: 'short', missing: total - confirmedTotal };
  }

  return { status: 'ready', amounts, confirmedTotal };
};
