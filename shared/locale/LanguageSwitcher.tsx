/*
  LanguageSwitcher.tsx - troca de idioma dentro do sistema.

  Com quatro idiomas a fileira de botoes nao cabe mais, entao vira um menu
  compacto. Sem "@/lib/utils": shared/ e consumido por varios apps.
*/

import { useEffect, useRef, useState } from "react";

import { localeDefinitions, supportedLocales, type Locale } from "./locales";
import { useLocale } from "./useLocale";

const labels: Record<Locale, string> = {
  "pt-BR": "Trocar idioma",
  en: "Change language",
  es: "Cambiar idioma",
  gn: "Emoambue ñe'ẽ",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, confirmLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const active = localeDefinitions[locale];

  return (
    <div
      ref={containerRef}
      data-i18n-ignore="true"
      className={`fixed bottom-4 right-4 z-[100] ${className}`}
    >
      {open && (
        <div
          role="listbox"
          aria-label={labels[locale]}
          className="absolute bottom-full right-0 mb-2 w-52 overflow-hidden rounded-2xl border border-[#d8e1ef] bg-white shadow-[0_20px_48px_rgba(29,78,216,0.18)]"
        >
          {supportedLocales.map((code) => {
            const definition = localeDefinitions[code];
            const isActive = code === locale;

            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={isActive}
                lang={definition.htmlLang}
                onClick={() => {
                  confirmLocale(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors ${
                  isActive ? "bg-[#edf4ff] font-semibold text-[#1f56a5]" : "text-[#334155] hover:bg-[#f5f8fd]"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">{definition.flag}</span>
                <span className="truncate">{definition.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={labels[locale]}
        aria-label={labels[locale]}
        className="flex items-center gap-2 rounded-full border border-[#d8e1ef] bg-white/92 py-1.5 pl-1.5 pr-3.5 shadow-[0_20px_48px_rgba(29,78,216,0.14)] backdrop-blur-xl"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e293b] text-base leading-none">
          <span aria-hidden="true">{active.flag}</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#1f56a5]">
          {active.code === "pt-BR" ? "PT" : active.code.toUpperCase()}
        </span>
      </button>
    </div>
  );
}
