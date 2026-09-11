/*
  format.ts - numero, moeda, data e percentual.

  Regra central: o locale usado aqui NAO e o idioma da interface, e sim o
  `formatLocale` correspondente (ver locales.ts). Isso existe porque o Intl nao
  conhece o guarani e, sem essa separacao, a formatacao cairia no padrao do
  navegador de cada usuario.

  Segunda regra: idioma nao define moeda. Um lojista brasileiro atendendo em
  guarani continua faturando em BRL. A moeda vem sempre da loja, nunca do idioma.
*/

import {
  defaultLocale,
  getFormatLocaleFor,
  localeStorageKey,
  resolveLocale,
  type Locale,
} from "./locales";
import { translateTextValue } from "./localeTranslations";

const readStoredLocale = (): Locale => {
  if (typeof window === "undefined") return defaultLocale;

  const storedLocale = window.localStorage.getItem(localeStorageKey);
  if (storedLocale) {
    return resolveLocale(storedLocale);
  }

  return resolveLocale(window.navigator.languages?.[0] ?? window.navigator.language);
};

/** Idioma da interface. */
export const getActiveLocale = (): Locale => readStoredLocale();

/** Locale que o Intl entende, derivado do idioma da interface. */
export const getFormatLocale = (): string => getFormatLocaleFor(getActiveLocale());

/**
 * Casas decimais reais da moeda. O guarani paraguaio (PYG) nao tem centavos:
 * formatar com 2 casas fixas produziria valores invalidos.
 */
export const getCurrencyFractionDigits = (currency: string): number => {
  try {
    const { minimumFractionDigits } = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions();

    return minimumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};

export const formatCurrency = (value: number, currency = "BRL") =>
  new Intl.NumberFormat(getFormatLocale(), {
    style: "currency",
    currency,
  }).format(value ?? 0);

export const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat(getFormatLocale(), options).format(value ?? 0);

export const formatDateTime = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" },
) => new Intl.DateTimeFormat(getFormatLocale(), options).format(new Date(value));

export const formatDateOnly = (
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { dateStyle: "short" },
) => new Intl.DateTimeFormat(getFormatLocale(), options).format(new Date(value));

export const formatPercent = (
  value: number,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 },
) => new Intl.NumberFormat(getFormatLocale(), options).format(value);

export const translateCurrentText = (value: string) => translateTextValue(value, getActiveLocale());
