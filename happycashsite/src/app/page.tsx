// ============================================================
// PÁGINA INICIAL DO SITE INSTITUCIONAL — src/app/page.tsx
// Responsabilidade: Monta a página principal (/) com todas as seções animadas
// Ordem das seções: Hero → Expertise → About (módulos) → Pricing → Stats → CTA
// ============================================================

'use client'; // Necessário para usar hooks React e interatividade no Next.js App Router

// --- Imports de bibliotecas React e Next.js ---
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic'; // Carregamento dinâmico (lazy load) para componentes pesados
import { motion, useScroll, useTransform, AnimatePresence, useSpring, useMotionValue, useMotionTemplate } from 'framer-motion'; // Animações
import { useTranslations } from 'next-intl'; // Internacionalização (textos em pt.json)
import Link from 'next/link';
import { gsap } from 'gsap'; // Biblioteca de animação usada em efeitos de scroll
import { ScrollTrigger } from 'gsap/ScrollTrigger'; // Plugin que dispara animações baseado na posição do scroll
import { useIsMobile } from "@/hooks/useIsMobile"; // Hook que detecta se o dispositivo é mobile

// --- Ícones (Lucide React) ---
import { Sparkles, Mail, ArrowRight, ArrowDown } from 'lucide-react';

// --- Componentes internos ---
import { LoadingScreen } from '@/components/layout'; // Tela de carregamento inicial (animação de entrada)
import { TextPressure } from '@/components/ui/TextPressure'; // Texto com efeito de pressão ao hover
import { portfolioData } from '@/data/portfolio'; // Dados de conteúdo (textos, links, imagens)
import { cn } from "@/lib/utils"; // Utilitário para mesclar classes CSS condicionalmente
import { SocialCorner } from '@/components/layout/SocialCorner'; // Botões flutuantes de redes sociais
import { DeferredMount } from '@/components/ui/DeferredMount'; // Atrasa a montagem de componentes pesados

// --- Registro do GSAP ScrollTrigger apenas no browser (não no servidor Next.js) ---
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true }); // Evita re-cálculos desnecessários no mobile
}

// --- Componentes carregados de forma lazy (só quando necessário, melhora performance) ---
const Hyperspeed = dynamic(() => import('@/components/ui/Hyperspeed'), { ssr: false });
const { hyperspeedPresets } = require('@/components/ui/Hyperspeed');

// Scene3D: Cena 3D opcional que aparece no fundo do hero (desativada no mobile)
const Scene3D = dynamic(() => import('@/components/three/Scene3D').then(mod => ({ default: mod.Scene3D })), {
    ssr: false,
    loading: () => null // Não exibe nada enquanto carrega
});

// --- Seções da página ---
import AboutSection from "@/components/sections/AboutSection"; // Seção com módulos e animações de scroll
import ExpertiseSection from "@/components/sections/ExpertiseSection"; // Seção de recursos/diferenciais
import { HeroVisual } from "@/components/sections/HeroVisual"; // Seção Hero (banner principal com CTA)
import StatsSection from "@/components/sections/StatsSection"; // Métricas e estatísticas da plataforma
import CTASection from "@/components/sections/CTASection"; // Chamada para ação (botão de cadastro/contato)
import { usePreloadState } from "@/components/ui/arc-preloader-hero"; // Estado da animação de pré-carregamento

import PricingSection from "@/components/sections/PricingSection"; // Cards de planos (Demo, Completo, PRO)

// ─── Componente: MetricCTAHijack ─────────────────────────────────────────────
// Responsabilidade: Renderiza as métricas e o CTA de forma diferente no desktop e mobile.
// No desktop: usa scroll "sticky" (o slider fica fixo enquanto o CTA aparece por cima).
// No mobile: fluxo normal, sem efeito sticky (evita bugs de posicionamento).
const MetricCTAHijack = () => {
    return (
        <>
            {/* Métricas da parte superior (aparecem em ambos desktop e mobile) */}
            <StatsSection showOnly="top" />
            
            {/* Desktop: efeito de scroll com camada sticky */}
            <section className="relative hidden md:block">
                {/* Camada 1: Slider fixo enquanto o usuário rola */}
                <div className="sticky top-0 z-0 overflow-hidden">
                    <StatsSection showOnly="bottom" />
                </div>

                {/* Camada 2: CTA que aparece por cima do slider ao rolar */}
                <div className="relative z-20 bg-background dark:bg-black">
                    {/* Sombra no topo para suavizar a transição visual */}
                    <div className="absolute top-0 left-0 w-full h-10 dark:shadow-[0_-50px_150px_rgba(0,0,0,0.8)] -z-10" />

                    <div className="h-[10vh]" /> {/* Espaçamento */}
                    <CTASection />
                    <div className="h-20" />
                </div>
            </section>

            {/* Mobile: fluxo vertical simples sem sticky */}
            <section className="block md:hidden flex flex-col w-full relative z-20 bg-background dark:bg-black">
                <div className="w-full relative z-0">
                    <StatsSection showOnly="bottom" />
                </div>
                <div className="w-full relative z-20">
                    <div className="h-10" />
                    <CTASection />
                    <div className="h-16" />
                </div>
            </section>
        </>
    );
};

