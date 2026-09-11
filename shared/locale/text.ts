/*
  text.ts - normalizacao de texto para busca e ordenacao, ciente do idioma.

  Motivo: o padrao usado hoje em varias telas
    value.normalize("NFD").replace(/[̀-ͯ]/g, "")
  remove TODOS os sinais combinantes. Em portugues isso e inofensivo
  ("acao" casa "ação"), mas em guarani o til (U+0303) e fonemico: ele distingue
  vogal oral de nasal e forma a letra "g̃", que nao existe pre-composta em
  Unicode. Remover o til corrompe a palavra em vez de normalizar.

  Por isso a dobra de acentos passa a receber o locale e preservar os sinais que
  aquele idioma considera significativos.
*/

import { defaultLocale, getFormatLocaleFor, type Locale } from "./locales";

const COMBINING_MARKS = /[̀-ͯ]/g;
const COMBINING_TILDE = "̃";

/** Variantes de apostrofo usadas para o puso (oclusiva glotal) do guarani. */
const PUSO_VARIANTS = /[’ʼʻ`´']/g;
const PUSO_CANONICAL = "'";

/** Sinais combinantes que NAO podem ser removidos, por idioma. */
const protectedMarksByLocale: Partial<Record<Locale, string[]>> = {
  // Em guarani o til marca nasalizacao e e parte da identidade da letra.
  gn: [COMBINING_TILDE],
};

/**
 * Reduz o texto a uma forma comparavel para busca "sem acento".
 * Preserva os sinais que o idioma precisa e unifica as variantes de apostrofo,
 * para que o usuario encontre o termo digitando com ou sem puso.
 */
export const foldForSearch = (value: string, locale: Locale = defaultLocale): string => {
  if (!value) return "";

  const protectedMarks = protectedMarksByLocale[locale] ?? [];
  const decomposed = value.toLowerCase().normalize("NFD");

  const stripped = protectedMarks.length === 0
    ? decomposed.replace(COMBINING_MARKS, "")
    : decomposed.replace(COMBINING_MARKS, (mark) => (protectedMarks.includes(mark) ? mark : ""));

  // NFC recompoe "a"+til em "ã"; "g"+til fica decomposto por nao existir pre-composto.
  return stripped.normalize("NFC").replace(PUSO_VARIANTS, PUSO_CANONICAL);
};

/** `true` se `term` aparece em `value`, ignorando acentos irrelevantes ao idioma. */
export const matchesSearch = (value: string, term: string, locale: Locale = defaultLocale): boolean => {
  const foldedTerm = foldForSearch(term, locale).trim();
  if (!foldedTerm) return true;

  return foldForSearch(value, locale).includes(foldedTerm);
};

const collatorCache = new Map<string, Intl.Collator>();

/**
 * Collator do idioma ativo. Substitui `localeCompare(a, b, "pt-BR")` chumbado,
 * que ordena errado quando a interface esta em outro idioma.
 */
export const getCollator = (locale: Locale = defaultLocale): Intl.Collator => {
  const formatLocale = getFormatLocaleFor(locale);
  const cached = collatorCache.get(formatLocale);
  if (cached) return cached;

  const collator = new Intl.Collator(formatLocale, {
    sensitivity: "base",
    numeric: true,
    ignorePunctuation: false,
  });

  collatorCache.set(formatLocale, collator);
  return collator;
};

/** Comparador pronto para `Array.prototype.sort`. */
export const compareText = (left: string, right: string, locale: Locale = defaultLocale): number =>
  getCollator(locale).compare(left ?? "", right ?? "");
