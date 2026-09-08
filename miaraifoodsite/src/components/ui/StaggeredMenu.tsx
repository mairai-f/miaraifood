'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { X, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  ariaLabel?: string;
  link: string;
}

export interface SocialItem {
  label: string;
  link: string;
}

export interface StaggeredMenuProps {
  position?: 'right' | 'left';
  items: MenuItem[];
  socialItems?: SocialItem[];
  displaySocials?: boolean;
  displayItemNumbering?: boolean;
  menuButtonColor?: string;
  openMenuButtonColor?: string;
  changeMenuColorOnOpen?: boolean;
  colors?: string[];
  logoUrl?: string;
  accentColor?: string;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function StaggeredMenu({
  position = 'right',
  items,
  socialItems = [],
  displaySocials = true,
  displayItemNumbering = true,
  colors = ['#0c192c', '#050b14'],
  logoUrl = '/miar-logo-white.svg',
  accentColor = '#70E000',
  isOpen,
  onClose,
}: StaggeredMenuProps) {
  // Container variant with staggered children
  const overlayVariants = {
    closed: {
      opacity: 0,
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1,
        when: 'afterChildren',
        duration: 0.3,
      },
    },
    open: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
        duration: 0.3,
      },
    },
  };

  const panelVariants = {
    closed: {
      x: position === 'right' ? '100%' : '-100%',
      transition: { duration: 0.4, ease: [0.77, 0, 0.175, 1] },
    },
    open: {
      x: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const itemVariants = {
    closed: {
      y: 40,
      opacity: 0,
      transition: { duration: 0.2, ease: 'easeIn' },
    },
    open: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="closed"
          animate="open"
          exit="closed"
          variants={overlayVariants}
          className="fixed inset-0 z-[100] lg:hidden flex flex-col justify-between overflow-hidden bg-black/60 backdrop-blur-xl"
        >
          {/* Background Decorative Stagger Layer */}
          <motion.div
            variants={panelVariants}
            className="absolute inset-0 bg-[#050b14] text-white flex flex-col justify-between p-6 md:p-12 z-0 border-l border-[#006400]/40 shadow-2xl"
            style={{
              backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(112, 224, 0, 0.08) 0%, transparent 50%)',
            }}
          >
            {/* Top Bar: Logo & Close */}
            <div className="flex items-center justify-between z-10 w-full pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="MIAR Logo" className="h-8 w-auto object-contain" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-3 rounded-full bg-white/10 hover:bg-[#70E000] hover:text-black text-white transition-all duration-300"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu Items List */}
            <div className="my-auto py-8 z-10">
              <nav className="flex flex-col gap-5 md:gap-7">
                {items.map((item, idx) => {
                  const itemNumber = (idx + 1).toString().padStart(2, '0');
                  return (
                    <motion.div key={item.label} variants={itemVariants}>
                      <Link
                        href={item.link}
                        onClick={onClose}
                        aria-label={item.ariaLabel || item.label}
                        className="group flex items-baseline gap-4 text-2xl sm:text-4xl font-extrabold text-zinc-300 hover:text-white transition-all duration-300"
                      >
                        {displayItemNumbering && (
                          <span
                            className="font-mono text-sm sm:text-base font-bold tracking-widest transition-colors duration-300"
                            style={{ color: accentColor }}
                          >
                            {itemNumber}
                          </span>
                        )}
                        <span className="group-hover:translate-x-2 transition-transform duration-300">
                          {item.label}
                        </span>
                        <ArrowUpRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300 text-[#70E000]" />
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>

            {/* Footer / Socials */}
            <div className="z-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {displaySocials && socialItems.length > 0 && (
                <div className="flex items-center gap-4 flex-wrap">
                  {socialItems.map((social) => (
                    <a
                      key={social.label}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-[#70E000] transition-colors"
                    >
                      {social.label}
                    </a>
                  ))}
                </div>
              )}
              <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
                MIAR AI/FOOD — 2026
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StaggeredMenu;
