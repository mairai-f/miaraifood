'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, ArrowUpRight, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuLink {
  label: string;
  href: string;
  description?: string;
  isExternal?: boolean;
}

export interface MenuGroup {
  title: string;
  variant?: 'default' | 'muted';
  links: MenuLink[];
}

export interface MenuButton {
  label: string;
  href: string;
}

export interface FloatingMenuClasses {
  root?: string;
  overlay?: string;
  header?: string;
  toggleButton?: string;
  logo?: string;
  actions?: string;
  primaryButton?: string;
  secondaryButton?: string;
  menuWrapper?: string;
  grid?: string;
  group?: string;
  groupMuted?: string;
  groupTitle?: string;
  link?: string;
  linkText?: string;
}

export interface FloatingMenuProps {
  menuGroups?: MenuGroup[];
  logo?: React.ReactNode;
  primaryButton?: MenuButton;
  secondaryButton?: MenuButton;
  className?: string;
  classes?: FloatingMenuClasses;
}

export function FloatingMenu({
  menuGroups = [
    {
      title: 'Plataforma',
      variant: 'default',
      links: [
        { label: 'Início', href: '/' },
        { label: 'Recursos', href: '/recursos' },
        { label: 'Funcionalidades', href: '/funcionalidades' },
        { label: 'Telas do Sistema', href: '/telas' },
      ],
    },
    {
      title: 'Empresa & Conteúdos',
      variant: 'muted',
      links: [
        { label: 'Sobre Nós', href: '/sobre' },
        { label: 'Planos & Preços', href: '/planos' },
        { label: 'Blog & Conteúdos', href: '/conteudos' },
        { label: 'Central de Ajuda', href: '/central-de-ajuda' },
      ],
    },
    {
      title: 'Acesso Rápido',
      variant: 'default',
      links: [
        { label: 'Entrar no Sistema', href: '/login' },
        { label: 'Criar Conta (1 Mês Grátis)', href: '/cadastro' },
        { label: 'Suporte WhatsApp', href: 'https://wa.me/5511999999999', isExternal: true },
      ],
    },
  ],
  primaryButton = { label: '1 Mês Grátis', href: '/cadastro' },
  secondaryButton = { label: 'Entrar', href: '/login' },
  className,
  classes = {},
}: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const pathname = usePathname();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    if (isOpen) return; // never hide while menu is open
    const direction = latest > lastScrollY.current ? 'down' : 'up';
    if (direction === 'down' && latest > 80) {
      setIsNavVisible(false);
    } else {
      setIsNavVisible(true);
    }
    lastScrollY.current = latest;
  });

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleMenu = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* Centering wrapper — never touched by framer-motion */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100]">
        <motion.div
          animate={{
            y: isNavVisible ? 0 : -90,
            opacity: isNavVisible ? 1 : 0,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
          className={cn(
            'flex w-[calc(100vw-16px)] items-center justify-between gap-1 rounded-full bg-[#081220]/95 p-1.5 px-2 border border-[#70E000]/40 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] transition-[border-color] duration-300 hover:border-[#70E000] sm:w-auto sm:gap-4 sm:p-2 sm:px-5',
            className,
            classes.root
          )}
        >
          {/* Left Side: Entrar / Minha Conta */}
          {secondaryButton && (
            <Link
              href={secondaryButton.href}
              className={cn(
                'min-w-0 max-w-[76px] truncate px-1 text-[10px] font-extrabold text-zinc-200 hover:text-[#70E000] transition-colors whitespace-nowrap sm:max-w-none sm:px-2 sm:text-sm',
                classes.secondaryButton
              )}
            >
              {secondaryButton.label}
            </Link>
          )}

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Center: Enlarged Miafavicon (Menu Trigger Button) */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
            title="Clique para abrir o menu completo"
            className={cn(
              'group relative flex shrink-0 items-center justify-center p-1.5 rounded-full hover:scale-110 active:scale-95 transition-all duration-300 mx-0.5 sm:mx-1 sm:p-2',
              isOpen ? 'bg-[#70E000] shadow-[0_0_25px_rgba(112,224,0,0.9)]' : 'bg-white/5 hover:bg-[#70E000]/20',
              classes.toggleButton
            )}
          >
            <img
              src="/miar-collapsed-icon-white.svg"
              alt="MIAR Icon"
              className={cn(
                'h-7 w-auto object-contain transition-all duration-300 sm:h-10',
                isOpen ? 'brightness-0' : 'group-hover:drop-shadow-[0_0_15px_rgba(112,224,0,0.8)]'
              )}
            />
          </button>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Right Side: 1 Mês Grátis Button */}
          {primaryButton && (
            <Link
              href={primaryButton.href}
              className={cn(
                'shrink-0 px-2 py-1.5 text-[10px] font-black rounded-full bg-[#70E000] text-black hover:bg-[#9EF01A] transition-all duration-300 flex items-center gap-1 shadow-[0_0_20px_rgba(112,224,0,0.5)] whitespace-nowrap sm:px-4 sm:py-2 sm:gap-1.5 sm:text-sm',
                classes.primaryButton
              )}
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              {primaryButton.label}
            </Link>
          )}
        </motion.div>
      </div>


      {/* Floating Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'fixed inset-0 z-[95] bg-[#050b14]/95 backdrop-blur-2xl flex flex-col justify-between p-3 sm:p-6 md:p-12 overflow-y-auto pt-24 sm:pt-28',
              classes.overlay
            )}
          >
            {/* Header in Overlay */}
            <div className={cn('flex items-center justify-between gap-2 max-w-7xl mx-auto w-full pb-5 sm:pb-8 border-b border-white/10', classes.header)}>
              <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3">
                <img src="/miar-logo-white.svg" alt="MIAR Logo" className="h-6 w-auto max-w-[42vw] object-contain sm:h-8" />
              </Link>

              <div className="flex items-center gap-1 sm:gap-3">
                {secondaryButton && (
                  <Link
                    href={secondaryButton.href}
                    onClick={() => setIsOpen(false)}
                    className="hidden px-5 py-2.5 text-xs font-bold text-zinc-300 hover:text-white rounded-full bg-white/5 border border-white/10 transition sm:block"
                  >
                    {secondaryButton.label}
                  </Link>
                )}
                {primaryButton && (
                  <Link
                    href={primaryButton.href}
                    onClick={() => setIsOpen(false)}
                    className="px-2.5 py-2 text-[10px] font-extrabold rounded-full bg-[#70E000] text-black hover:bg-[#9EF01A] transition shadow-[0_0_20px_rgba(112,224,0,0.5)] flex items-center gap-1.5 sm:px-5 sm:py-2.5 sm:text-xs"
                  >
                    <Zap className="hidden h-3.5 w-3.5 fill-black sm:block" />
                    {primaryButton.label}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 rounded-full bg-white/10 text-white hover:bg-[#70E000] hover:text-black transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Menu Groups Grid */}
            <div className={cn('max-w-7xl mx-auto w-full my-auto py-10', classes.menuWrapper)}>
              <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8', classes.grid)}>
                {menuGroups.map((group, gIdx) => (
                  <motion.div
                    key={group.title}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: gIdx * 0.1 }}
                    className={cn(
                      'p-6 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all duration-300 hover:border-[#70E000]/40',
                      group.variant === 'muted'
                        ? 'bg-[#081220]/80 border-white/10'
                        : 'bg-[#0c192c]/90 border-[#006400]/30 shadow-2xl',
                      classes.group,
                      group.variant === 'muted' && classes.groupMuted
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
                        <span
                          className={cn(
                            'text-xs font-mono font-bold tracking-[0.2em] uppercase text-[#70E000]',
                            classes.groupTitle
                          )}
                        >
                          {group.title}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">0{gIdx + 1}</span>
                      </div>

                      <ul className="space-y-4">
                        {group.links.map((link) => (
                          <li key={link.label}>
                            <Link
                              href={link.href}
                              target={link.isExternal ? '_blank' : undefined}
                              rel={link.isExternal ? 'noopener noreferrer' : undefined}
                              onClick={() => setIsOpen(false)}
                              className={cn(
                                'group flex items-center justify-between text-lg font-bold text-zinc-300 hover:text-white transition-all duration-200',
                                pathname === link.href && 'text-[#70E000]',
                                classes.link
                              )}
                            >
                              <span className={cn('group-hover:translate-x-1.5 transition-transform duration-200', classes.linkText)}>
                                {link.label}
                              </span>
                              {link.isExternal ? (
                                <ArrowUpRight className="w-4 h-4 text-[#70E000] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#70E000] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer Information */}
            <div className="max-w-7xl mx-auto w-full pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
              <span>MIAR AI/FOOD — ECOSSISTEMA DE GESTÃO PARA RESTAURANTES</span>
              <span className="text-[#70E000]">1 MÊS GRÁTIS DEPOIS PAGA O PLANO ESCOLHIDO</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default FloatingMenu;
