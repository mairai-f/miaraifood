import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { value: 500, suffix: "+", label: "Clientes ativos" },
  { value: 50, suffix: "K+", label: "Vendas processadas" },
  { value: 99, suffix: "%", label: "Uptime garantido" },
  { value: 24, suffix: "/7", label: "Suporte técnico" },
];

const Stats = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Counter animation
      const counters = ref.current?.querySelectorAll(".stat-value");
      counters?.forEach((el, i) => {
        const target = stats[i].value;
        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2.5,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => {
            (el as HTMLElement).textContent = Math.round(obj.val).toString();
          },
        });
      });

      // Parallax background
      gsap.to(".stats-bg", {
        yPercent: -20,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative py-20 overflow-hidden">
      {/* Parallax gradient bg */}
      <div className="stats-bg absolute inset-0 bg-gradient-to-r from-primary/10 via-card to-secondary/10" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(31,86,165,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <div className="container relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center group">
              <div className="mb-2">
                <span className="stat-value font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary">0</span>
                <span className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-primary">{s.suffix}</span>
              </div>
              <p className="text-sm md:text-base text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
