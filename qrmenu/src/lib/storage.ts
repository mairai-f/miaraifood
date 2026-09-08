import type { CartItem } from '../types';

export function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; }
  catch { return fallback; }
}
export function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/** Guest id is scoped per QR token — same pattern as artifacts/cliente's dine-in flow (`miar_table_guest_<qrToken>`). */
export const guestKey = (qrToken: string) => `miar_qrmenu_guest_${qrToken}`;

/**
 * Cart is per-guest, never merged across the table. Scoped by qrToken + guestId
 * so two guests scanning the same table each keep their own independent cart.
 */
export const cartKey = (qrToken: string, guestId: string) => `miar_qrmenu_cart_${qrToken}_${guestId}`;
export const getCart = (qrToken: string, guestId: string): CartItem[] => lsGet(cartKey(qrToken, guestId), []);
export const setCart = (qrToken: string, guestId: string, cart: CartItem[]) => lsSet(cartKey(qrToken, guestId), cart);

/** Stepper answers persisted client-side per table session — used later to pre-fill the bill-split headcount. */
export const stepperKey = (qrToken: string) => `miar_qrmenu_stepper_${qrToken}`;
