"use client";
// ============================================================
// SEÇÃO DE PLANOS — src/components/sections/PricingSection.tsx
// Responsabilidade: Exibe os cards dos 4 planos de assinatura do MIAR AI/FOOD
// Planos exibidos: Tiozão do Hotdog, Inicial, Intermediário, Premium
// Os dados dos planos vêm de: src/lib/subscriptionPlans.ts
// ============================================================

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, X } from "lucide-react";
import Link from "next/link";
import { publicPlanList } from "@/lib/subscriptionPlans";
import { cn } from "@/lib/utils";
import { ScrollSplitCard } from "@/components/ui/scroll-split-card";

const PricingSection = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const splitCards = publicPlanList
    .filter((plan) => plan.id !== "demo")
    .map((plan) => {
      const annualPrice = plan.annualPrice ?? 0;
      const displayPrice = isAnnual ? annualPrice : plan.price;
      const periodLabel = isAnnual ? "/ano" : "/mês";
      const priceText = `R$ ${displayPrice.toLocaleString("pt-BR")}`;
      
      let bgColor = "#1e293b";
      let textColor = "#ffffff";

      if (plan.id === "tiozao" || plan.id === "fiado") {
        bgColor = "#1e293b";
        textColor = "#ffffff";
      } else if (plan.id === "inicial" || plan.id === "completo") {
        bgColor = "#0f172a";
        textColor = "#ffffff";
      } else if (plan.id === "intermediario" || plan.id === "pro") {
        bgColor = "#0b64d3";
        textColor = "#ffffff";
      } else if (plan.id === "premium") {
        bgColor = "#18181b";
        textColor = "#ffffff";
      }

      return {
        id: plan.id,
        badge: plan.badge,
        title: plan.name,
        description: plan.summary,
        price: priceText,
        originalPrice: plan.originalPrice,
        period: periodLabel,
        feedText: plan.feedText,
        features: plan.features,
        excludedFeatures: plan.excludedFeatures,
        buttonText: plan.buttonText || `Escolher ${plan.name}`,
        buttonLink: plan.ctaLink,
        bgColor,
        textColor,
      };
    });

  return (
    <section className="relative py-24 md:py-32 overflow-visible bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

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
            Escolha o melhor plano para a sua operação
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-muted-foreground"
          >
            Da operação básica até inteligência artificial, visão computacional e impulsionamento no Feed MIAR.
          </motion.p>

          {/* Toggle Mensal / Anual */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex justify-center mt-8"
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

        {/* --- DESKTOP VIEW (ScrollSplitCard com efeito fechado/aberto) --- */}
        <div className="hidden md:block w-full relative z-10 pt-10">
          <ScrollSplitCard
            cards={splitCards}
          />
        </div>

        {/* --- MOBILE VIEW --- */}
        <div className="md:hidden grid grid-cols-1 gap-6 pt-4">
          {publicPlanList.filter(p => p.id !== "demo").map((plan, idx) => {
            const annualPrice = plan.annualPrice ?? 0;
            const displayPrice = isAnnual ? annualPrice : plan.price;
            const periodLabel = isAnnual ? "/ano" : "/mês";

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={cn(
                  "relative flex flex-col p-6 rounded-3xl transition-all duration-300 border bg-card/60 backdrop-blur-sm",
                  plan.id === "intermediario" 
                    ? "border-primary/50 shadow-2xl shadow-primary/20" 
                    : "border-border/50 hover:border-border"
                )}
              >
                {plan.badge && (
                  <div className="flex justify-start mb-3">
                    <span className="bg-primary/10 text-primary text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-2xl font-bold font-heading">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{plan.summary}</p>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">
                      R$ {displayPrice.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-sm text-muted-foreground">{periodLabel}</span>
                  </div>
                  {plan.originalPrice && (
                    <span className="text-xs line-through text-muted-foreground font-medium">
                      De R$ {plan.originalPrice}/mês
                    </span>
                  )}
                </div>

                {plan.feedText && (
                  <div className="p-3 rounded-xl bg-muted/50 text-xs font-medium text-foreground mb-4">
                    {plan.feedText}
                  </div>
                )}

                <ul className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-semibold text-foreground">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.excludedFeatures?.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground/60 line-through">
                      <X size={14} className="text-red-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link 
                    href={plan.ctaLink}
                    className="flex items-center justify-center w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  >
                    {plan.buttonText || `Escolher ${plan.name}`}
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
