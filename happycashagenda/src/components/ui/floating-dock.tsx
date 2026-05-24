import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Facebook, Instagram, Share2, Phone } from "lucide-react";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";
import { buildWhatsAppUrl } from "@/lib/agendaWhatsApp";

export interface DockItem {
  title: string;
  icon: React.ReactNode;
  href: string;
}

interface FloatingDockProps {
  items: DockItem[];
  className?: string;
}

const normalizeSocialUrl = (value: string, baseUrl: string) => {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("www.")) return `https://${raw}`;
  if (raw.includes("/")) return `https://${raw.replace(/^\/+/, "")}`;

  const handle = raw.replace(/^@+/, "").replace(/^\/+/, "");
  if (!handle) return "";
  return `${baseUrl.replace(/\/$/, "")}/${handle}`;
};

export function FloatingDock({ items, className }: FloatingDockProps) {
  const location = useLocation();
  const { settings } = useAgendaBranding();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [socialOpen, setSocialOpen] = useState(false);
  const socialRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!socialOpen) return;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        socialRef.current &&
        !socialRef.current.contains(event.target as Node)
      ) {
        setSocialOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSocialOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [socialOpen]);

  const whatsappUrl = settings.whatsapp
    ? buildWhatsAppUrl(settings.whatsapp, `Ola, vim pela agenda da ${settings.displayName}.`)
    : null;

  const socialLinks = [
    {
      label: "Facebook",
      href: normalizeSocialUrl(settings.facebookUrl, "https://www.facebook.com"),
      icon: <Facebook className="w-4 h-4" />,
    },
    {
      label: "Instagram",
      href: normalizeSocialUrl(settings.instagramUrl, "https://www.instagram.com"),
      icon: <Instagram className="w-4 h-4" />,
    },
    {
      label: "WhatsApp",
      href: whatsappUrl || "",
      icon: <Phone className="w-4 h-4" />,
    },
  ].filter((link) => !!link.href);

  return (
    <div
      className={cn("fixed bottom-6 left-1/2 z-50 -translate-x-1/2", className)}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
        className="flex items-end gap-2 rounded-2xl border border-border/50 bg-background/80 px-3 py-2 shadow-xl backdrop-blur-xl"
      >
        {items.map((item, idx) => {
          const isActive = location.pathname === item.href;
          const isHovered = hoveredIndex === idx;
          const scale = isHovered
            ? 1.35
            : hoveredIndex !== null && Math.abs(hoveredIndex - idx) === 1
              ? 1.15
              : 1;

          return (
            <div
              key={item.href}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <AnimatePresence>
                {isHovered && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.9 }}
                    animate={{ opacity: 1, y: -4, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.9 }}
                    className="absolute -top-8 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background shadow-lg"
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
              <Link to={item.href}>
                <motion.div
                  animate={{ scale }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {item.icon}
                </motion.div>
              </Link>
            </div>
          );
        })}

        <div className="relative flex flex-col items-center" ref={socialRef}>
          <button
            type="button"
            onClick={() => setSocialOpen((prev) => !prev)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border border-border/20 transition-colors duration-200",
              socialOpen
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-card/80 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-label="Redes sociais"
            title="Redes sociais"
          >
            <Share2 className="h-5 w-5" />
          </button>

          <AnimatePresence>
            {socialOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                className="absolute bottom-full right-0 mb-2 z-50 w-44 rounded-xl border border-border/50 bg-background/90 p-3 shadow-xl backdrop-blur-xl"
              >
                {socialLinks.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {socialLinks.map(({ label, href, icon }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
                      >
                        {icon}
                        {label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Redes sociais nao cadastradas.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
