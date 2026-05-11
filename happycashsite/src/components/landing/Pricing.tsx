import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, Star, Zap, Monitor, Smartphone, Download } from "lucide-react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";

gsap.registerPlugin(ScrollTrigger);

const plans = [
  {
    id: "demo",
    name: "Demo Grátis",
    price: 0,
    description: "Teste o sistema completo por 12 horas",
    popular: false,
    highlight: "demo",
    features: [
      "Acesso completo por 12 horas",
      "Todas as funcionalidades",
      "Sem cartão de crédito",
      "Suporte por email",
    ],
  },
  {
    id: "fiado",
    name: "Caderneta Fiado Digital",
    price: 100,
    annualPrice: 997,
    description: "Ideal para quem vive de fiado e precisa de controle simples por 30 dias",
    popular: false,
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
    price: 189,
    annualPrice: 1887,
    description: "Gestão completa do seu negócio com ciclo de 30 dias",
    popular: true,
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
      "Notas e fiscal",
      "Pagamento da assinatura via Pix ou débito / crédito",
    ],
  },
  {
    id: "pro",
    name: "Plano PRO",
    subtitle: "Completo + App",
    price: 250,
    annualPrice: 2497,
    description: "Desktop PRO com ativação por máquina, mobile e mais segurança para a operação",
    popular: false,
    features: [
      "Plano com validade de 30 dias",
      "Tudo do Plano Completo",
      "Desktop para Windows e Linux",
      "Chave da empresa em cada máquina nova",
      "Login de operador com usuário e PIN",
      "Offline local por até 5 dias",
      "App mobile",
      "Impressão Bematech",
      "Pagamento da assinatura via Pix ou débito / crédito",
    ],
  },
];

const formatPrice = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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
    <section ref={ref} id="planos" className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="container">
        <div className="pricing-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-primary tracking-widest uppercase mb-4">Planos</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Comece grátis e escolha quando fizer sentido
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Teste por 12 horas sem cartão. Depois, escolha entre pagar a cada 30 dias ou fechar o anual direto no checkout.
          </p>
        </div>

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
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground">
            <Smartphone size={16} className="text-primary" /> Mobile (Web)
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground">
            <Monitor size={16} className="text-primary" /> Web
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-sm text-muted-foreground">
            <Download size={16} className="text-primary" /> Linux & Windows
          </div>
        </div>

        <div className="pricing-cards grid md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => {
            const isDemo = plan.highlight === "demo";
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

            return (
              <div
                key={plan.name}
                className={`pricing-card relative rounded-lg border p-8 transition-all duration-500 hover:-translate-y-2 ${
                  plan.popular
                    ? "border-primary/50 bg-gradient-to-b from-primary/15 via-primary/5 to-card shadow-2xl shadow-primary/15"
                    : isDemo
                    ? "border-secondary/50 bg-gradient-to-b from-secondary/10 to-card"
                    : "border-border bg-card/50 backdrop-blur-sm hover:border-muted-foreground/30 hover:shadow-xl"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground flex items-center gap-1 shadow-lg shadow-primary/30">
                    <Star size={12} fill="currentColor" /> MAIS POPULAR
                  </div>
                )}
                {isDemo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-5 py-1.5 text-xs font-bold text-secondary-foreground flex items-center gap-1 shadow-lg">
                    <Zap size={12} fill="currentColor" /> TESTE GRÁTIS
                  </div>
                )}
                {annualSelected && !isDemo && (
                  <div className="absolute -top-3 right-4 rounded-full border border-primary/40 bg-background px-3 py-1 text-xs font-bold text-primary shadow-lg">
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
                      <span className="font-heading text-5xl font-bold text-primary mx-1">{formatPrice(displayPrice)}</span>
                      <span className="text-muted-foreground">{periodLabel}</span>
                      {annualSelected && (
                        <p className="mt-2 text-xs font-medium text-primary">Economia de R$ {formatPrice(annualSavings)} comparado ao mensal.</p>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {(annualSelected && !isDemo ? [`Plano anual com validade de 12 meses`, ...plan.features.slice(1)] : plan.features).map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm">
                      <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary" />
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
                        plan.popular ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/30" : "bg-muted text-foreground hover:bg-muted/80"
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
