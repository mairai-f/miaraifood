import { X } from "lucide-react";
import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  disableEscape?: boolean;
};

export function Modal({
  title,
  subtitle,
  open,
  onClose,
  children,
  footer,
  size = "md",
  disableEscape = false,
}: ModalProps) {
  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (disableEscape) return;
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disableEscape, open, requestClose]);

  if (!open) return null;

  const width = size === "lg" ? "md:max-w-4xl" : size === "sm" ? "md:max-w-md" : "md:max-w-2xl";

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[#1a130d]/46 p-0 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (!disableEscape) requestClose();
      }}
    >
      <div
        className={`modal-sheet mobile-bottom-sheet rounded-t-[30px] bg-card shadow-panel md:modal-panel md:rounded-[32px] ${width}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pt-3 md:hidden">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-border" />
        </div>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border/70 bg-card/95 p-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold tracking-[-0.03em] text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button className="hc-icon-button" onClick={requestClose} aria-label="Fechar">
            <X size={19} />
          </button>
        </div>
        <div className="p-4 md:p-5">{children}</div>
        {footer ? <div className="sticky bottom-0 border-t border-border/70 bg-card/95 p-4 backdrop-blur safe-bottom">{footer}</div> : null}
      </div>
    </div>
  );
}
