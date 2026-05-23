import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";

gsap.registerPlugin(ScrollTrigger);

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { settings } = useAgendaBranding();
  const paragraphs = settings.aboutText
    ? settings.aboutText.split(/\n{2,}|\n/).map((text) => text.trim()).filter(Boolean)
    : [
        `${settings.displayName} une atendimento organizado, horarios claros e cuidado em cada detalhe.`,
        `Nossa equipe trabalha para que cada cliente encontre o melhor ${settings.serviceLabel.toLowerCase()} com praticidade e seguranca.`,
      ];

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".about-animate",
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: { trigger: ".about-text-container", start: "top 75%" },
        },
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className={`grid gap-8 md:gap-12 ${settings.aboutImageUrl ? "lg:grid-cols-[0.95fr_1.05fr] items-center" : ""}`}>
          {settings.aboutImageUrl && (
            <div className="about-animate overflow-hidden rounded-lg border border-border bg-muted">
              <img
                src={settings.aboutImageUrl}
                alt={settings.aboutTitle || settings.displayName}
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className={`about-text-container ${settings.aboutImageUrl ? "text-left" : "mx-auto max-w-3xl text-center"}`}>
            <span className="about-animate inline-block text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Sobre
            </span>
            <h2 className="about-animate font-serif text-3xl md:text-5xl font-bold mt-3 mb-8 leading-tight">
              {settings.aboutTitle || `Sobre ${settings.displayName}`}
            </h2>
            {paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph}`} className="about-animate text-muted-foreground mb-6 leading-relaxed text-lg last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
