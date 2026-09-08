import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Crown, Zap, Monitor, Smartphone, Download } from "lucide-react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";
import { FiscalResponsibilityNotice } from "@/components/FiscalResponsibilityNotice";
import { commercialPaidPlanPricing } from "../../../../shared/subscriptionPlanPricing";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    id: "demo",
    name: "Demo Grátis",
    price: 0,
    description: "Teste o sistema completo por 3 dias",
    highlight: "demo",
    features: [
      "Acesso completo por 3 dias",
      "Todas as funcionalidades",
      "Sem cartão de crédito",
      "Suporte por email",
    ],
  },
  {
    id: "fiado",
    name: "Caderneta Fiado Digital",
    price: commercialPaidPlanPricing.fiado.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.fiado.annualPrice,
    description: "Ideal para quem vive de fiado e precisa de controle simples por 30 dias",
    features: [
      "Plano com validade de 30 dias",
      "Painel inicial",
      "Clientes",
      "Produtos",
      "Excluídos",
      "Fiado e cobranças",
      "Pagamento da assinatura via Pix ou débito / crédito",
    ],
  },
  {
    id: "completo",
    name: "Plano Completo",
    subtitle: "PDV + Fiado",
    price: commercialPaidPlanPricing.completo.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.completo.annualPrice,
    description: "Gestão completa do seu negócio com ciclo de 30 dias",
    features: [
      "Plano com validade de 30 dias",
      "Tudo do Plano Fiado",
      "Frente de Caixa (PDV)",
      "Controle de estoque",
      "Cadastro de produtos",
      "Módulo de precificação inteligente",
      "Programa de fidelidade",
      "Relatórios e financeiro",
      "Configurações da loja",
      "Pagamento da assinatura via Pix ou débito / crédito",
    ],
  },
  {
    id: "pro",
    name: "Plano PRO",
    subtitle: "Completo + App",
    price: commercialPaidPlanPricing.pro.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.pro.annualPrice,
    description: "Desktop PRO, Android e contingência offline de 24 horas para a operação",
    features: [
      "Plano com validade de 30 dias",
      "Tudo do Plano Completo",
      "Desktop para Windows e Linux",
      "Chave da empresa em cada máquina nova",
      "Login de operador com usuário e PIN",
      "Offline local por até 24 horas",
      "App Android",
      "Impressão Bematech",
      "Modulo Fiscal NFC-e opcional somente no Desktop PRO",
      "Pagamento da assinatura via Pix ou débito / crédito",
    ],
  },
];

const formatPrice = (value: number) => {
  const hasDecimals = !Number.isInteger(value);
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
};

