import { createContext } from "react";

import type { Locale } from "./localeTranslations";

export type LocaleContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  toggleLocale: () => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);
