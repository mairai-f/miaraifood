import { cn } from "@/lib/utils";
import { useLocale } from "./useLocale";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      data-i18n-ignore="true"
      className={cn(
        "fixed bottom-4 right-4 z-[100] flex items-center gap-1 rounded-full border border-[#d8e1ef] bg-white/92 p-1.5 shadow-[0_20px_48px_rgba(29,78,216,0.14)] backdrop-blur-xl",
        className,
      )}
      title={locale === "en" ? "Change language" : "Trocar idioma"}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e293b] text-white">
        <span className="text-[11px] font-bold tracking-[0.12em]">A/文</span>
      </div>
      <button
        type="button"
        onClick={() => setLocale("pt-BR")}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          locale === "pt-BR"
            ? "bg-[#1f56a5] text-white"
            : "text-[#64748b] hover:bg-[#edf4ff] hover:text-[#1f56a5]"
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
            ? "bg-[#1f56a5] text-white"
            : "text-[#64748b] hover:bg-[#edf4ff] hover:text-[#1f56a5]"
        }`}
        aria-label="Select English"
      >
        EN
      </button>
    </div>
  );
}
