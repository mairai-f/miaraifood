import { localeStorageKey, resolveLocale, translateTextValue, type Locale } from "./localeTranslations";

const readStoredLocale = (): Locale => {
  if (typeof window === "undefined") return "pt-BR";

  const storedLocale = window.localStorage.getItem(localeStorageKey);
  if (storedLocale) {
    return resolveLocale(storedLocale);
  }

  return resolveLocale(window.navigator.languages?.[0] ?? window.navigator.language);
};

export const getActiveLocale = () => readStoredLocale();

export const formatCurrency = (value: number, currency = "BRL") =>
  new Intl.NumberFormat(getActiveLocale(), {
    style: "currency",
    currency,
  }).format(value ?? 0);

export const formatDateTime = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) => new Intl.DateTimeFormat(getActiveLocale(), options).format(new Date(value));

export const formatDateOnly = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short" },
) => new Intl.DateTimeFormat(getActiveLocale(), options).format(new Date(value));

export const formatPercent = (
  value: number,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 },
) => new Intl.NumberFormat(getActiveLocale(), options).format(value);

export const translateCurrentText = (value: string) => translateTextValue(value, getActiveLocale());
