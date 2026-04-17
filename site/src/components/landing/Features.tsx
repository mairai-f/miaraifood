import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Monitor, BookOpen, Package, Tags, Users,
  MessageCircle, BarChart3, Gift, Wallet, Key,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Monitor, title: "Frente de Caixa (PDV)", desc: "Sistema completo de ponto de venda com agilidade e praticidade." },
  { icon: BookOpen, title: "Caderneta de Fiado Digital", desc: "Controle total das vendas fiadas com histórico detalhado." },
  { icon: Package, title: "Controle de Estoque", desc: "Gerencie entradas, saídas e estoque mínimo em tempo real." },
  { icon: Tags, title: "Cadastro de Produtos", desc: "Cadastre produtos com preços, códigos e categorias." },
  { icon: Users, title: "Cadastro de Clientes", desc: "Base completa de clientes com dados e histórico de compras." },
  { icon: MessageCircle, title: "Cobranças via WhatsApp", desc: "Mensagens prontas de cobrança enviadas direto pelo WhatsApp." },
  { icon: BarChart3, title: "Relatórios Financeiros", desc: "Acompanhe receitas, despesas e lucro com relatórios detalhados." },
  { icon: Gift, title: "Programa de Fidelidade", desc: "Recompense seus clientes fiéis e aumente as vendas." },
  { icon: Wallet, title: "Pix, Boleto, Crédito e Débito", desc: "Aceite todas as formas de pagamento no seu negócio." },
  { icon: Key, title: "Gerador de Chave Pix", desc: "Gere chaves Pix individuais para cada cliente automaticamente." },
];

const Features = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title animation
      gsap.fromTo(".features-title", 
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".features-title", start: "top 85%" }
        }
      );

      // Cards stagger animation
      gsap.fromTo(".feature-card",
        { y: 60, opacity: 0, scale: 0.95 },
        {
          y: 0, opacity: 1, scale: 1, duration: 0.6,
          stagger: { amount: 0.8, from: "start" },
          ease: "power3.out",
          scrollTrigger: { trigger: ".features-grid", start: "top 80%" },
        }
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="funcionalidades" className="py-24 md:py-32 relative">
      {/* Background accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="container">
        <div className="features-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">Funcionalidades</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Tudo que você precisa em{" "}
            <span className="text-primary relative">
              um só sistema
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C50 2 150 2 198 6" stroke="hsl(45 100% 55%)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Funcionalidades pensadas para facilitar o dia a dia do seu negócio, do caixa ao fiado.
          </p>
        </div>

        <div className="features-grid grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="feature-card group relative rounded-xl border border-border bg-card/50 backdrop-blur-sm p-6 transition-all duration-500 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
            >
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-primary/10 p-3 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20">
                  <f.icon size={22} />
                </div>
                <h3 className="font-heading font-semibold text-sm mb-2 group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
