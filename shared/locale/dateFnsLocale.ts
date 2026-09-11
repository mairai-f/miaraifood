import { enUS, es, ptBR, type Locale as DateFnsLocale } from "date-fns/locale";

import { defaultLocale, type Locale } from "./locales";
import { getActiveLocale } from "./format";

/*
  date-fns nao publica locale para guarani. Assim como no Intl, caimos em
  espanhol (es) - a mesma base escolhida em locales.ts para o formatLocale -
  para que nomes de mes e dia saiam consistentes em vez de virem em portugues.
*/
const dateFnsLocaleByLocale: Record<Locale, DateFnsLocale> = {
  "pt-BR": ptBR,
  en: enUS,
  es,
  gn: es,
};

export const getDateFnsLocaleFor = (locale: Locale): DateFnsLocale =>
  dateFnsLocaleByLocale[locale] ?? dateFnsLocaleByLocale[defaultLocale];

export const getDateFnsLocale = (): DateFnsLocale => getDateFnsLocaleFor(getActiveLocale());
