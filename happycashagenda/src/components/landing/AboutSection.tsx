import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".about-text-line",
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
    <section ref={sectionRef} className="py-28 overflow-hidden">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="about-text-container text-center">
          <span className="about-text-line inline-block text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Sobre Nós
          </span>
          <h2 className="about-text-line font-serif text-3xl md:text-5xl font-bold mt-3 mb-8 leading-tight">
            Tradição e Modernidade em Cada Corte
          </h2>
          <p className="about-text-line text-muted-foreground mb-6 leading-relaxed text-lg">
            Na LaCortes, cada corte é uma forma de expressar quem você é. Unimos
            tradição e estilo moderno para entregar resultados de qualidade,
            sempre com atenção aos detalhes. Em um ambiente confortável e com
            atendimento personalizado, oferecemos mais do que um corte — uma
            experiência completa.
          </p>
          <p className="about-text-line text-muted-foreground leading-relaxed text-lg">
            Com ambiente sofisticado e atendimento personalizado, garantimos uma
            experiência única que vai além do corte.
          </p>
        </div>
      </div>
    </section>
  );
}
