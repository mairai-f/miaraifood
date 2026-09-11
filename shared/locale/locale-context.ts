import { createContext } from "react";

import type { Locale, LocaleDefinition } from "./locales";

export type LocaleContextValue = {
  /** Idioma da interface. */
  locale: Locale;
  /**
   * Locale que o Intl entende, derivado de `locale`.
   * Difere dele no guarani, que o Intl nao suporta.
   */
  formatLocale: string;
  definition: LocaleDefinition;
  /**
   * `false` enquanto o idioma vier apenas de palpite do navegador.
   * O modal de entrada usa isso para decidir se aparece.
   */
  hasChosenLocale: boolean;
  /** Troca o idioma sem marcar como escolha explicita do usuario. */
  setLocale: (nextLocale: Locale) => void;
  /** Troca o idioma e registra a escolha, dispensando o modal nas proximas visitas. */
  confirmLocale: (nextLocale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);
