'use client';

import React, { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, useSpring, useMotionValue } from 'framer-motion';
import { cn } from "@/lib/utils";
import { HoverScrambleText } from '@/components/ui/hover-scramble-text';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from "@/hooks/useIsMobile";
import Link from 'next/link';

const pages = [
    {
        content: {
            heading: 'Venda melhor.',
            description: 'Uma plataforma completa para centralizar vendas, atendimento, estoque, financeiro e operação em um único sistema. O MIAR AI/FOOD conecta as principais áreas do negócio para dar mais controle, agilidade e visão da empresa.',
            skills: ["PDV e Caixa", "Controle de Estoque", "Gestão de Produtos", "Controle de Vendas", "Relatórios Gerenciais"],
            hoverColor: "bg-green-400/10",
            cta: { label: 'Conhecer o MIAR', href: '/cadastro' },
        }
    },
    {
        content: {
            heading: 'Faça parte da rede de entregadores',
            description: 'Conecte-se a oportunidades de entrega de forma simples, organizada e integrada aos estabelecimentos da plataforma do ecossistema MIAR.',
            skills: ["Chamados de Entrega", "Acompanhamento de Rotas", "Histórico de Corridas", "Controle de Ganhos", "Disponibilidade Online"],
            hoverColor: "bg-green-500/10",
            cta: { label: 'Quero ser Entregador', href: '/entregador' },
        }
    },
    {
        content: {
            heading: 'Torne-se um representante MIAR',
            description: 'Leve nossa tecnologia para novos negócios e acompanhe suas indicações, clientes e oportunidades em um único ambiente.',
            skills: ["Indicações de Empresas", "Carteira de Clientes", "Acompanhamento Comercial", "Comissões e Resultados", "Painel do Representante"],
            hoverColor: "bg-green-600/10",
            cta: { label: 'Quero ser Representante', href: '/representante' },
        }
    },
    {
        isBridge: true,
        heading: 'Descubra recursos criados para conectar processos e tornar sua operação mais eficiente.',
        subheading: 'EXPLORE ROLANDO PARA BAIXO !',
    }
];

