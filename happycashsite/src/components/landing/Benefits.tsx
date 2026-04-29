import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Zap, Shield, Smartphone, Headphones } from "lucide-react";
import screenshot2 from "@/assets/fiado-digital-clientes.png";

gsap.registerPlugin(ScrollTrigger);

const benefits = [
  { icon: Zap, title: "Menos atrito na rotina", desc: "Cadastre cliente, venda, acompanhe saldo e cobre sem ficar alternando entre caderno, planilha e WhatsApp." },
  { icon: Shield, title: "Controle mais confiável", desc: "Histórico organizado para você saber o que foi vendido, pago, cancelado ou ainda está pendente." },
  { icon: Smartphone, title: "Acesse de qualquer lugar", desc: "Use no celular, tablet ou computador. O foco é manter o controle perto de você durante a operação." },
  { icon: Headphones, title: "Atendimento próximo", desc: "Suporte via WhatsApp para destravar dúvidas mais rápido e sem complicar a implantação." },
];

const Benefits = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".benefits-image",
        { x: -80, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 70%" }
        }
      );
      gsap.fromTo(".benefit-item",
        { x: 60, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: "power3.out",
          scrollTrigger: { trigger: ".benefits-list", start: "top 80%" }
        }
      );

      // Parallax on image
      gsap.to(".benefits-image", {
        yPercent: -10,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
      
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image side */}
          <div className="benefits-image relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-3xl blur-2xl" />
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-2xl">
              <img src={screenshot2} alt="HappyCash Dashboard" className="rounded-xl w-full" loading="lazy" />
            </div>
          </div>

          {/* Content side */}
          <div>
            <span className="inline-block text-sm font-semibold text-secondary tracking-widest uppercase mb-4">Por que escolher</span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Mais clareza para vender, cobrar e decidir no seu{" "}
              <span className="text-primary">negócio</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-10 leading-relaxed">
              O HappyCash junta controle de fiado, PDV, estoque e relatórios para você parar de apagar incêndio e começar a enxergar a operação.
            </p>

            <div className="benefits-list space-y-6">
              {benefits.map((b) => (
                <div key={b.title} className="benefit-item group flex gap-4 p-4 rounded-xl transition-all duration-300 hover:bg-card/80 hover:shadow-lg cursor-default">
                  <div className="shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <b.icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold mb-1 group-hover:text-primary transition-colors">{b.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
