// ============================================================
// BARRA DE NAVEGAÇÃO — src/components/layout/Navbar.tsx
// Responsabilidade: Menu principal do site com links desktop e menu hambúrguer no mobile.
// Funcionalidades: auto-hide ao rolar, glassmorphism ao scrollar, troca de idioma,
//   alternância de tema claro/escuro, exibição do email logado e logout.
// Usado em: src/components/layout/index.tsx (importado em todas as páginas)
// ============================================================

'use client'; // Necessário para hooks React e interatividade no Next.js App Router

// --- Imports de hooks e bibliotecas ---
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion'; // Animações da navbar
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Hook para obter a rota atual (highlight do link ativo)
import { useTranslations } from 'next-intl'; // Textos traduzidos de messages/pt.json
import { Menu, X, Moon, Sun, Globe, ChevronDown, Focus, LogOut } from 'lucide-react'; // Ícones
import { useTheme } from 'next-themes'; // Gerenciamento de tema claro/escuro
import { cn } from '@/lib/utils'; // Mescla classes CSS condicionalmente
import { supabase } from '@/utils/supabase/client'; // Cliente Supabase para verificar sessão do usuário
import { startSiteLogout } from '@/lib/authSessionPreferences'; // Logout com limpeza de sessão

import Image from 'next/image';
import CardNav from '@/components/ui/CardNav'; // Dropdown de navegação com cards (desktop)
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'; // Botão animado de tema
import { usePreloadState } from '@/components/ui/arc-preloader-hero'; // Oculta navbar durante pré-carregamento