export default function ScrollAdventure() {
    const [currentPage, setCurrentPage] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        mass: 0.1,
        restDelta: 0.001
    });

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        const totalPages = pages.length;
        const step = 1 / totalPages;
        const index = Math.min(Math.floor(latest / step) + 1, totalPages);
        if (currentPage !== index) setCurrentPage(index);
    });

    const { scrollYProgress: enterProgressRaw } = useScroll({
        target: containerRef,
        offset: ["start end", "start start"]
    });

    const enterProgress = useSpring(enterProgressRaw, { stiffness: 100, damping: 30, restDelta: 0.001 });

    const enterScale = useTransform(enterProgress, [0, 1], [0.85, 1]);
    const enterOpacity = useTransform(enterProgress, [0, 1], [0, 1]);
    const enterBorderRadius = useTransform(enterProgress, [0, 1], ["40px", "0px"]);

    return (
        <>
            {/* Desktop View (Scroll Parallax) */}
            <div ref={containerRef} className="relative hidden md:block h-[250vh] md:h-[800vh] w-full pointer-events-none">
                <motion.div
                    style={{ scale: enterScale, opacity: enterOpacity, borderRadius: enterBorderRadius }}
                    className="sticky top-0 h-screen w-full overflow-hidden bg-background dark:bg-black pointer-events-auto origin-center"
                >
                    {pages.map((page, i) => {
                        if ('isBridge' in page) {
                            return (
                                <BridgeSlide
                                    key={i}
                                    page={page}
                                    isActive={currentPage === i + 1}
                                    scrollProgress={smoothProgress}
                                    index={i}
                                />
                            );
                        }
                        return (
                            <PageSlide
                                key={i}
                                page={page}
                                isActive={currentPage === i + 1}
                                scrollProgress={smoothProgress}
                                index={i}
                            />
                        );
                    })}
                </motion.div>
            </div>

            {/* Mobile View (Static Cards) */}
            <div className="md:hidden flex flex-col gap-8 px-4 py-16 bg-background dark:bg-black w-full overflow-hidden">
                {pages.map((page: any, i: number) => {
                    if ('isBridge' in page) {
                        return (
                            <div key={i} className="py-12 flex flex-col items-center text-center px-4">
                                <h2 className="text-3xl font-medium tracking-tight text-foreground dark:text-white leading-[1.2] mb-6">
                                    {page.heading}
                                </h2>
                                <span className="text-[10px] font-mono font-bold tracking-[0.5em] uppercase text-foreground/50 dark:text-white/50">
                                    {page.subheading}
                                </span>
                            </div>
                        );
                    }

                    const content = page.content;
                    if (!content) return null;

                    return (
                        <div key={i} className="flex flex-col bg-foreground/[0.02] dark:bg-white/[0.02] border border-foreground/5 rounded-3xl p-6 md:p-8 gap-6 overflow-hidden items-center text-center">
                            <div className="flex items-center gap-4 w-full justify-center">
                                <span className="text-[10px] font-mono font-black tracking-[0.3em] text-primary uppercase">
                                    0{i + 1}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground leading-tight">
                                {content.heading}
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {content.description}
                            </p>
                            {content.skills && (
                                <div className="flex flex-wrap justify-center gap-2 mt-2">
                                    {content.skills.map((skill: string) => (
                                        <div key={skill} className="px-3 py-1.5 rounded-md bg-foreground/5 border border-foreground/10 text-[10px] font-bold uppercase tracking-wider text-foreground/70">
                                            {skill}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {content.cta && (
                                <Link href={content.cta.href} className="mt-4 w-full">
                                    <button className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl tracking-tight">
                                        {content.cta.label}
                                    </button>
                                </Link>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function PageSlide({ page, isActive, scrollProgress, index }: { page: any, isActive: boolean, scrollProgress: any, index: number }) {
    const totalPages = pages.length;
    const step = 1 / totalPages;
    const base = index * step;

    let enterStart = index === 0 ? -0.1 : base - step / 4;
    let enterEnd = index === 0 ? -0.05 : base + step / 4;
    let exitStart = base + step * 0.75;
    let exitEnd = base + step * 1.25;

    if (index === 0) {
        exitStart = 0.125;
        exitEnd = 0.3125;
    } else if (index === 1) {
        enterStart = 0.125;
        enterEnd = 0.3125;
    }

    const y = useTransform(
        scrollProgress,
        [enterStart, enterEnd, exitStart, exitEnd],
        ["120%", "0%", "0%", "120%"]
    );

    const zIndex = useTransform(
        scrollProgress,
        [enterStart, enterEnd, exitStart, exitEnd],
        [10, 20, 20, 10]
    );

    return (
        <motion.div style={{ zIndex }} className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 md:p-8 lg:p-12">
            <div className="relative w-full h-full max-w-[1000px] flex pointer-events-auto">
                <motion.div
                    style={{ y }}
                    className={cn("relative w-full h-full bg-background dark:bg-black z-10 overflow-hidden rounded-3xl")}
                >
                    <div className="w-full h-full flex items-center justify-center p-8 md:p-16 lg:p-24 relative group">
                        <motion.div
                            className={cn("absolute inset-0 z-0", page.content?.hoverColor || "bg-primary/5")}
                            initial={{ height: 0 }}
                            whileHover={{ height: '100%' }}
                            transition={{ duration: 0.4 }}
                        />
                        {page.content && <EditorialContent content={page.content} index={index} />}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

function BridgeSlide({ page, isActive, scrollProgress, index }: { page: any, isActive: boolean, scrollProgress: any, index: number }) {
    const step = 1 / pages.length;
    const base = index * step;

    const opacity = useTransform(scrollProgress, [base - step / 4, base + step / 4, 0.98, 1], [0, 1, 1, 0]);
    const y = useTransform(scrollProgress, [base - step / 4, base + step / 4, 0.98, 1], [50, 0, 0, -50]);

    return (
        <motion.div
            style={{ opacity, zIndex: 30 }}
            className={cn(
                "absolute inset-0 bg-background dark:bg-black flex flex-col items-center justify-center p-12 text-center",
                isActive ? "pointer-events-auto" : "pointer-events-none"
            )}
        >
            <motion.div style={{ y }} className="space-y-16 max-w-[1200px] w-full px-[5%]">
                <h2 className="text-4xl md:text-5xl lg:text-7xl font-medium tracking-tight text-foreground dark:text-white leading-[1.1] font-sans">
                    <HoverScrambleText text={page.heading} />
                </h2>
                <div className="flex flex-col items-center gap-6 opacity-30 pt-10">
                    <span className="text-[11px] font-mono font-bold tracking-[0.5em] uppercase text-foreground dark:text-white">
                        {page.subheading}
                    </span>
                    <motion.div
                        animate={{ y: [0, 8, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <ChevronDown className="w-6 h-6 text-foreground dark:text-white" />
                    </motion.div>
                </div>
            </motion.div>
        </motion.div>
    );
}

function EditorialContent({ content, index }: { content: any, index: number }) {
    return (
        <div className="flex flex-col items-center text-center space-y-12 max-w-2xl w-full relative z-10">
            <div className="space-y-6 flex flex-col items-center">
                <div className="flex flex-col items-center gap-6">
                    <span className="text-[11px] font-mono font-black tracking-[0.5em] text-primary uppercase opacity-60">
                        SOLUÇÃO — 0{index + 1}
                    </span>
                    <div className="h-[1px] w-12 bg-primary/20" />
                </div>
                <h2 className="py-2 text-4xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tighter leading-tight text-foreground font-sans transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:text-foreground/50 pointer-events-auto cursor-default origin-center">
                    {content.heading}
                </h2>
                <p className="text-xl md:text-2xl text-muted-foreground font-medium leading-tight max-w-lg">
                    {content.description}
                </p>
            </div>
            {content.skills && (
                <div className="flex flex-wrap justify-center gap-4 pt-6">
                    {content.skills.map((skill: string, idx: number) => (
                        <MagneticTag key={skill} text={skill} index={idx} />
                    ))}
                </div>
            )}
            {content.cta && (
                <div className="pt-8 pointer-events-auto">
                    <Link href={content.cta.href}>
                        <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-xl tracking-tight"
                        >
                            {content.cta.label}
                        </motion.button>
                    </Link>
                </div>
            )}
        </div>
    );
}

function MagneticTag({ text, index }: { text: string, index: number }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
    const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

    const colors = [
        { main: "bg-emerald-500", textHover: "group-hover/badge:text-white" },
        { main: "bg-blue-500", textHover: "group-hover/badge:text-white" },
        { main: "bg-violet-500", textHover: "group-hover/badge:text-white" },
        { main: "bg-rose-500", textHover: "group-hover/badge:text-white" },
        { main: "bg-amber-500", textHover: "group-hover/badge:text-black" },
        { main: "bg-cyan-500", textHover: "group-hover/badge:text-black" }
    ];
    const color = colors[index % colors.length];

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set((e.clientX - centerX) * 0.4);
        y.set((e.clientY - centerY) * 0.4);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="relative cursor-pointer p-2 -m-2 pointer-events-auto"
        >
            <motion.div
                style={{ x: springX, y: springY }}
                className="group/badge relative overflow-hidden text-[10px] md:text-[11px] font-extrabold uppercase tracking-widest text-black dark:text-white border border-foreground/10 px-8 py-4 rounded-xl bg-foreground/[0.02] backdrop-blur-xl hover:border-transparent transition-colors duration-300"
            >
                <div className={cn("absolute inset-0 translate-y-[101%] group-hover/badge:translate-y-0 transition-transform duration-300 ease-out z-0", color.main)} />
                <span className={cn("relative z-10 transition-colors duration-300", color.textHover)}>{text}</span>
            </motion.div>
        </div>
    );
}
