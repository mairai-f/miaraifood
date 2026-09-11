/*
  LocaleGatewayModal.tsx - selecao de idioma antes da tela de login.

  Aparece uma unica vez, enquanto o idioma vier so de palpite do navegador.
  Depois que o usuario confirma, `hasChosenLocale` fica gravado e o modal nao
  volta - a troca passa a ser pelo seletor dentro do sistema.

  Deliberadamente sem dependencia de componente de UI do app principal
  (nada de "@/components/ui/dialog" ou "@/lib/utils"), porque shared/ e
  consumido tambem por cliente, entregador, supergestora e qrmenu, que tem
  arvores de componentes proprias.
*/

import { useState } from "react";

import { getDictionarySize } from "./localeTranslations";
import { localeDefinitions, supportedLocales, type Locale } from "./locales";
import { useLocale } from "./useLocale";

/** Titulo no proprio idioma: o usuario precisa reconhecer a frase sem ler portugues. */
const headings: Record<Locale, string> = {
  "pt-BR": "Selecione seu idioma",
  en: "Select your language",
  es: "Seleccioná tu idioma",
  gn: "Eiporavo nde ñe'ẽ",
};

const actions: Record<Locale, string> = {
  "pt-BR": "Continuar",
  en: "Continue",
  es: "Continuar",
  gn: "Continuar",
};

const partialNotices: Record<Locale, string> = {
  "pt-BR": "Tradução em andamento. Os textos ainda não traduzidos aparecem em português.",
  en: "Translation in progress. Untranslated text still appears in Portuguese.",
  es: "Traducción en curso. Los textos aún no traducidos aparecen en portugués.",
  gn: "Ojejapohína traducción. Ñe'ẽ ndojetraducíriva osẽta portugués-pe.",
};

export function LocaleGatewayModal({ onDone }: { onDone?: () => void }) {
  const { locale, setLocale, confirmLocale } = useLocale();
  const [selected, setSelected] = useState<Locale>(locale);

  // Guarani ainda nao tem catalogo (aguarda o glossario da Fase 2).
  const selectionIsPartial = getDictionarySize(selected) === 0 && selected !== "pt-BR";

  const handleSelect = (nextLocale: Locale) => {
    setSelected(nextLocale);
    // Aplica na hora para o usuario ver o idioma antes de confirmar.
    setLocale(nextLocale);
  };

  const handleConfirm = () => {
    confirmLocale(selected);
    onDone?.();
  };

  return (
    <div
      data-i18n-ignore="true"
      role="dialog"
      aria-modal="true"
      aria-label={headings[selected]}
      className="fixed inset-0 z-[200] flex min-h-screen items-center justify-center overflow-y-auto bg-[#0f1115] px-4 py-10"
    >
      {/* overflow-hidden: o brilho inferior fica 10% abaixo da borda e criaria rolagem no modal. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[15%] h-96 w-96 rounded-full bg-cyan-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.03] p-7 shadow-[0_0_80px_rgba(0,150,255,0.08)] backdrop-blur-3xl sm:p-9">
        <div className="flex flex-col items-center text-center">
          <img
            src="/miafavico.svg?v=miar-20260908"
            alt="MIAR AI/FOOD"
            className="h-16 w-16 object-contain drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]"
          />
          <h1 className="mt-5 text-xl font-bold tracking-tight text-white sm:text-2xl">
            {headings[selected]}
          </h1>
          <p className="mt-1.5 text-sm text-cyan-100/50">MIAR AI/FOOD</p>
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          {supportedLocales.map((code) => {
            const definition = localeDefinitions[code];
            const isSelected = selected === code;

            return (
              <button
                key={code}
                type="button"
                lang={definition.htmlLang}
                onClick={() => handleSelect(code)}
                aria-pressed={isSelected}
                className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  isSelected
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.06]"
                }`}
              >
                <span aria-hidden="true" className="text-2xl leading-none">{definition.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">
                    {definition.nativeName}
                  </span>
                  <span className="block truncate text-xs text-cyan-100/40">{definition.ptName}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                    isSelected ? "border-cyan-300 bg-cyan-300" : "border-white/25"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {selectionIsPartial && (
          <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100/70">
            {partialNotices[selected]}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3.5 text-sm font-bold text-[#0f1115] transition-opacity hover:opacity-90"
        >
          {actions[selected]}
        </button>
      </div>
    </div>
  );
}