// --- useNavItems: Define os itens do menu de navegação ---
// Retorna as categorias e sub-links do dropdown desktop e do menu mobile.
// Os textos vêm do arquivo de tradução: messages/pt.json → navigation.menu
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

    // --- Estado da navbar ---
    const [isVisible, setIsVisible] = useState(true);       // Controla se a navbar aparece ou some (auto-hide)
    const [isScrolled, setIsScrolled] = useState(false);    // Ativa glassmorphism após scrollar 50px
    const [isMenuOpen, setIsMenuOpen] = useState(false);    // Abre/fecha o menu mobile (hambúrguer)
    const [lastScrollY, setLastScrollY] = useState(0);      // Posição Y do último scroll (detecta direção)
    const [mounted, setMounted] = useState(false);           // Evita mismatch de hidratação SSR/cliente
    const [currentLocale, setCurrentLocale] = useState('pt'); // Idioma atual (pt ou en), lido do cookie
    const [userEmail, setUserEmail] = useState<string | null>(null); // Email do usuário logado (null = deslogado)
    const [isLoadingAuth, setIsLoadingAuth] = useState(true); // Exibe skeleton enquanto verifica sessão

    // Verifica a sessão ativa do Supabase ao montar o componente
    // e escuta mudanças de autenticação (login/logout em outras abas)
    useEffect(() => {
        // Busca a sessão atual (usuário já estava logado?)
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserEmail(session?.user?.email || null);
            setIsLoadingAuth(false); // Para de exibir o skeleton de loading
        });

        // Listener em tempo real: atualiza o email quando o usuário faz login/logout
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUserEmail(session?.user?.email || null);
        });

        // Limpeza: cancela o listener ao desmontar o componente
        return () => subscription.unsubscribe();
    }, []);

    // Lê o estado do pré-carregador: se estiver ativo, a navbar permanece oculta
    const { isPreloading: isPreloadActive } = usePreloadState();

    const isDark = resolvedTheme === 'dark'; // Usado para passar o tema correto ao CardNav

    useEffect(() => {
        setMounted(true); // Marca que o componente está hidratado no cliente (evita erro de SSR)
        // Lê o idioma atual do cookie (salvo na última troca de idioma pelo usuário)
        const locale = document.cookie.split('; ').find(row => row.startsWith('locale='))?.split('=')[1] || 'pt';
        setCurrentLocale(locale);
    }, []);

    // Trava o scroll da página quando o menu mobile está aberto
    // Isso evita que o fundo role enquanto o overlay do menu está visível
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden'; // Bloqueia scroll
        } else {
            document.body.style.overflow = ''; // Restaura scroll normal
        }
        return () => {
            document.body.style.overflow = ''; // Garante restauração ao desmontar
        };
    }, [isMenuOpen]);

    // Fecha o menu automaticamente quando o usuário navega para outra página
    useEffect(() => {
        setIsMenuOpen(false);
    }, [pathname]);

    // Observa a posição de scroll e decide se a navbar deve aparecer ou sumir
    // Regra: some ao rolar para baixo (após 100px) e aparece ao rolar para cima
    useMotionValueEvent(scrollY, 'change', (latest) => {
        if (isMenuOpen) return; // Não esconde a navbar quando o menu mobile está aberto

        const direction = latest > lastScrollY ? 'down' : 'up'; // Detecta direção do scroll
        setIsScrolled(latest > 50); // Ativa glassmorphism após 50px de scroll

        if (direction === 'down' && latest > 100) {
            setIsVisible(false); // Esconde navbar ao descer a página
        } else {
            setIsVisible(true); // Mostra navbar ao subir ou estar no topo
        }

        setLastScrollY(latest); // Atualiza posição para próxima comparação
    });

    // Abre/fecha o menu mobile (hambúrguer)
    const toggleMenu = useCallback(() => {
        setIsMenuOpen((prev) => !prev);
    }, []);

    // Alterna o idioma entre Português (pt) e English (en)
    // Salva a preferência em cookie por 1 ano e recarrega a página para aplicar
    const toggleLocale = useCallback(() => {
        const newLocale = currentLocale === 'pt' ? 'en' : 'pt';
        document.cookie = `locale=${newLocale};path=/;max-age=31536000`; // Cookie válido por 1 ano
        setCurrentLocale(newLocale);
        window.location.reload(); // Recarrega para aplicar as traduções do novo idioma
    }, [currentLocale]);

    // Fecha o menu mobile (usado nos links do overlay)
    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    // Ao clicar no logo/home: se já estiver na home, apenas sobe ao topo sem recarregar
    const handleHomeClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (pathname === '/') {
            e.preventDefault(); // Evita recarga desnecessária
            window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll suave ao topo
        }
        closeMenu(); // Fecha menu mobile se estiver aberto
    }, [pathname, closeMenu]);

    // --- Variantes de animação (Framer Motion) ---
    // navVariants: controla a aparição/desaparecimento da navbar (slide vertical)
    const navVariants = {
        visible: { y: 0, opacity: 1 },
        hidden: { y: -100, opacity: 0 } // Desliza para cima ao sumir
    };

    // menuVariants: controla o fade do overlay do menu mobile
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
                        {/* Logo — clica volta para o topo da home */}
                        <Link href="/" className="relative group flex items-center justify-center" onClick={handleHomeClick}>
                            <span className="font-heading text-2xl font-black leading-none text-[#0f2a5f] dark:text-white sm:text-3xl transition-transform group-hover:scale-105 duration-300 tracking-tight">
                                HappyCash
                            </span>
                        </Link>

                        {/* Navegação Desktop — visível apenas em telas lg+ (≥1024px) */}
                        <div className="hidden lg:flex items-center gap-6">
                            {/* Link: Página inicial */}
                            <Link
                                href="/"
                                onClick={handleHomeClick}
                                className={cn(
                                    'relative px-5 py-2 text-sm font-bold transition-all duration-300 rounded-full group',
                                    // Destaca o link ativo com fundo muted
                                    pathname === '/' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <span className="relative z-10">{t('home')}</span>
                            </Link>

                            {/* Dropdown de categorias (Central de Ajuda, Recursos, Telas, etc.) */}
                            <CardNav
                                items={navItems}        // Sub-links definidos em useNavItems()
                                theme={isDark ? 'dark' : 'light'}
                                pathname={pathname}     // Para highlight do link ativo dentro do dropdown
                            />

                            {/* Link direto para a página de Planos e Preços */}
                            <Link
                                href="/planos"
                                className={cn(
                                    'relative px-5 py-2 text-sm font-bold transition-all duration-300 rounded-full group',
                                    pathname === '/planos' ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                <span className="relative z-10">{t('contact')}</span>
                            </Link>

                            {/* Divisor visual entre links e botão de ação */}
                            <div className="h-6 w-px bg-border mx-2"></div>

                            {/* Área de autenticação: skeleton → email logado → botão Entrar */}
                            {isLoadingAuth ? (
                                // Placeholder animado enquanto verifica a sessão
                                <div className="w-20 h-9 rounded-full bg-muted animate-pulse" />
                            ) : userEmail ? (
                                // Usuário logado: exibe email truncado + botão de logout
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/dashboard"
                                        className="relative px-5 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 rounded-full flex items-center gap-2"
                                    >
                                        <span className="relative z-10 max-w-[150px] truncate block">{userEmail}</span>
                                    </Link>
                                    {/* Botão de logout — chama startSiteLogout que limpa cookies e sessão */}
                                    <button
                                        onClick={() => startSiteLogout({ auth: supabase.auth }, '/')}
                                        className="p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                                        aria-label="Sair"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                // Usuário deslogado: botão Entrar → redireciona para /login
                                <Link
                                    href="/login"
                                    className="relative px-5 py-2 text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 rounded-full"
                                >
                                    <span className="relative z-10">Entrar</span>
                                </Link>
                            )}
                        </div>

                        {/* Controles globais: idioma, tema e hambúrguer (mobile) */}
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

            {/* ─── MENU MOBILE — Overlay de tela cheia ─────────────────────────────────
                Aparece sobre tudo (z-[90]) quando o hambúrguer é clicado.
                Exibe os mesmos links do desktop em tamanho grande (touch-friendly).
                Fecha automaticamente ao navegar ou trocar de rota.
            ─────────────────────────────────────────────────────────────────────────── */}
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
