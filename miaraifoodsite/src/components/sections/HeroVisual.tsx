import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Github, Linkedin, Instagram, ArrowDown, ArrowDownRight, Bot, Zap, ExternalLink, MessageSquare } from 'lucide-react';
import { portfolioData } from "@/data/portfolio";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import gsap from "gsap";
import { ProfileCard } from "@/components/ui/profile-card";
import { Spotlight } from "@/components/ui/spotlight-new";
import { LetterCascade } from "@/components/ui/LetterCascade";
import GhostFibers from "@/components/ui/GhostFibers";

export function HeroVisual({ isExiting = false }: { isExiting?: boolean }) {
  const { personal } = portfolioData;

  const [tooltip, setTooltip] = useState<{ show: boolean; text: string; x: number; y: number; icon: 'zap' | 'bot' | null }>({
    show: false,
    text: '',
    x: 0,
    y: 0,
    icon: null
  });

  const githubRef = useRef(null);
  const linkedinRef = useRef(null);
  const instagramRef = useRef(null);
  const zapRef = useRef(null);
  const zapSmallRef = useRef(null);
  const botRef = useRef(null);

  useEffect(() => {
    if (!isExiting) return;

    const ctx = gsap.context(() => {
      // Reveal + Loop for GitHub
      gsap.fromTo(githubRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          onComplete: () => {
            gsap.to(githubRef.current, {
              y: -10,
              duration: 2,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              force3D: true
            });
          }
        }
      );

      // Reveal + Loop for LinkedIn
      gsap.fromTo(linkedinRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          delay: 0.1,
          ease: "power3.out",
          onComplete: () => {
            gsap.to(linkedinRef.current, {
              y: 10,
              duration: 2.5,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              force3D: true
            });
          }
        }
      );

      // Reveal + Loop for Instagram
      gsap.fromTo(instagramRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          delay: 0.2,
          ease: "power3.out",
          onComplete: () => {
            gsap.to(instagramRef.current, {
              x: 10,
              duration: 3,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              force3D: true
            });
          }
        }
      );

      // Zap pulsing - Energetic heartbeat effect
      gsap.to([zapRef.current, zapSmallRef.current], {
        scale: 1.2,
        duration: 0.6,
        repeat: -1,
        yoyo: true,
        ease: "power2.inOut",
        force3D: true
      });

      // Bot floating - Responsive and smooth
      gsap.to(botRef.current, {
        rotation: 8,
        y: -10,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        force3D: true
      });
    });

    return () => ctx.revert();
  }, [isExiting]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative min-h-screen w-full flex flex-col bg-background text-foreground overflow-hidden selection:bg-primary/20"
    >
      {/* Background Shader */}
      <div className="w-full absolute h-full z-0 opacity-45 pointer-events-none overflow-hidden">
        <GhostFibers
          lineColor="#06100A"
          glowColor="#70E000"
          speed={0.2}
          scale={2}
          rotation={0}
          rotationSpeed={0.25}
          layers={4}
          waveAmplitude={0.015}
          waveFrequency={3}
          waveSpeed={0.15}
          layerSpeed={0.08}
          twist={0.1}
          twistFrequency={5}
          twistSpeed={1.2}
          lineFrequency={5}
          lineSpacing={2}
          lineSharpness={16}
          glowFalloff={10}
          glowIntensity={1.6}
          brightness={2}
          blueBoost={1.25}
          vignette={0.8}
          grain={0.05}
          dpr={1}
        />
      </div>

      {/* Spotlight Effect - Dramatic lighting */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden hidden md:block">
        <Spotlight
          duration={10}
          xOffset={120}
          translateY={-300}
          gradientFirst="radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(0, 0%, 100%, .15) 0, hsla(0, 0%, 100%, .05) 50%, transparent 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, hsla(0, 0%, 100%, .1) 0, hsla(0, 0%, 100%, .02) 80%, transparent 100%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, hsla(0, 0%, 100%, .08) 0, hsla(0, 0%, 100%, 0) 80%, transparent 100%)"
        />
      </div>

      <main className="relative flex-1 flex flex-col justify-center pt-40 pb-20 z-10 max-w-[105rem] w-full mx-auto">
        <div className="flex relative gap-4 px-6 md:items-center w-full flex-col justify-center">

          {/* Follow-Cursor Tooltip */}
          <AnimatePresence>
            {tooltip.show && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed pointer-events-none z-[100] hidden md:flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold px-4 py-2.5 rounded-full shadow-2xl"
                style={{
                  left: tooltip.x,
                  top: tooltip.y,
                  x: "-50%",
                  y: "-150%", // offset slightly above the cursor
                }}
              >
                {tooltip.icon === 'zap' && <ExternalLink className="w-4 h-4" />}
                {tooltip.icon === 'bot' && <MessageSquare className="w-4 h-4" />}
                <span className="text-sm">{tooltip.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Line 1: AI & DATA */}
          <div className="md:flex gap-8 items-center relative">
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-[10px] md:text-xs text-muted-foreground text-start md:text-right leading-relaxed max-w-[200px] md:max-w-[220px] font-medium uppercase tracking-[0.2em]"
            >
              Tecnologia para restaurantes que querem conectar atendimento, operação e gestão em um só ecossistema.
            </motion.p>
            <div className="relative">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(3rem,11vw,13rem)] font-black leading-[0.85] tracking-tighter text-white drop-shadow-md will-change-transform px-4"
              >
                <LetterCascade text="SOFTWARE" stiffness={350} damping={8} staggerDuration={0.06} />
              </motion.h1>
            </div>
          </div>

          {/* Line 2: SOFT [ICON] WARE */}
          <div className="md:flex gap-8 items-center relative">
            <div className="relative">
              <div ref={instagramRef} className="absolute -bottom-12 right-24 md:right-36 text-primary/60 hover:text-primary z-20 opacity-0">
                <a
                  href={personal.socialLinks.find(s => s.platform === 'Instagram')?.url}
                  target="_blank"
                  className="block"
                >
                  <Instagram size={32} />
                </a>
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-[clamp(3rem,11vw,13rem)] md:flex items-center font-black leading-[0.85] tracking-tighter text-white drop-shadow-md will-change-transform px-4"
              >
                <LetterCascade text="MIAR" stiffness={350} damping={8} staggerDuration={0.06} />
                <div
                  ref={zapRef}
                  className="hidden lg:inline-flex items-center mx-[0.1em] relative cursor-pointer group"
                  onClick={() => window.open('/cadastro?plan=demo', '_self')}
                  onMouseEnter={(e) => setTooltip({ show: true, text: "teste grátis ", icon: 'zap', x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                  onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                >
                  <img
                    src="/miar-collapsed-icon-white.svg"
                    alt="MIAR Logo"
                    className="w-[0.85em] h-[0.85em] inline-block object-contain group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_rgba(112,224,0,0.6)] transition-all duration-300"
                  />
                </div>
                <div
                  ref={zapSmallRef}
                  className="inline-flex lg:hidden items-center mx-[0.05em] relative cursor-pointer group"
                  onClick={() => window.open('/cadastro?plan=demo', '_self')}
                  onMouseEnter={(e) => setTooltip({ show: true, text: "teste grátis ", icon: 'zap', x: e.clientX, y: e.clientY })}
                  onMouseMove={(e) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                  onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
                >
                  <img
                    src="/miar-collapsed-icon-white.svg"
                    alt="MIAR Logo"
                    className="w-[0.85em] h-[0.85em] inline-block object-contain group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_rgba(112,224,0,0.6)] transition-all duration-300"
                  />
                </div>
                <LetterCascade text="AI/FOOD" stiffness={350} damping={8} staggerDuration={0.06} />
              </motion.h1>
            </div>
          </div>

          {/* Line 3: EN [ICON] GINEER */}
          <div className="md:flex gap-8 items-center relative">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(3rem,11vw,13rem)] md:flex items-center font-black leading-[0.85] tracking-tighter text-white drop-shadow-md will-change-transform px-4"
            >
              <LetterCascade text="ECOSSISTEMA" stiffness={350} damping={8} staggerDuration={0.06} />
              <div
                ref={botRef}
                className="mx-[0.1em] relative cursor-pointer group inline-flex items-center"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  window.dispatchEvent(new CustomEvent('portfolio:toggle-chatbot', {
                    detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                  }));
                }}
                onMouseEnter={(e) => setTooltip({ show: true, text: "Atendente IA MIAR", icon: 'bot', x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY }))}
                onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
              >
                <div className="w-[0.85em] h-[0.85em] rounded-full overflow-hidden border-2 border-[#70E000] shadow-[0_0_15px_rgba(112,224,0,0.5)] group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(112,224,0,0.8)] transition-all duration-300 relative inline-block align-middle">
                  <img
                    src="/miarai.webp"
                    alt="Assistente Virtual IA MIAR"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
              </div>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-[10px] md:text-xs text-muted-foreground pt-4 md:pt-8 leading-relaxed max-w-[250px] md:max-w-[200px] font-medium uppercase tracking-widest"
            >
              Um ecossistema completo para conectar atendimento, operação e gestão.
            </motion.p>
          </div>
        </div>

        {/* Separator Section */}
        <div className="mx-auto max-w-[105rem] w-full px-8 md:px-20 mt-12 md:mt-24">
          <div className="flex items-center gap-6">
            <Separator className="flex-1 h-[1px] bg-foreground/10 hidden md:block" />
            <div className="text-[10px] md:text-xs whitespace-nowrap font-bold tracking-[0.3em] text-muted-foreground uppercase">
          MIAR AI/FOOD BRASIL — 2026
            </div>
            <Link
              href="/central-de-ajuda"
              className="group flex items-center"
            >
              <motion.div
                className="relative flex items-center bg-zinc-100 dark:bg-white h-12 w-12 group-hover:w-44 rounded-full transition-all duration-500 ease-[0.23,1,0.32,1] overflow-hidden shadow-xl"
              >
                <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:delay-150 text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-black pl-6 pr-12">
                  Saiba mais !
                </span>
                <div className="absolute right-0 flex items-center justify-center size-12 text-zinc-900 dark:text-black group-hover:rotate-45 transition-transform duration-500">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </main>


    </motion.div>
  );
}
