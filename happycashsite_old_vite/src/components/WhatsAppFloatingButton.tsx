import { MessageCircle } from "lucide-react";

const WHATSAPP_PHONE = "5512988918792";
const WHATSAPP_MESSAGE = "Olá! Vim pelo site da HappyCash e quero um primeiro atendimento para conhecer o sistema.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export function WhatsAppFloatingButton() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[120] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] sm:bottom-5 sm:right-5 md:bottom-6 md:right-6"
      style={{
        transform: "translateZ(0)",
      }}
    >
      <div className="pointer-events-auto hidden max-w-[18rem] rounded-2xl border border-emerald-400/20 bg-background/95 px-3 py-2 text-right text-xs leading-relaxed text-foreground shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur md:block">
        Primeiro contato? Fale com a HappyCash pelo WhatsApp: (12) 98891-8792.
      </div>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a HappyCash no WhatsApp"
        title="Falar com a HappyCash no WhatsApp"
        className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_18px_45px_rgba(37,211,102,0.34)] transition-transform duration-200 hover:scale-[1.03] hover:bg-[#20ba59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-14 sm:w-auto sm:min-w-[13.5rem] sm:justify-start sm:gap-3 sm:px-4"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full">
          <MessageCircle className="h-6 w-6" />
        </span>
        <span className="hidden pr-1 text-sm font-semibold sm:inline">Falar no WhatsApp</span>
      </a>
    </div>
  );
}
