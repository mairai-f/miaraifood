import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CalendarDays, CreditCard, QrCode, Smartphone } from "lucide-react";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";

interface SplashScreenProps {
  onComplete: () => void;
}

const VISITED_KEY = "happycash_agenda_visited";

const agendaCells = [
  "bg-primary",
  "bg-accent",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-primary/75",
  "bg-accent/80",
  "bg-emerald-500/80",
  "bg-sky-500/80",
  "bg-primary/55",
];

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const enteringRef = useRef(false);
  const [done, setDone] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const { settings } = useAgendaBranding();

  const completeSplash = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    sessionStorage.setItem(VISITED_KEY, "true");
    setDone(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (sessionStorage.getItem(VISITED_KEY)) {
      completeSplash();
      return;
    }

    const container = containerRef.current;
    if (!container) {
      completeSplash();
      return;
    }

    const revealFallback = window.setTimeout(() => setShowButton(true), 3600);

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        onComplete: () => setShowButton(true),
      });

      timeline
        .from(".splash-panel", {
          y: 24,
          opacity: 0,
          duration: 0.55,
          stagger: 0.08,
        })
        .from(
          ".agenda-cell",
          {
            scale: 0.2,
            opacity: 0,
            duration: 0.45,
            stagger: 0.035,
            ease: "back.out(1.8)",
          },
          "-=0.25",
        )
        .from(
          ".brand-line",
          {
            y: 18,
            opacity: 0,
            duration: 0.42,
            stagger: 0.08,
          },
          "-=0.2",
        )
        .from(
          ".module-chip",
          {
            y: 14,
            opacity: 0,
            duration: 0.35,
            stagger: 0.06,
          },
          "-=0.15",
        );
    }, container);

    return () => {
      window.clearTimeout(revealFallback);
      ctx.revert();
    };
  }, [completeSplash]);

  useEffect(() => {
    if (!showButton || !containerRef.current) return;
    gsap.fromTo(
      containerRef.current.querySelector(".splash-enter-btn"),
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
    );
  }, [showButton]);

  const handleEnter = useCallback(() => {
    if (enteringRef.current) return;
    enteringRef.current = true;

    const container = containerRef.current;
    if (!container) {
      completeSplash();
      return;
    }

    gsap
      .timeline({ onComplete: completeSplash })
      .to(".splash-content", {
        y: -20,
        opacity: 0,
        duration: 0.3,
        ease: "power2.in",
      })
      .to(
        ".splash-wipe",
        {
          scaleX: 1,
          duration: 0.52,
          ease: "power3.inOut",
        },
        "-=0.16",
      )
      .to(container, { opacity: 0, duration: 0.18 }, "-=0.08");
  }, [completeSplash]);

  if (done) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#080814] text-white"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(124,58,237,0.24),transparent_32%),linear-gradient(315deg,rgba(14,165,233,0.2),transparent_34%),linear-gradient(180deg,rgba(250,204,21,0.12),transparent_46%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(8,8,20,0.92))]" />

      <div className="splash-wipe absolute inset-y-0 left-0 z-20 w-full origin-left scale-x-0 bg-background" />

      <div className="splash-content relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-[0.9fr_1.1fr]">
          <div className="splash-panel rounded-lg border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur md:p-5">
            <div className="rounded-lg bg-[#101024] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-accent" />
                  <span className="text-sm font-semibold text-white/85">Agenda</span>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                  Online
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {agendaCells.map((cellClassName, index) => (
                  <div
                    key={`${cellClassName}-${index}`}
                    className={`agenda-cell aspect-square rounded-md ${cellClassName}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="splash-panel">
            <div className="brand-line inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              HappyCash
            </div>
            <h1 className="brand-line mt-5 max-w-xl text-4xl font-black leading-tight md:text-6xl">
              {settings.displayName}
            </h1>
            <p className="brand-line mt-4 max-w-lg text-base leading-7 text-white/70 md:text-lg">
              {settings.tagline}
            </p>

            <div className="mt-6 grid max-w-xl grid-cols-3 gap-2">
              {[
                { icon: QrCode, label: "QR" },
                { icon: CreditCard, label: "Pix" },
                { icon: Smartphone, label: "Mobile" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="module-chip rounded-lg border border-white/10 bg-white/[0.06] p-3">
                    <Icon className="h-5 w-5 text-accent" />
                    <span className="mt-2 block text-sm font-semibold text-white/85">{item.label}</span>
                  </div>
                );
              })}
            </div>

            {showButton && (
              <InteractiveHoverButton
                onClick={handleEnter}
                text="Abrir agenda"
                className="mt-8 splash-enter-btn border-white/20 bg-white text-[#080814] hover:text-[#080814]"
              />
            )}
          </div>
        </div>
      </div>

      {!showButton && (
        <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-8 animate-pulse rounded-full bg-white/35"
              style={{ animationDelay: `${index * 0.18}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
