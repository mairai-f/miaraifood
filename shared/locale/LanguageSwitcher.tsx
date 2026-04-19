import { Languages } from "lucide-react";

import { useLocale } from "./useLocale";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      data-i18n-ignore="true"
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-1 rounded-full border border-border bg-card/90 p-1.5 shadow-2xl backdrop-blur-xl"
      title={locale === "en" ? "Change language" : "Trocar idioma"}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Languages className="h-4 w-4" />
      </div>
      <button
        type="button"
        onClick={() => setLocale("pt-BR")}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          locale === "pt-BR"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        aria-label="Selecionar portugues do Brasil"
      >
        PT-BR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          locale === "en"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        aria-label="Select English"
      >
        EN
      </button>
    </div>
  );
}
