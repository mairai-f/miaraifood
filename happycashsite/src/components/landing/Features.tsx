import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  MessageCircle,
  Package,
  ReceiptText,
  ShoppingCart,
  Users,
} from "lucide-react";
import pdvScreenshot from "@/assets/pdv-principal-carrinho.webp";
import pagamentoScreenshot from "@/assets/pdv-finalizar-venda-pagamento.webp";
import clientesScreenshot from "@/assets/fiado-digital-clientes.webp";
import estoqueScreenshot from "@/assets/estoque-painel.webp";

gsap.registerPlugin(ScrollTrigger);

const operationalCards = [
  {
    icon: ShoppingCart,
    title: "PDV e caixa",
    desc: "Venda, carrinho, busca de produto, saida de caixa e fechamento em um fluxo direto.",
    href: "/sistema-pdv",
    image: pdvScreenshot,
    className: "lg:col-span-2",
    tone: "bg-gradient-to-br from-sky-100 via-white to-cyan-100 border-sky-200 dark:from-sky-950/40 dark:to-cyan-950/20 dark:border-sky-900/60",
  },
  {
    icon: BookOpen,
    title: "Fiado digital",
    desc: "Cliente, saldo e historico sempre visiveis para cobrar sem procurar anotacao.",
    href: "/caderneta-de-fiado-digital",
    image: clientesScreenshot,
    className: "lg:col-span-1",
    tone: "bg-gradient-to-br from-amber-100 via-white to-yellow-100 border-amber-200 dark:from-amber-950/35 dark:to-yellow-950/20 dark:border-amber-900/60",
  },
  {
    icon: Package,
    title: "Estoque com alerta",
    desc: "Entradas, saidas, minimo por produto e sinais claros quando algo precisa de reposicao.",
    href: "/controle-de-estoque",
    image: estoqueScreenshot,
    className: "lg:col-span-1",
    tone: "bg-gradient-to-br from-emerald-100 via-white to-lime-100 border-emerald-200 dark:from-emerald-950/35 dark:to-lime-950/20 dark:border-emerald-900/60",
  },
  {
    icon: ReceiptText,
    title: "Fechamento e recibos",
    desc: "Resumo simples por forma de pagamento, saidas, diferenca e envio por email.",
    image: pagamentoScreenshot,
    className: "lg:col-span-2",
    tone: "bg-gradient-to-br from-indigo-100 via-white to-blue-100 border-indigo-200 dark:from-indigo-950/35 dark:to-blue-950/20 dark:border-indigo-900/60",
  },
];

const compactFeatures = [
  { icon: Users, title: "Clientes", desc: "Base organizada com telefone, saldo e historico.", tone: "bg-rose-50 border-rose-200 dark:bg-rose-950/25 dark:border-rose-900/60" },
  { icon: BarChart3, title: "Relatorios", desc: "Resumo, DRE, margem e rankings no lugar certo.", tone: "bg-violet-50 border-violet-200 dark:bg-violet-950/25 dark:border-violet-900/60" },
  { icon: MessageCircle, title: "Cobranca pronta", desc: "Mensagem organizada para abrir no WhatsApp.", tone: "bg-green-50 border-green-200 dark:bg-green-950/25 dark:border-green-900/60" },
  { icon: BriefcaseBusiness, title: "RH e equipe", desc: "Permissoes, funcionarios e rotinas internas.", tone: "bg-orange-50 border-orange-200 dark:bg-orange-950/25 dark:border-orange-900/60" },
];

const closeRows = [
  ["Pix", "R$ 328,50"],
  ["Debito", "R$ 214,90"],
  ["Credito", "R$ 582,20"],
  ["Dinheiro", "R$ 146,00"],
];

const Features = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".features-title",
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          ease: "power3.out",
          scrollTrigger: { trigger: ".features-title", start: "top 85%" },
        },
      );

      gsap.fromTo(
        ".feature-card",
        { y: 48, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.09,
          ease: "power3.out",
          scrollTrigger: { trigger: ".features-grid", start: "top 78%" },
        },
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="funcionalidades" className="relative overflow-hidden bg-[linear-gradient(135deg,#f6fbff_0%,#eefcff_38%,#f7fff3_68%,#fff8eb_100%)] py-24 dark:bg-[linear-gradient(135deg,#061426_0%,#071a22_48%,#0f162b_100%)] md:py-32">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(31,86,165,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.045)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="container relative z-10">
        <div className="features-title mb-12 grid gap-5 lg:grid-cols-[0.78fr_1fr] lg:items-end">
          <div>
            <span className="inline-block text-sm font-semibold uppercase tracking-[0.24em] text-primary">Funcionalidades</span>
            <h2 className="mt-4 max-w-2xl font-heading text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
              Telas que parecem a rotina real do seu comercio.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground lg:justify-self-end">
            Menos cards genericos, mais operacao visivel: venda acontecendo, cliente com saldo, estoque pedindo reposicao e fechamento pronto para conferir.
          </p>
        </div>

        <div className="features-grid grid gap-4 lg:grid-cols-3">
          {operationalCards.map((item) => (
            <article
              key={item.title}
              className={`feature-card feature-hover-lift group overflow-hidden rounded-lg border shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary/45 hover:shadow-2xl hover:shadow-primary/15 ${item.tone} ${item.className}`}
            >
              <div className="grid h-full gap-4 p-4 md:grid-cols-[0.78fr_1fr]">
                <div className="flex min-h-52 flex-col justify-between gap-5">
                  <div>
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-heading text-2xl font-bold leading-tight">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.desc}</p>
                  </div>

                  {item.href ? (
                  <Link to={item.href} className="inline-flex w-fit items-center text-sm font-bold text-primary transition-transform duration-300 group-hover:translate-x-1">
                      Ver detalhe
                    </Link>
                  ) : (
                    <div className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      pronto para operacao
                    </div>
                  )}
                </div>

                <div className="screenshot-hover-frame relative min-h-52 overflow-hidden rounded-lg border border-border bg-slate-950 p-2">
                  <img
                    src={item.image}
                    alt={`HappyCash ${item.title}`}
                    className="h-full min-h-52 w-full rounded-md object-cover object-left-top opacity-95 transition-transform duration-700 group-hover:scale-[1.045]"
                    width={1440}
                    height={1200}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="feature-card feature-hover-lift rounded-lg border border-cyan-200 bg-gradient-to-br from-cyan-100 via-white to-emerald-100 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10 dark:border-cyan-900/60 dark:from-cyan-950/35 dark:to-emerald-950/20">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Fechamento simples</span>
                <h3 className="mt-2 font-heading text-2xl font-bold">Valores agrupados por forma de pagamento</h3>
              </div>
              <ReceiptText className="h-7 w-7 text-primary" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {closeRows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-border bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:bg-background/80">
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <span className="font-heading text-xl font-bold text-foreground">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <span className="font-semibold">Diferenca</span>
              <span className="font-bold">R$ 0,00</span>
            </div>
          </article>

          <div className="feature-card grid gap-4 sm:grid-cols-2">
            {compactFeatures.map((item) => (
              <article key={item.title} className={`feature-hover-lift group rounded-lg border p-5 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary/40 hover:shadow-xl ${item.tone}`}>
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-sm transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