// ─── Componente Principal: HomePage ──────────────────────────────────────────
// Responsabilidade: Controla o estado de carregamento da página e monta todas as seções
export default function HomePage() {
    // Estado do pré-carregador animado (arc preloader)
    const { phase } = usePreloadState();

    // Estado que controla se a tela de loading inicial está visível
    const [isLoading, setIsLoading] = useState(false);

    // Estado que indica se a animação de saída do loading começou
    const [isInitialLoadingExit, setIsInitialLoadingExit] = useState(true);

    // Se o usuário já visitou a página antes (salvo em sessionStorage), pula a animação de entrada
    const [skipAnimation, setSkipAnimation] = useState(true);

    useEffect(() => {
        // Verifica se a página já foi carregada nesta sessão do navegador
        const hasLoaded = sessionStorage.getItem('portfolioLoaded');
        if (hasLoaded) {
            setSkipAnimation(true); // Pula animação na segunda visita
            setIsLoading(false);
        }

        if (typeof window === 'undefined') return;
        
        // Limpeza: destrói todos os ScrollTriggers ao desmontar o componente
        return () => {
            ScrollTrigger.getAll().forEach(t => t.kill());
        };
    }, []);

    // Define se o conteúdo está pronto para ser animado (aparece na tela)
    // Considera tanto o loading inicial quanto o arc preloader
    const isReadyToAnimate = isLoading ? isInitialLoadingExit : (phase === "reveal" || phase === "done");

    useEffect(() => {
        if (isReadyToAnimate) {
            // Aguarda a transição de entrada terminar antes de recalcular os ScrollTriggers
            const timer = setTimeout(() => {
                ScrollTrigger.refresh();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isReadyToAnimate]);

    // Chamado quando a LoadingScreen termina sua animação de saída
    const handleLoadingComplete = () => {
        setIsLoading(false);
        window.scrollTo({ top: 0, behavior: 'instant' }); // Garante que começa do topo
        sessionStorage.setItem('portfolioLoaded', 'true'); // Marca que já carregou
        setTimeout(() => { ScrollTrigger.refresh(); }, 100);
    };

    // Chamado quando a animação de saída do loading começa (antes de terminar)
    const handleExitStart = () => {
        setIsInitialLoadingExit(true);
    };

    return (
        <>
            {/* Tela de loading animada — só aparece na primeira visita */}
            {isLoading && <LoadingScreen onComplete={handleLoadingComplete} onExitStart={handleExitStart} duration={2500} />}

            {/* Container principal animado (fade-in + slide-up na entrada) */}
            <motion.main
                initial={skipAnimation ? false : { opacity: 0, y: 40 }}
                animate={skipAnimation ? { opacity: 1, y: 0 } : (isReadyToAnimate ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 })}
                transition={{
                    duration: skipAnimation ? 0 : 1.4,
                    ease: skipAnimation ? "linear" : [0.16, 1, 0.3, 1], // Curva suave (expo out)
                    opacity: { duration: skipAnimation ? 0 : 0.8 }
                }}
                className="relative overflow-x-clip will-change-transform will-change-opacity"
            >
                {/* 1. Seção Hero — banner principal com animação de partículas */}
                <HeroVisual isExiting={isReadyToAnimate} />

                {/* DeferredMount: só monta os filhos após a animação inicial terminar
                    Melhora performance percebida (não bloqueia o LCP do Hero) */}
                <DeferredMount>
                    {/* 2. Seção de Recursos/Diferenciais */}
                    <ExpertiseSection />

                    {/* 3. Seção Sobre — módulos do ERP com animações de scroll */}
                    <AboutSection />

                    {/* 4. Seção de Planos — cards com preços (Demo, Completo, PRO) */}
                    <PricingSection />

                    {/* 5. Métricas + CTA — estatísticas e botão de chamada para ação */}
                    <MetricCTAHijack />

                    {/* Botões flutuantes de redes sociais (Instagram, WhatsApp) */}
                    <SocialCorner className="fixed bottom-12 right-12 z-[30]" />
                </DeferredMount>
            </motion.main>
        </>
    );
}
