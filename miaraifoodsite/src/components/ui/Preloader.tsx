'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import GhostFibers from './GhostFibers';

export interface PreloaderProps {
  className?: string;
  onComplete?: () => void;
  storageKey?: string;
}

export function Preloader({ className, onComplete, storageKey = 'miar_site_preloader_seen' }: PreloaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress counter animation from 0% to 100%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 12) + 5;
        return next > 100 ? 100 : next;
      });
    }, 70);

    // Sequence of steps for MIAR AI/FOOD AI
    // Step 0: Big 'M' enters
    // Step 1: 'MIAR' completes
    // Step 2: 'MIAR AI/FOOD'
    // Step 3: 'MIAR AI/FOOD AI'
    // Step 4: Exit & Complete

    const timer1 = setTimeout(() => setStep(1), 500);
    const timer2 = setTimeout(() => setStep(2), 1100);
    const timer3 = setTimeout(() => setStep(3), 1700);
    const timer4 = setTimeout(() => {
      setStep(4);
      setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 600);
    }, 2400);

    return () => {
      clearInterval(interval);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <AnimatePresence mode="wait">
      {step < 4 && (
        <motion.div
          key="miar-preloader"
          initial={{ opacity: 1 }}
          exit={{ y: '-100%', transition: { duration: 0.8, ease: [0.77, 0, 0.175, 1] } }}
          className={cn(
            'fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-[#050b14] text-white p-8 overflow-hidden select-none',
            className
          )}
        >
          {/* Background Shader */}
          <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
            <GhostFibers
              lineColor="#06100A"
              glowColor="#70E000"
              speed={0.25}
              scale={2}
              rotation={0}
              layers={4}
              brightness={2}
            />
          </div>

          {/* Top Tagline */}
          <div className="relative z-10 w-full flex justify-between items-center text-xs font-mono tracking-[0.3em] text-zinc-500 uppercase">
            <span className="text-[#70E000] font-bold">MIAR AI/FOOD</span>
            <span>2026 — ECOSSISTEMA</span>
          </div>

          {/* Center Text Animation Sequence */}
          <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
            {/* Big M Entrance */}
            <div className="relative flex items-center justify-center font-black tracking-tighter leading-none">
              {step === 0 && (
                <motion.span
                  initial={{ scale: 2.5, opacity: 0, filter: 'blur(20px)' }}
                  animate={{ scale: 1.8, opacity: 1, filter: 'blur(0px)' }}
                  exit={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="text-[clamp(6rem,22vw,18rem)] text-[#70E000] drop-shadow-[0_0_40px_rgba(112,224,0,0.6)]"
                >
                  M
                </motion.span>
              )}

              {step >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center"
                >
                  <span className="text-[clamp(3.5rem,12vw,9rem)] font-black text-white leading-none">
                    <span className="text-[#70E000] text-[1.15em] inline-block mr-0.5">M</span>
                    IAR
                  </span>

                  {step >= 2 && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[clamp(1.8rem,6vw,4.5rem)] font-extrabold text-[#70E000] tracking-widest mt-2 drop-shadow-[0_0_25px_rgba(112,224,0,0.4)]"
                    >
                      AI/FOOD
                    </motion.span>
                  )}

                  {step >= 3 && (
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs sm:text-sm md:text-base font-mono font-bold tracking-[0.4em] text-zinc-400 uppercase mt-4"
                    >
                      TECNOLOGIA & OPERAÇÃO IA
                    </motion.span>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom Progress Bar & Percentage */}
          <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">CARREGANDO EXPERIÊNCIA</span>
              <span className="text-[#70E000] font-bold">{progress}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#006400] to-[#70E000]"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Preloader;
