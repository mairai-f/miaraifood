// ============================================================
// SEÇÃO DE PLANOS — src/components/sections/PricingSection.tsx
// Responsabilidade: Exibe os cards de planos de assinatura do HappyCash
// Usado em: src/app/page.tsx (página inicial) e src/app/planos/page.tsx
// Planos exibidos: Demo (grátis 3 dias), Completo (mensal/anual), PRO (mensal/anual)
// Os dados dos planos (preço, features) vêm de: src/lib/subscriptionPlans.ts
// ============================================================

import React, { useState } from "react";
import { motion } from "framer-motion"; // Animações de entrada (fade + slide) ao rolar a página
import { Check, Crown, Zap } from "lucide-react"; // Ícones dos badges e checkmarks
import Link from "next/link";
import { publicPlanList } from "@/lib/subscriptionPlans"; // Lista de planos públicos (sem dados sensíveis)
import { Meteors } from "@/components/ui/meteors"; // Efeito visual de meteoros no card PRO
import { cn } from "@/lib/utils"; // Utilitário para mesclar classes CSS condicionalmente

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section className="relative py-24 md:py-32 overflow-hidden bg-background">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block py-1 px-3 rounded-full bg-primary/10 text-primary text-sm font-semibold tracking-wider uppercase mb-4"
          >
            Planos e Preços
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-foreground"
          >
            Comece grátis e escolha o melhor para o seu negócio
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Teste o HappyCash completo por 3 dias sem compromisso. Depois, escolha a assinatura que melhor atende à sua operação, com pagamento prático via Pix ou Cartão.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-center gap-3 mt-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 max-w-xl mx-auto"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-red-500 font-bold text-xl leading-none">A</span>
            </div>
            <div className="text-left">
              <h4 className="text-sm font-bold text-foreground">Não sabe instalar sistemas? Deixe com a gente!</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Nossa equipe configura seu caixa e balança à distância via <strong>AnyDesk</strong>. É rápido, seguro e sem dor de cabeça.</p>
            </div>
          </motion.div>

          {/* Toggle Mensal / Anual */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-10"
          >
            <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-full border border-border/50">
              <button
                onClick={() => setIsAnnual(false)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300",
                  !isAnnual ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mensal
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300",
                  isAnnual ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Anual <span className="ml-1 text-primary text-xs">-20%</span>
              </button>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8 max-w-6xl mx-auto items-start pt-4">
          {publicPlanList.filter(p => p.id !== "demo").map((plan, idx) => {
            const isDemo = plan.id === "demo";
            const isPro = plan.id === "pro";
            
            // Calculate display price based on toggle
            const annualPrice = plan.annualPrice ?? 0;
            const displayPrice = (isAnnual && !isDemo) ? annualPrice : plan.price;
            const periodLabel = (isAnnual && !isDemo) ? "/ano" : "/mês";
            const annualSavings = Math.max(0, plan.price * 12 - annualPrice);

            // Plan URL logic
            const planUrl = (isAnnual && !isDemo) ? `/cadastro?plan=${plan.id}&period=annual` : `/cadastro?plan=${plan.id}`;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={cn(
                  "relative flex flex-col p-6 rounded-3xl transition-all duration-300",
                  "border bg-card/40 backdrop-blur-sm",
                  isPro 
                    ? "border-primary/50 shadow-2xl shadow-primary/20 md:scale-105 md:z-10" 
                    : "border-border/50 hover:border-border hover:shadow-xl hover:-translate-y-1"
                )}
              >
                {/* Meteors + gradient inside its own overflow-hidden container */}
                {isPro && (
                  <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                    <Meteors number={15} />
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
                  </div>
                )}

                {/* Badges — inside flow, not translated above card */}
                {isPro && (
                  <div className="flex justify-end mb-4 relative z-10">
                    <span className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      <Crown size={12} /> MAIS ASSINADO
                    </span>
                  </div>
                )}
                {isDemo && (
                  <div className="flex justify-end mb-4 relative z-10">
                    <span className="flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      <Zap size={12} /> GRÁTIS
                    </span>
                  </div>
                )}

                <div className="mb-6 relative z-10">
                  <h3 className="text-xl font-bold font-heading">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2 h-10">{plan.summary}</p>
                </div>

                <div className="mb-6 relative z-10">
                  {isDemo ? (
                    <div className="text-4xl font-bold font-heading text-secondary h-12 flex items-center">Grátis</div>
                  ) : (
                    <div className="flex items-baseline gap-1 h-12">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-4xl font-bold font-heading text-foreground">
                        {displayPrice.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                      </span>
                      <span className="text-sm text-muted-foreground">{periodLabel}</span>
                    </div>
                  )}
                  {isAnnual && !isDemo && (
                    <p className="text-xs text-primary font-medium mt-2 h-4">
                      Economize R$ {annualSavings.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    </p>
                  )}
                  {(!isAnnual || isDemo) && <div className="h-4 mt-2" />}
                </div>

                <ul className="flex-1 space-y-3 mb-8 relative z-10">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <div className={cn(
                        "mt-0.5 rounded-full p-1 shrink-0",
                        isPro ? "bg-primary/20 text-primary" : "bg-muted text-foreground"
                      )}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative z-10 mt-auto">
                  <Link 
                    href={planUrl}
                    className={cn(
                      "flex items-center justify-center w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300",
                      isPro 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25" 
                        : isDemo
                        ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-lg"
                        : "bg-muted text-foreground hover:bg-foreground hover:text-background"
                    )}
                  >
                    {isDemo ? "Testar Grátis" : "Assinar Plano"}
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
