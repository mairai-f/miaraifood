export const currency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const normalizeSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export const titleCaseFallback = (value: string, fallback: string) => {
  const clean = value.trim();
  return clean || fallback;
};

export const publicMenuBaseUrl = () =>
  (import.meta.env.VITE_MENU_PUBLIC_URL as string | undefined)?.replace(/\/+$/, "") ||
  window.location.origin;

export const tableMenuUrl = (storeSlug: string, tableSlug: string) =>
  `${publicMenuBaseUrl()}/${storeSlug}/mesa/${tableSlug}`;

export const deliveryMenuUrl = (storeSlug: string) =>
  `${publicMenuBaseUrl()}/${storeSlug}`;
