import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cloud,
  Fingerprint,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";

import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/pdv-principal-carrinho.webp";

const modules = [
  {
    title: "Pessoas e estrutura",
    icon: UsersRound,
    items: ["Funcionários", "Empresas e unidades", "Cargos e departamentos", "CBO", "Histórico profissional"],
  },
  {
    title: "Ponto, jornada e férias",
    icon: Fingerprint,
    items: ["Ponto web/app/tablet", "Importação REP", "Banco de horas", "Escalas flexíveis", "Férias e afastamentos"],
  },
  {
    title: "Folha e holerites",
    icon: ReceiptText,
    items: ["Folha mensal", "Eventos e rubricas", "Encargos", "TRCT", "13º salário", "Holerite em PDF"],
  },
  {
    title: "Obrigações legais",
    icon: Landmark,
    items: ["eSocial", "RAIS", "DIRF", "CAGED", "Informe de rendimentos", "Protocolos e rejeições"],
  },
  {
    title: "SST e documentos",
    icon: Stethoscope,
    items: ["PGR", "PCMSO", "ASO", "EPI", "CIPA", "CAT", "Contratos e assinatura"],
  },
  {
    title: "Talentos e performance",
    icon: Workflow,
    items: ["Recrutamento", "Caça-talentos", "Treinamentos", "Metas", "PDI", "Feedback 360"],
  },
  {
    title: "Inteligência e relatórios",
    icon: Bot,
    items: ["Chat IA", "Tabela cruzada", "Relatórios personalizados", "Indicadores", "Alertas inteligentes"],
  },
  {
    title: "Segurança Enterprise",
    icon: LockKeyhole,
    items: ["Multiempresa", "Permissões granulares", "LGPD", "Backups", "Auditoria", "API"],
  },
];

const operations = [
  "bar",
  "adega",
  "padaria",
  "mercado",
  "restaurante",
  "lanchonete",
  "farmácia",
  "loja de roupas",
  "distribuidora",
  "oficina",
  "hotel",
  "escritório",
];

const differentiators = [
  "Motor de regras legais versionado por competência",
  "Conferência humana antes de fechamento e envio legal",
  "Banco dedicado para dados sensíveis de RH",
  "Fila de eSocial com XML, protocolo, recibo, rejeição e retificação",
  "Assistente IA para análise, simulação e inconsistências",
  "Portal do colaborador e portal do gestor",
];

const pricingPlans = [
  {
    name: "Start",
    price: "R$ 149/mês",
    description: "Para empresas começando o RH digital.",
    includes: ["Até 20 colaboradores", "Cadastro completo", "Ponto, férias e documentos", "Holerites e relatórios básicos"],
  },
  {
    name: "Pro",
    price: "R$ 299/mês",
    description: "Para operação com DP mais ativo.",
    includes: ["Até 60 colaboradores", "Folha e holerites", "eSocial em fila de eventos", "Benefícios, SST e auditoria"],
    highlight: true,
  },
  {
    name: "Business",
    price: "R$ 499/mês",
    description: "Para várias equipes, setores e unidades.",
    includes: ["Até 150 colaboradores", "Portal gestor e colaborador", "Relatórios inteligentes", "Recrutamento e treinamentos"],
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "Para médio e grande porte com implantação.",
    includes: ["Volume personalizado", "Integrações e API", "Regras avançadas", "Suporte e implantação assistida"],
  },
];

const timeline = [
  "Cadastro completo com empresas, unidades, cargos, colaboradores, permissões e documentos.",
  "Rotina diária com ponto, escalas, férias, atestados, benefícios e portal do colaborador.",
  "Departamento pessoal com rubricas, folha, holerites, rescisão, 13º e informe.",
  "Obrigações legais com eSocial, RAIS, DIRF, CAGED, SST, recibos, rejeições e auditoria.",
  "Inteligência com IA, relatórios cruzados, previsões, anomalias e integrações.",
];

