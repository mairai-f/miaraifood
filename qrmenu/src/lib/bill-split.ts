/**
 * bill-split.ts — client-side mirror of api-server/src/lib/bill-split.ts.
 *
 * Kept byte-for-byte identical to the server's pure `splitBillCents` on purpose:
 * BillScreen fetches the table's authoritative `totalCents` once from
 * POST /tables/by-token/:token/bill-split, then recomputes the per-person shares
 * locally as the headcount +/- counter changes, so the split updates instantly
 * without a network round trip per click. If you change the algorithm here, change
 * it in api-server/src/lib/bill-split.ts too (and vice versa) — they must never drift.
 */
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
