import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  QrCode,
  Scissors,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";
import { Button } from "@/components/ui/button";
import { createSiteUrl } from "@/lib/siteSeo";
import agendaBookingPreview from "@/assets/happycashagenda-booking-real.jpg";
import agendaProductsPreview from "@/assets/happycashagenda-products-real.jpg";
import agendaPublicPreview from "@/assets/happycashagenda-public-real.jpg";

gsap.registerPlugin(ScrollTrigger);

const HERO_BADGES = [
  "Agenda online",
  "Profissionais",
  "Pix com QR Code",
  "WhatsApp",
  "Pagina por empresa",
  "Relatorios",
];

const features = [
  { icon: CalendarCheck, title: "Agenda online", text: "Horarios por profissional, servico, data e disponibilidade real." },
  { icon: Users, title: "Clientes separados", text: "Cada empresa acessa apenas seus proprios clientes, agendamentos e historico." },
  { icon: Scissors, title: "Profissionais e servicos", text: "Cadastro de profissionais, comissao, duracao, preco e servicos extras." },
  { icon: QrCode, title: "Link e QR Code", text: "Compartilhe agenda.happycashsite.com.br/sua-empresa para clientes marcarem horario." },
  { icon: MessageCircle, title: "Mensagens completas", text: "Confirmacao com empresa, data, hora, valor, Pix ou pagamento no local." },
  { icon: CreditCard, title: "Assinatura no site", text: "Plano Agenda no HappyCashSite com Asaas (Pix ou cartao) e redirect automatico." },
];

const agendaScreens = [
  {
    src: agendaPublicPreview,
    title: "Pagina publica por empresa",
    text: "Logo, nome, fundo, horario de funcionamento e link proprio para cada cliente.",
  },
  {
    src: agendaBookingPreview,
    title: "Fluxo de agendamento real",
    text: "Cliente escolhe servico, profissional, dia aberto e horario disponivel.",
  },
  {
    src: agendaProductsPreview,
    title: "Produtos do modulo Agenda",
    text: "Produtos separados do PDV, com compra por Pix ou pagamento no local.",
  },
];

const agendaPlans = [
  {
    name: "HappyCash Agenda",
    price: "R$ 80",
    description: "Agenda online completa para barbearias, saloes, clinicas, pet shops e servicos com horario marcado.",
    features: [
      "Profissionais e servicos",
      "Pagina publica por slug",
      "Pix com QR no agendamento",
      "Confirmacao manual no painel",
      "WhatsApp integrado",
      "Relatorios e fila",
    ],
    href: "/cadastro?plan=agenda",
    dashboardHref: "/dashboard?plan=agenda",
    highlight: true,
  },
];

const faqs = [
  {
    question: "O HappyCash Agenda mistura produtos do PDV?",
    answer: "Nao. O Agenda usa dados separados por empresa. Produtos do PDV ficam no HappyCash e produtos do Agenda ficam no proprio modulo.",
  },
  {
    question: "Depois de pagar o plano, para onde vou?",
    answer: "O HappyCashSite confirma o pagamento no Asaas e redireciona para agenda.happycashsite.com.br com acesso liberado.",
  },
  {
    question: "O Pix do agendamento usa Asaas?",
    answer: "Nao. A assinatura do modulo e cobrada no site via Asaas. O Pix de cada agendamento gera QR Code com a chave da empresa e o administrador confirma manualmente no painel.",
  },
];

const primaryAgendaButtonStyle = {
  backgroundColor: "hsl(var(--primary))",
  borderColor: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))",
} as const;

