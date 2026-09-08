export function splitBillCents(totalCents: number, headcount: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('totalCents deve ser um inteiro não-negativo (centavos)');
  }
  if (!Number.isInteger(headcount) || headcount < 1) {
    throw new Error('headcount deve ser um inteiro maior ou igual a 1');
  }

  const base = Math.floor(totalCents / headcount);
  const remainder = totalCents - base * headcount;

  return Array.from({ length: headcount }, (_, i) => base + (i < remainder ? 1 : 0));
}
