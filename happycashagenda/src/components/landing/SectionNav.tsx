import { useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Users, Info, MapPin } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const sections = [
  { id: "equipe", label: "Equipe", icon: Users },
  { id: "sobre", label: "Sobre", icon: Info },
  { id: "localizacao", label: "Local", icon: MapPin },
];

export function SectionNav() {
  const [active, setActive] = useState("");
  const [visible, setVisible] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  useEffect(() => {
    if (!document.getElementById("equipe")) return;

    const triggers: ScrollTrigger[] = [];

    // Show nav after hero
    const showTrigger = ScrollTrigger.create({
      trigger: "#equipe",
      start: "top 80%",
      onEnter: () => setVisible(true),
      onLeaveBack: () => setVisible(false),
    });
    triggers.push(showTrigger);

    // Track active section
    sections.forEach(({ id }) => {
      const st = ScrollTrigger.create({
        trigger: `#${id}`,
        start: "top center",
        end: "bottom center",
        onToggle: (self) => {
          if (self.isActive) setActive(id);
        },
      });
      triggers.push(st);
    });

    return () => triggers.forEach((st) => st.kill());
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    // Ajusta o scroll considerando cabeçalho fixo / elementos com pinning do GSAP
    const header = document.querySelector("header");
    const headerHeight =
      header instanceof HTMLElement ? header.offsetHeight : 0;

    const targetY =
      el.getBoundingClientRect().top + window.scrollY - headerHeight - 8; // padding extra

    // Smooth rápido via requestAnimationFrame (meio termo entre instantâneo e behavior:'smooth')
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 220;
    const startTime = performance.now();

    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      window.scrollTo(0, startY + distance * eased);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  return (
    <nav
      className={`fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 transition-all duration-500 ${
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      } hidden md:flex`}
    >
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className={`group flex items-center gap-2 px-3 py-2.5 rounded-full transition-all duration-300 ${
            active === id
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-card/80 backdrop-blur-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground border border-border"
          }`}
          title={label}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span
            className={`text-xs font-medium overflow-hidden transition-all duration-300 ${
              active === id
                ? "max-w-20 opacity-100"
                : "max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100"
            }`}
          >
            {label}
          </span>
        </button>
      ))}
    </nav>
  );
}