const Pricing = () => {
  const ref = useRef<HTMLElement>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");
  const { isAuthenticated } = useAuthSession();
  const { showTestButton, testHref } = useLandingAccountActions();
  const annualSelected = billingPeriod === "annual";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".pricing-title",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".pricing-title", start: "top 85%" }
        }
      );
      gsap.fromTo(".pricing-card",
        { y: 80, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, stagger: 0.15, ease: "back.out(1.2)",
          scrollTrigger: { trigger: ".pricing-cards", start: "top 80%" }
        }
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="planos" className="relative overflow-hidden bg-gradient-to-b from-background via-[#eef8ff] to-background py-24 dark:via-[#0b1a32] md:py-32">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="container">
        <div className="pricing-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">Planos</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Comece grátis e escolha quando fizer sentido
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Teste por 3 dias sem cartão. Depois, escolha entre pagar a cada 30 dias ou fechar o anual direto no checkout.
          </p>
        </div>

        <FiscalResponsibilityNotice className="mx-auto mb-10 max-w-3xl" />

        <div className="mb-8 flex justify-center">
          <div className="grid w-full max-w-sm grid-cols-2 rounded-lg border border-border bg-card/60 p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                !annualSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                annualSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anual
            </button>
          </div>
        </div>

        {/* Platform badges */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-100">
            <Smartphone size={16} className="text-primary" /> Mobile (Web)
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/50 dark:text-cyan-100">
            <Monitor size={16} className="text-primary" /> Web
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100">
            <Download size={16} className="text-primary" /> Linux & Windows
          </div>
        </div>

        <div className="pricing-cards grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isDemo = plan.highlight === "demo";
            const isPro = plan.id === "pro";
            const annualPrice = plan.annualPrice ?? 0;
            const displayPrice = annualSelected && !isDemo ? annualPrice : plan.price;
            const periodLabel = annualSelected && !isDemo ? "/ano" : "/30 dias";
            const annualSavings = Math.max(0, plan.price * 12 - annualPrice);
            const planHref = annualSelected
              ? `/dashboard?plan=${plan.id}&period=annual`
              : `/dashboard?plan=${plan.id}`;
            const signupHref = annualSelected
              ? `/cadastro?plan=${plan.id}&period=annual`
              : `/cadastro?plan=${plan.id}`;

            const planToneClass = isPro
              ? "border-primary/70 bg-gradient-to-b from-primary/25 via-cyan-100/60 to-card shadow-2xl shadow-primary/20 ring-1 ring-primary/25 hover:border-primary hover:shadow-primary/30 dark:via-cyan-950/30"
              : isDemo
                ? "border-emerald-300 bg-gradient-to-b from-emerald-100 via-lime-50 to-card hover:border-emerald-400 hover:shadow-emerald-500/20 dark:border-emerald-900/70 dark:from-emerald-950/60 dark:via-lime-950/20"
                : plan.id === "fiado"
                  ? "border-cyan-200 bg-gradient-to-b from-cyan-100 via-sky-50 to-card hover:border-cyan-400 hover:shadow-cyan-500/20 dark:border-cyan-900/70 dark:from-cyan-950/60 dark:via-sky-950/25"
                  : "border-indigo-200 bg-gradient-to-b from-indigo-100 via-blue-50 to-card hover:border-indigo-400 hover:shadow-indigo-500/20 dark:border-indigo-900/70 dark:from-indigo-950/60 dark:via-blue-950/25";

            return (
              <div
                key={plan.name}
                className={`pricing-card plan-hover-glow group relative isolate flex h-full flex-col overflow-hidden rounded-lg border p-6 transition-all duration-500 hover:-translate-y-3 hover:scale-[1.018] hover:shadow-2xl ${planToneClass}`}
              >
                {isPro && (
                  <div className="absolute -top-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-primary/30 bg-primary px-4 py-1.5 text-xs font-bold uppercase text-primary-foreground shadow-lg shadow-primary/30">
                    <Crown size={14} fill="currentColor" className="drop-shadow-sm" /> Mais assinado
                  </div>
                )}
                {isDemo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-5 py-1.5 text-xs font-bold text-secondary-foreground flex items-center gap-1 shadow-lg">
                    <Zap size={12} fill="currentColor" /> TESTE GRÁTIS
                  </div>
                )}
                {annualSelected && !isDemo && (
                  <div className={`absolute right-4 rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-bold text-primary shadow-lg ${isPro ? "top-5" : "-top-3"}`}>
                    Economize R$ {formatPrice(annualSavings)}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-heading text-xl font-bold">{plan.name}</h3>
                  {plan.subtitle && <span className="text-sm text-secondary font-medium">{plan.subtitle}</span>}
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {isDemo ? (
                    <span className="font-heading text-5xl font-bold text-secondary">Grátis</span>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground align-top">R$</span>
                      <span className={`font-heading text-4xl font-bold mx-1 2xl:text-5xl ${isPro ? "text-primary" : "text-foreground"}`}>{formatPrice(displayPrice)}</span>
                      <span className="text-muted-foreground">{periodLabel}</span>
                      {annualSelected && (
                        <p className="mt-2 text-xs font-medium text-primary">Economia de R$ {formatPrice(annualSavings)} comparado ao mensal.</p>
                      )}
                    </>
                  )}
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {(annualSelected && !isDemo ? [`Plano anual com validade de 12 meses`, ...plan.features.slice(1)] : plan.features).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <div className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${isPro ? "bg-primary" : "bg-primary/20"}`}>
                        <Check className={`h-3 w-3 ${isPro ? "text-primary-foreground" : "text-primary"}`} />
                      </div>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-col gap-3">
                  {isDemo ? (
                    showTestButton ? (
                      <Button asChild className="w-full font-semibold h-12 text-base bg-secondary text-secondary-foreground hover:bg-secondary/90" size="lg">
                        <Link to={isAuthenticated ? testHref : `/cadastro?plan=${plan.id}`}>Testar grátis agora</Link>
                      </Button>
                    ) : null
                  ) : (
                    <>
                      <Button asChild className={`w-full font-semibold h-12 text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                        isPro ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/30" : "bg-muted text-foreground hover:bg-muted/80"
                      }`} size="lg">
                        {isAuthenticated ? (
                          <Link to={planHref}>{annualSelected ? "Abrir checkout anual" : "Abrir no Painel"}</Link>
                        ) : (
                          <Link to={signupHref}>Criar conta e assinar</Link>
                        )}
                      </Button>
                      {!annualSelected && (
                        <Button asChild variant="outline" className="w-full font-semibold h-12 text-base" size="lg">
                          <Link to={`/dashboard?plan=${plan.id}&period=annual`}>Ver anual</Link>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