const HappyCashRhEnterprise = () => {
  const [operationIndex, setOperationIndex] = useState(0);
  const operationName = operations[operationIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setOperationIndex((current) => (current + 1) % operations.length);
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <SiteSeo
        title="HappyCash RH Enterprise | Folha, holerite, ponto e eSocial"
        description="HappyCash RH Enterprise é um produto completo de recursos humanos e departamento pessoal com folha, holerites, ponto, férias, SST, eSocial, IA, LGPD e relatórios avançados."
        path="/happycash-rh-enterprise"
        image={heroImage}
        keywords={[
          "HappyCash RH Enterprise",
          "sistema de RH completo",
          "software de RH com folha",
          "sistema de folha de pagamento",
          "sistema de holerite online",
          "sistema de ponto eletrônico",
          "software eSocial",
          "gestão de departamento pessoal",
          "sistema de recursos humanos",
          "SST PGR PCMSO ASO EPI",
          "TRCT rescisão contratual",
          "13 salário sistema",
          "RAIS DIRF CAGED",
          "chat IA para RH",
          "sistema RH enterprise",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCash RH Enterprise",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url: "https://www.happycashsite.com.br/happycash-rh-enterprise",
            description:
              "Sistema completo de RH, departamento pessoal, folha, holerite, ponto, SST, eSocial, LGPD, IA e relatórios para empresas brasileiras.",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "O HappyCash RH Enterprise terá folha e eSocial?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Sim. A proposta Enterprise inclui folha, holerites, rubricas, encargos, eSocial, recibos, rejeições, retificações e auditoria por competência.",
                },
              },
              {
                "@type": "Question",
                name: "O RH Enterprise protege dados sensíveis?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Sim. Dados sensíveis de RH, folha, documentos e SST ficam em ambiente dedicado com permissões, auditoria e governança de LGPD.",
                },
              },
            ],
          },
        ]}
      />
      <Header />

      <main>
        <section className="relative min-h-[92svh] overflow-hidden pt-28 md:pt-32">
          <div className="absolute inset-0 bg-[#eef4fb]" />
          <div className="absolute inset-0 z-[1] bg-gradient-to-r from-background via-background/95 to-background/20" />
          <div className="absolute inset-x-0 top-0 h-full opacity-80 max-md:hidden">
            <div className="absolute left-[64%] top-24 h-[720px] w-[min(980px,76vw)] -translate-x-1/2 rounded-[8px] border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
              <div className="grid h-full grid-cols-[230px_minmax(0,1fr)] overflow-hidden rounded-[8px]">
                <div className="border-r border-border bg-background/92 p-5">
                  <span className="text-xs font-black uppercase tracking-[0.24em] text-primary">RH Enterprise</span>
                  <div className="mt-8 grid gap-2">
                    {["Painel", "Colaboradores", "Ponto", "Folha", "eSocial", "SST"].map((item, index) => (
                      <div key={item} className={`h-10 rounded-md px-3 py-2 text-sm font-semibold ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      ["Colaboradores", "342"],
                      ["Folha", "07/2026"],
                      ["eSocial", "S-1.3"],
                      ["Alertas", "18"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-background p-4">
                        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                        <strong className="mt-3 block text-2xl text-foreground">{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.75fr]">
                    <div className="rounded-md border border-border bg-background p-5">
                      <div className="h-4 w-44 rounded bg-primary/20" />
                      <div className="mt-5 grid gap-3">
                        {[82, 66, 74, 48, 90].map((width) => (
                          <div key={width} className="h-9 rounded bg-muted">
                            <div className="h-full rounded bg-secondary/30" style={{ width: `${width}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-5">
                      <div className="h-4 w-36 rounded bg-primary/20" />
                      <div className="mt-6 grid gap-2">
                        {[1, 2, 3, 4, 5].map((item) => (
                          <div key={item} className="flex items-center gap-3 rounded-md border border-border p-3">
                            <div className="h-8 w-8 rounded bg-secondary/25" />
                            <div className="h-3 flex-1 rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container relative z-10 flex min-h-[calc(92svh-8rem)] items-end pb-14">
            <div className="max-w-4xl pb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/85 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-primary shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Produto Enterprise
              </span>
              <h1 className="mt-6 max-w-4xl font-heading text-5xl font-black leading-[0.95] text-foreground md:text-7xl">
                HappyCash RH Enterprise
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                Para melhor atender sua operação de <strong className="font-black text-primary">{operationName}</strong>: RH completo com folha, holerites, ponto, férias, SST, eSocial, IA, relatórios inteligentes, auditoria e proteção de dados sensíveis.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-14 px-7 text-base font-bold">
                  <a href="mailto:happycashsupport@gmail.com">
                    Solicitar demonstração <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-7 text-base font-bold">
                  <a href="#recursos">Ver recursos</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="py-20 md:py-24">
          <div className="container">
            <div className="max-w-3xl">
              <span className="text-sm font-black uppercase tracking-[0.24em] text-primary">Recursos</span>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-5xl">Tudo que entra no RH completo</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                A base cobre RH operacional, departamento pessoal, inteligência e obrigações legais. A folha e o eSocial entram com conferência, versionamento e auditoria.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.title} className="rounded-[8px] border border-border bg-card p-5 shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-heading text-xl font-semibold">{module.title}</h3>
                    <ul className="mt-4 space-y-2">
                      {module.items.map((item) => (
                        <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-secondary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/35 py-20 md:py-24">
          <div className="container grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <span className="text-sm font-black uppercase tracking-[0.24em] text-primary">Mais que cadastro</span>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-5xl">Inteligência, tecnologia e segurança de produto sério</h2>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                O diferencial não é só ter telas. É ter motor de regras, validação, filas, recibos, logs, permissões e IA ajudando a encontrar erro antes de virar problema trabalhista.
              </p>
            </div>
            <div className="grid gap-3">
              {differentiators.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[8px] border border-border bg-background p-4">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <span className="font-semibold text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="precos" className="py-20 md:py-24">
          <div className="container">
            <div className="max-w-3xl">
              <span className="text-sm font-black uppercase tracking-[0.24em] text-primary">Planos</span>
              <h2 className="mt-4 font-heading text-3xl font-bold md:text-5xl">Preços para RH de verdade</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Planos pensados para operações pequenas, médias e grandes: bar, adega, padaria, mercado, restaurante, farmácia, loja, distribuidora, oficina e equipes administrativas.
              </p>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {pricingPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-[8px] border bg-card p-6 shadow-lg shadow-black/5 transition-all duration-300 hover:-translate-y-1 ${
                    plan.highlight ? "border-primary ring-2 ring-primary/15" : "border-border"
                  }`}
                >
                  {plan.highlight ? (
                    <span className="mb-4 inline-flex rounded-full bg-primary px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary-foreground">
                      Mais indicado
                    </span>
                  ) : null}
                  <h3 className="font-heading text-2xl font-bold">{plan.name}</h3>
                  <strong className="mt-4 block text-3xl text-primary">{plan.price}</strong>
                  <p className="mt-3 min-h-14 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 space-y-2">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-secondary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="operacao" className="py-20 md:py-24">
          <div className="container">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <span className="text-sm font-black uppercase tracking-[0.24em] text-primary">Operação</span>
                <h2 className="mt-4 font-heading text-3xl font-bold md:text-5xl">Fluxo completo para RH e departamento pessoal</h2>
              </div>
              <div className="grid gap-4">
                {timeline.map((item, index) => (
                  <article key={item} className="grid gap-4 rounded-[8px] border border-border bg-card p-5 shadow-lg shadow-black/5 sm:grid-cols-[auto_1fr]">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-primary text-base font-black text-primary-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="self-center text-base font-semibold leading-7 text-foreground">{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="pb-24 md:pb-28">
          <div className="container">
            <div className="rounded-[8px] border border-primary/20 bg-primary px-6 py-10 text-primary-foreground shadow-2xl shadow-primary/20 md:px-10 md:py-14">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.2em]">
                    <Cloud className="h-4 w-4" />
                    RH em nuvem
                  </div>
                  <h2 className="mt-5 font-heading text-3xl font-bold md:text-5xl">Uma plataforma de RH para empresas que precisam de controle real.</h2>
                  <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">
                    Cadastre colaboradores, acompanhe ponto, gere folha, libere holerites, envie obrigações legais e acompanhe tudo com relatórios e auditoria.
                  </p>
                </div>
                <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-base font-bold">
                  <a href="mailto:happycashsupport@gmail.com">
                    Solicitar apresentação
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HappyCashRhEnterprise;
