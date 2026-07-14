import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Monitor, BookOpen, Package, Tags, Users,
  MessageCircle, BarChart3, Gift, Wallet, Key,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Monitor, title: "Frente de Caixa (PDV)", desc: "Venda com mais rapidez, acompanhe o caixa e tenha um fechamento mais organizado.", href: "/sistema-pdv" },
  { icon: BookOpen, title: "Caderneta de Fiado Digital", desc: "Controle clientes, saldo devedor e cobranças em um painel mais confiável que o caderno.", href: "/caderneta-de-fiado-digital" },
  { icon: Package, title: "Controle de Estoque", desc: "Acompanhe entradas, saídas e estoque mínimo em tempo real para evitar falta de produto.", href: "/controle-de-estoque" },
  { icon: Tags, title: "Cadastro de Produtos", desc: "Cadastre produtos com preços, códigos e categorias sem depender de planilha paralela." },
  { icon: Users, title: "Cadastro de Clientes", desc: "Organize a base de clientes e recupere histórico de compras e pagamentos com facilidade." },
  { icon: MessageCircle, title: "Cobranças via WhatsApp", desc: "Abra a cobrança com mensagem pronta direto no WhatsApp e reduza o tempo para receber." },
  { icon: BarChart3, title: "Relatórios Financeiros", desc: "Enxergue receitas, despesas e desempenho sem montar relatório manual todo dia." },
  { icon: Gift, title: "Programa de Fidelidade", desc: "Recompense clientes frequentes e aumente a recorrência de compra na loja." },
  { icon: Wallet, title: "Pix, Boleto, Crédito e Débito", desc: "Aceite os principais meios de pagamento e mantenha o histórico da operação centralizado." },
  { icon: Key, title: "Usuário e PIN offline", desc: "No plano PRO, o primeiro login online vincula a máquina ao administrador, baixa os dados da loja e libera admin/operador com usuário e PIN ou senha local." },
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
            Tudo que você precisa para{" "}
            <span className="text-primary relative">
              parar de improvisar
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none">
                <path d="M2 6C50 2 150 2 198 6" stroke="hsl(190 78% 45%)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Fiado, PDV, estoque, clientes e relatórios organizados em um sistema feito para a rotina real da loja.
          </p>
        </div>

        <div className="features-grid grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {features.map((f) => (
            <article
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
                {f.href ? (
                  <Link to={f.href} className="mt-4 inline-flex text-xs font-semibold text-primary">
                    Saiba mais
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
