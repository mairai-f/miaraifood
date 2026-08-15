'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X, Moon, Sun, Globe, ChevronDown, Focus, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { supabase } from '@/utils/supabase/client';
import { startSiteLogout } from '@/lib/authSessionPreferences';

import Image from 'next/image';
import CardNav from '@/components/ui/CardNav';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { usePreloadState } from '@/components/ui/arc-preloader-hero';

// Removed Clock component

// Sub-links for the "About" dropdown
// Sub-links for the "About" dropdown
const useNavItems = () => {
    const t = useTranslations('navigation.menu');

    return [
        {
            label: "HappyCash",
            links: [
                {
                    label: t('achievements'),
                    href: "/central-de-ajuda",
                    description: t('achievementsDesc')
                },
                {
                    label: t('skills'),
                    href: "/recursos",
                    description: t('skillsDesc')
                },
                {
                    label: t('experience'),
                    href: "/sobre",
                    description: t('experienceDesc')
                },
                {
                    label: t('projects'),
                    href: "/funcionalidades",
                    description: t('projectsDesc')
                },
                {
                    label: t('blog'),
                    href: "/conteudos",
                    description: t('blogDesc')
                },
                {
                    label: "Telas do Sistema",
                    href: "/telas",
                    description: "Demonstração visual do HappyCash"
                },
                {
                    label: "Termos e Privacidade",
                    href: "/termos",
                    description: "Condições de uso e segurança"
                }
            ]
        }
    ];
};
export function Navbar() {
    const t = useTranslations('navigation');
    const navItems = useNavItems();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const pathname = usePathname();
    const { scrollY } = useScroll();

    const [isVisible, setIsVisible] = useState(true);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [currentLocale, setCurrentLocale] = useState('pt');
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserEmail(session?.user?.email || null);
            setIsLoadingAuth(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUserEmail(session?.user?.email || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Consume preload state directly from context
    const { isPreloading: isPreloadActive } = usePreloadState();

    const isDark = resolvedTheme === 'dark';

    useEffect(() => {
        setMounted(true);
        const locale = document.cookie.split('; ').find(row => row.startsWith('locale='))?.split('=')[1] || 'pt';
        setCurrentLocale(locale);
    }, []);

    // Lock body scroll when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    // Close menu on route change
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    useMotionValueEvent(scrollY, 'change', (latest) => {
        if (isMenuOpen) return; // Don't hide navbar when menu is open

        const direction = latest > lastScrollY ? 'down' : 'up';
        setIsScrolled(latest > 50);

        if (direction === 'down' && latest > 100) {
            setIsVisible(false);
        } else {
            setIsVisible(true);
        }

        setLastScrollY(latest);
    });

    const toggleMenu = useCallback(() => {
        setIsMenuOpen((prev) => !prev);
    }, []);

    const toggleLocale = useCallback(() => {
        const newLocale = currentLocale === 'pt' ? 'en' : 'pt';
        document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
        setCurrentLocale(newLocale);
        window.location.reload();
    }, [currentLocale]);

    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    const handleHomeClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (pathname === '/') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        closeMenu();
    }, [pathname, closeMenu]);

    // Animation variants
    const navVariants = {
        visible: { y: 0, opacity: 1 },
        hidden: { y: -100, opacity: 0 }
    };

    const menuVariants = {
        closed: { opacity: 0 },
        open: { opacity: 1 }
    };

    return (
        <>
            <motion.nav
                variants={navVariants}
                initial="hidden"
                animate={!isPreloadActive && (isVisible || isMenuOpen) ? 'visible' : 'hidden'}
                transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                className="fixed top-0 left-0 right-0 z-[100]"
            >
                <div className="max-w-[1600px] mx-auto px-6 md:px-12 lg:px-24 py-4 md:py-6">
                    <motion.div
                        className={cn(
                            'flex items-center justify-between transition-all duration-500 rounded-full',
                            isScrolled ? 'glass-strong px-6 py-3' : 'py-2'
                        )}
                        layout
                    >
                        {/* Logo Link to Home */}
                        <Link href="/" className="relative group flex items-center justify-center" onClick={handleHomeClick}>
                            <span className="font-heading text-2xl font-black leading-none text-[#0f2a5f] dark:text-white sm:text-3xl transition-transform group-hover:scale-105 duration-300 tracking-tight">
                                HappyCash
                            </span>
                        </Link>

                        {/* Desktop Navigation with CardNav */}
                        <div className="hidden lg:flex items-center gap-6">
                            {/* HOME */}
                            <Link
                                href="/"
                                onClick={handleHomeClick}
                                className={cn(
                                    'relative px-5 py-2 text-sm font-bold transition-all duration-300 rounded-full group',
                                    pathname === '/' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <span className="relative z-10">{t('home')}</span>
                            </Link>

                            <CardNav
                                items={navItems}
                                theme={isDark ? 'dark' : 'light'}
                                pathname={pathname}
                            />

                            {/* PLANOS (Direct Link) */}
                            <Link
                                href="/planos"
                                className={cn(
                                    'relative px-5 py-2 text-sm font-bold transition-all duration-300 rounded-full group',
                                    pathname === '/planos' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <span className="relative z-10">{t('contact')}</span>
                            </Link>

                            <div className="h-6 w-px bg-border mx-2"></div>

                            {/* Entrar */}
                            {isLoadingAuth ? (
                                <div className="w-20 h-9 rounded-full bg-muted animate-pulse" />
                            ) : userEmail ? (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/dashboard"
                                        className="relative px-5 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 rounded-full flex items-center gap-2"
                                    >
                                        <span className="relative z-10 max-w-[150px] truncate block">{userEmail}</span>
                                    </Link>
                                    <button
                                        onClick={() => startSiteLogout({ auth: supabase.auth }, '/')}
                                        className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                                        aria-label="Sair"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    href="/login"
                                    className="relative px-5 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 rounded-full"
                                >
                                    <span className="relative z-10">Entrar</span>
                                </Link>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 md:gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleLocale}
                                className="p-2 md:p-2.5 rounded-full bg-muted/80 hover:bg-muted transition-colors"
                                aria-label="Toggle language"
                            >
                                <Globe className="w-4 h-4" />
                            </motion.button>

                            {mounted && (
                                <AnimatedThemeToggler />
                            )}

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={toggleMenu}
                                className="p-2 md:p-2.5 rounded-full bg-muted/80 hover:bg-muted transition-colors lg:hidden"
                                aria-label="Toggle menu"
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={isMenuOpen ? 'close' : 'menu'}
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </motion.nav >

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {
                    isMenuOpen && (
                        <motion.div
                            variants={menuVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-[90] lg:hidden"
                        >
                            <motion.div
                                className="absolute inset-0 bg-background"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            />

                            <div className="relative flex flex-col items-center justify-center h-full overflow-y-auto py-20">
                                <nav className="flex flex-col items-center gap-6">
                                    {/* Mobile Home */}
                                    <Link
                                        href="/"
                                        onClick={handleHomeClick}
                                        className="text-3xl font-black text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {t('home')}
                                    </Link>

                                    <Link
                                        href="/planos"
                                        onClick={closeMenu}
                                        className="text-3xl font-black text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {t('contact')}
                                    </Link>

                                    {isLoadingAuth ? (
                                        <div className="w-24 h-8 bg-muted animate-pulse rounded-md mt-2" />
                                    ) : userEmail ? (
                                        <div className="flex flex-col items-center gap-2 mt-2">
                                            <Link
                                                href="/dashboard"
                                                onClick={closeMenu}
                                                className="text-2xl font-black text-primary hover:text-primary/80 transition-colors flex flex-col items-center"
                                            >
                                                <span className="max-w-[200px] truncate block text-center">{userEmail}</span>
                                            </Link>
                                            <button
                                                onClick={() => { startSiteLogout({ auth: supabase.auth }, '/'); closeMenu(); }}
                                                className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                Sair
                                            </button>
                                        </div>
                                    ) : (
                                        <Link
                                            href="/login"
                                            onClick={closeMenu}
                                            className="text-3xl font-black text-primary hover:text-primary/80 transition-colors mt-2"
                                        >
                                            Entrar
                                        </Link>
                                    )}

                                    {/* Mobile Links grouped by Categories */}
                                    {navItems.map((category) => (
                                        <div key={category.label} className="flex flex-col items-center gap-4 py-4 border-b border-white/5 w-full last:border-0 text-center">
                                            <span className="text-[10px] font-black font-mono text-primary tracking-[0.3em] uppercase opacity-50">
                                                {category.label}
                                            </span>
                                            {category.links.map((link) => (
                                                <Link
                                                    key={link.label}
                                                    href={link.href}
                                                    onClick={closeMenu}
                                                    className={cn(
                                                        'text-2xl font-bold transition-all hover:scale-110 active:scale-95 duration-200',
                                                        pathname === link.href ? 'text-foreground' : 'text-muted-foreground/60 hover:text-foreground'
                                                    )}
                                                >
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </div>
                                    ))}
                                </nav>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    transition={{ delay: 0.5 }}
                                    className="flex items-center gap-4 mt-12"
                                >
                                    <button
                                        onClick={toggleLocale}
                                        className="px-6 py-3 rounded-full glass-card text-sm font-medium hover:bg-muted/50 transition-colors"
                                    >
                                        {currentLocale === 'pt' ? 'Português' : 'English'}
                                    </button>
                                    {mounted && (
                                        <AnimatedThemeToggler
                                            className="px-6 py-6 glass-card text-sm font-medium hover:bg-muted/50 flex items-center gap-2"
                                        />
                                    )}
                                </motion.div>
                            </div>
                        </motion.div >
                    )
                }
            </AnimatePresence >
        </>
    );
}
