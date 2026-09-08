import type { CartItem } from '../types';

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const guestKey = (qrToken: string) => `miar_qrmenu_guest_${qrToken}`;
export const cartKey = (qrToken: string, guestId: string) => `miar_qrmenu_cart_${qrToken}_${guestId}`;
export const getCart = (qrToken: string, guestId: string): CartItem[] => lsGet(cartKey(qrToken, guestId), []);
export const setCart = (qrToken: string, guestId: string, cart: CartItem[]) => lsSet(cartKey(qrToken, guestId), cart);
export const stepperKey = (qrToken: string) => `miar_qrmenu_stepper_${qrToken}`;
