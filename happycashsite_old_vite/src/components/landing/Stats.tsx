import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BarChart3, PackageCheck, ReceiptText, UsersRound } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const stats = [
  { icon: UsersRound, value: "500+", label: "clientes acompanhados", tone: "bg-blue-50 border-blue-200 dark:bg-blue-950/25 dark:border-blue-900/60" },
  { icon: ReceiptText, value: "50K+", label: "vendas registradas", tone: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/25 dark:border-cyan-900/60" },
  { icon: PackageCheck, value: "10K+", label: "produtos controlados", tone: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/25 dark:border-emerald-900/60" },
  { icon: BarChart3, value: "4", label: "pagamentos agrupados", tone: "bg-violet-50 border-violet-200 dark:bg-violet-950/25 dark:border-violet-900/60" },
];

const Stats = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".stats-card",
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.55,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 82%" },
        },
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="relative overflow-hidden py-14 md:py-16">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(31,86,165,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="container relative z-10">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="grid gap-3 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className={`stats-card rounded-lg border px-4 py-5 ${s.tone}`}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="font-heading text-4xl font-bold text-primary">{s.value}</div>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
