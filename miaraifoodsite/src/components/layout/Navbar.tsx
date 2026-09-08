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
import { FloatingMenu } from '@/components/ui/FloatingMenu';

// --- useNavItems: Define os itens do menu de navegação ---
// Retorna as categorias e sub-links do dropdown desktop e do menu mobile.
// Os textos vêm do arquivo de tradução: messages/pt.json → navigation.menu
const useNavItems = () => {
    const t = useTranslations('navigation.menu');

    return [
        {
            label: "MIAR AI/FOOD",
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
                    description: "Demonstração visual do MIAR AI/FOOD"
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
        <FloatingMenu
            primaryButton={{ label: '1 Mês Grátis', href: '/cadastro' }}
            secondaryButton={{ label: userEmail ? 'Minha Conta' : 'Entrar', href: userEmail ? '/dashboard' : '/login' }}
            menuGroups={[
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
                        { label: userEmail ? `Conectado (${userEmail})` : 'Entrar no Sistema', href: userEmail ? '/dashboard' : '/login' },
                        { label: 'Criar Conta (1 Mês Grátis)', href: '/cadastro' },
                        { label: 'WhatsApp Suporte', href: 'https://wa.me/5511999999999', isExternal: true },
                    ],
                },
            ]}
            classes={{
                primaryButton: 'bg-[#70E000] text-black font-black hover:bg-[#9EF01A]',
                groupMuted: 'bg-[#081220]/90 border-white/10',
                groupTitle: 'text-[#70E000]',
            }}
        />
    );
}
