/*
  locales.ts - fonte unica de verdade dos idiomas suportados.

  Ponto critico: `Intl` NAO conhece o guarani ("gn").
  `Intl.NumberFormat.supportedLocalesOf(["gn"])` devolve `[]` e, em vez de lancar
  erro, a formatacao cai silenciosamente no locale padrao do runtime - ou seja,
  a mesma data sairia formatada diferente em cada maquina de usuario.
  Por isso cada idioma declara um `formatLocale` real, usado para numero, moeda,
  data e ordenacao, separado do idioma da interface.
*/

export type Locale = "pt-BR" | "en" | "es" | "gn";

export type LocaleDefinition = {
  /** Idioma da interface. */
  code: Locale;
  /** Nome no proprio idioma, exibido no seletor. */
  nativeName: string;
  /** Nome em portugues, para telas administrativas. */
  ptName: string;
  /**
   * Locale REAL usado por Intl (numero, moeda, data, ordenacao).
   * Difere de `code` quando o Intl nao suporta o idioma.
   */
  formatLocale: string;
  /** Valor do atributo `lang` no <html>. */
  htmlLang: string;
  dir: "ltr" | "rtl";
  flag: string;
};

export const localeDefinitions: Record<Locale, LocaleDefinition> = {
  "pt-BR": {
    code: "pt-BR",
    nativeName: "Português",
    ptName: "Português (Brasil)",
    formatLocale: "pt-BR",
    htmlLang: "pt-BR",
    dir: "ltr",
    flag: "🇧🇷",
  },
  en: {
    code: "en",
    nativeName: "English",
    ptName: "Inglês",
    formatLocale: "en-US",
    htmlLang: "en",
    dir: "ltr",
    flag: "🇺🇸",
  },
  es: {
    code: "es",
    nativeName: "Español",
    ptName: "Espanhol",
    formatLocale: "es-PY",
    htmlLang: "es",
    dir: "ltr",
    flag: "🇪🇸",
  },
  gn: {
    code: "gn",
    nativeName: "Avañe'ẽ",
    ptName: "Guarani",
    // Intl nao tem dados para "gn": usamos es-PY como base de formatacao.
    formatLocale: "es-PY",
    htmlLang: "gn",
    dir: "ltr",
    flag: "🇵🇾",
  },
};

export const supportedLocales = Object.keys(localeDefinitions) as Locale[];

export const defaultLocale: Locale = "pt-BR";

export const localeStorageKey = "happycash-locale";

/** Marca que o usuario escolheu o idioma de forma explicita (modal de entrada). */
export const localeChoiceStorageKey = "happycash-locale-chosen";

const isSupportedLocale = (value: string): value is Locale =>
  Object.prototype.hasOwnProperty.call(localeDefinitions, value);

/**
 * Converte qualquer string de idioma (navegador, storage, querystring) em um
 * Locale suportado. Casa primeiro a tag completa e depois so o idioma base,
 * para que "es-AR", "es-PY" e "pt-PT" caiam no lugar certo.
 */
export const resolveLocale = (value?: string | null): Locale => {
  if (!value) return defaultLocale;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultLocale;

  for (const locale of supportedLocales) {
    if (normalized === locale.toLowerCase()) return locale;
  }

  const base = normalized.split(/[-_]/)[0];
  if (base === "pt") return "pt-BR";
  if (isSupportedLocale(base)) return base;

  return defaultLocale;
};

export const getLocaleDefinition = (locale: Locale): LocaleDefinition =>
  localeDefinitions[locale] ?? localeDefinitions[defaultLocale];

/** Locale que o Intl realmente entende para o idioma de interface informado. */
export const getFormatLocaleFor = (locale: Locale): string =>
  getLocaleDefinition(locale).formatLocale;