export default function HappyCashAgenda() {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".agenda-hero-motion",
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.75, stagger: 0.08, ease: "power3.out" },
      );

      gsap.utils.toArray<HTMLElement>(".agenda-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 58, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.78,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%", toggleActions: "play none none none" },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>(".agenda-stagger").forEach((el) => {
        gsap.fromTo(
          el.children,
          { y: 44, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 84%", toggleActions: "play none none none" },
          },
        );
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen bg-background">
      <SiteSeo
        title="HappyCash Agenda | Sistema de agendamento online com Pix e pagina publica"
        description="HappyCash Agenda e o sistema de agendamento online para barbearias, saloes, clinicas e servicos, com pagina publica por empresa, horarios reais, produtos, QR Code Pix e WhatsApp."
        keywords={[
          "sistema de agendamento",
          "agenda online",
          "agenda para barbearia",
          "agenda para salao",
          "agendamento online com Pix",
          "agenda para clinica",
          "agenda para prestador de servico",
          "HappyCash Agenda",
        ]}
        path="/happycash-agenda"
        image={agendaPublicPreview}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "HappyCash Agenda",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: createSiteUrl("/happycash-agenda"),
          image: createSiteUrl(agendaPublicPreview),
          offers: {
            "@type": "Offer",
            price: "80",
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
          },
        }}
      />
      <Header />

      <main>
        <section className="relative overflow-hidden border-b pt-28 md:pt-36">
          <div className="container grid gap-10 pb-16 lg:grid-cols-[1fr_0.95fr] lg:items-center">
            <div>
              <p className="agenda-hero-motion text-sm font-bold uppercase tracking-[0.24em] text-primary">
                HappyCash Agenda
              </p>
              <h1 className="agenda-hero-motion mt-5 max-w-3xl font-heading text-4xl font-bold leading-tight md:text-6xl">
                Agenda online para servicos, profissionais e clientes no mesmo fluxo
              </h1>
              <p className="agenda-hero-motion mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Organize horarios, servicos, produtos, Pix com QR Code e WhatsApp sem misturar dados do PDV.
              </p>
              <div className="agenda-hero-motion mt-5 flex flex-wrap gap-2">
                {HERO_BADGES.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="agenda-hero-motion mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-7 text-base font-semibold">
                  <Link to="/cadastro?plan=agenda">Criar conta Agenda</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                  <Link to="/dashboard?plan=agenda">Pagar com Asaas</Link>
                </Button>
              </div>
            </div>

            <div className="agenda-hero-motion overflow-hidden rounded-lg border bg-card shadow-xl">
              <img
                src={agendaPublicPreview}
                alt="Pagina publica real do HappyCash Agenda"
                className="aspect-[16/10] w-full object-cover object-top"
              />
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="container">
            <div className="agenda-stagger grid gap-4 md:grid-cols-3">
              {features.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border bg-card p-6">
                    <Icon className="h-6 w-6 text-primary" />
                    <h2 className="mt-4 font-heading text-lg font-semibold">{item.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container">
            <div className="agenda-reveal max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">Telas reais</p>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">
                O cliente ve o sistema que vai contratar
              </h2>
              <p className="mt-4 text-muted-foreground">
                A pagina do plano mostra imagens reais do HappyCash Agenda: vitrine publica, agendamento e produtos do modulo.
              </p>
            </div>

            <div className="agenda-stagger mt-10 grid gap-6 lg:grid-cols-3">
              {agendaScreens.map((screen) => (
                <article key={screen.title} className="overflow-hidden rounded-lg border bg-card">
                  <img
                    src={screen.src}
                    alt={screen.title}
                    className="aspect-[16/10] w-full object-cover object-top"
                    loading="lazy"
                  />
                  <div className="p-5">
                    <h3 className="font-heading text-lg font-semibold">{screen.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{screen.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planos-agenda" className="py-16 md:py-20">
          <div className="container">
            <div className="agenda-reveal max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">Plano do modulo</p>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">Assine no HappyCashSite</h2>
              <p className="mt-4 text-muted-foreground">
                Pagamento via Asaas no dashboard. Depois da confirmacao, voce e redirecionado para o sistema Agenda.
              </p>
            </div>

            <div className="agenda-stagger mt-10 grid gap-6 md:grid-cols-1 lg:max-w-xl">
              {agendaPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-lg border p-6 ${plan.highlight ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="mt-2 text-3xl font-black text-primary">{plan.price}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Link
                      to={plan.href}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold"
                      style={primaryAgendaButtonStyle}
                    >
                      Criar conta <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to={plan.dashboardHref}
                      className="inline-flex h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold hover:bg-muted"
                    >
                      Ja tenho conta — pagar
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="agenda-reveal">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">Multi-empresa</p>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-4xl">
                Cada negocio com sua pagina publica
              </h2>
              <p className="mt-4 text-muted-foreground">
                Exemplo: agenda.happycashsite.com.br/barbeariadolucas com logo, fundo, servicos e profissionais do Lucas.
              </p>
            </div>
            <div className="agenda-stagger grid gap-3">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-lg border bg-card p-5">
                  <h3 className="font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
