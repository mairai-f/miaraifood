import { useState, useEffect, ReactNode } from 'react';
import { useLocation, Link } from 'wouter';
import {
  LayoutDashboard,
  ChefHat,
  BookOpen,
  Bot,
  Settings,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  CreditCard,
  UtensilsCrossed,
  Bell,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Tv,
  Truck,
  CalendarClock,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/IdiomaContext';
import { SeletorIdioma } from '@/i18n/SeletorIdioma';
import { stopKioskMode } from '@/lib/kiosk';
import { clearTenantScopedCache } from '@/lib/tenant-cache';

interface AppLayoutProps {
  children: ReactNode;
}

export type ModuleKey =
  | 'dashboard'
  | 'pdv'
  | 'cozinha'
  | 'mesas'
  | 'cardapio'
  | 'estoque'
  | 'compras'
  | 'fornecedores'
  | 'financeiro'
  | 'funcionarios'
  | 'ia'
  | 'comando'
  | 'configuracoes'
  | 'agendamentos'
  | 'chat-equipe';

export const ALL_NAV_ITEMS: { href: string; label: string; icon: any; category: string; key: ModuleKey }[] = [
  { href: '/painel', label: 'Dashboard', icon: LayoutDashboard, category: 'Visão Geral', key: 'dashboard' },
  { href: '/app/pdv', label: 'PDV / Caixa', icon: CreditCard, category: 'Operação', key: 'pdv' },
  { href: '/app/cozinha', label: 'Cozinha KDS', icon: ChefHat, category: 'Operação', key: 'cozinha' },
  { href: '/app/mesas', label: 'Mesas & Comandas', icon: UtensilsCrossed, category: 'Salão', key: 'mesas' },
  { href: '/central-comando', label: 'Central Multi-Monitor', icon: Tv, category: 'Operação', key: 'comando' },
  { href: '/catalogo', label: 'Cardápio / Catálogo', icon: BookOpen, category: 'Gestão', key: 'cardapio' },
  { href: '/minha-ia', label: 'IA Ária', icon: Bot, category: 'Inteligência', key: 'ia' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, category: 'Sistema', key: 'configuracoes' },
  { href: '/agendamentos', label: 'Agenda de Atendimentos', icon: CalendarClock, category: 'Serviços', key: 'agendamentos' },
  { href: '/chat-equipe', label: 'Chat da Equipe', icon: MessageCircle, category: 'Equipe', key: 'chat-equipe' },
];

// Segmentos cujo negócio depende de agendamento de horário (banho e tosa,
// ordens de serviço marcadas, etc.) — pros demais (restaurante, bar,
// lanchonete...) a Agenda não faz sentido no menu.
const SEGMENTOS_COM_AGENDA = ['petshop', 'servicos'];

export function isModuleAllowedForSegment(key: ModuleKey, segmentId: string): boolean {
  const foodOnlyModules: ModuleKey[] = ['cozinha', 'mesas'];
  const nonFoodSegments = ['petshop', 'mercado', 'hortifrut', 'mercearia', 'conveniencia', 'adega', 'servicos'];
  if (key === 'agendamentos') {
    return SEGMENTOS_COM_AGENDA.includes(segmentId.toLowerCase());
  }
  if (nonFoodSegments.includes(segmentId.toLowerCase()) && foodOnlyModules.includes(key)) {
    return false;
  }
  return true;
}

export function getUserPermissions(): ModuleKey[] {
  try {
    const token = window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
    const userRole = (window.localStorage.getItem('miar-current-user-role') || '').toLowerCase();
    const storedPerms = window.localStorage.getItem('miar-current-user-permissions');

    const FULL_PERMS: ModuleKey[] = [
      'dashboard',
      'pdv',
      'cozinha',
      'mesas',
      'comando',
      'cardapio',
      'estoque',
      'compras',
      'fornecedores',
      'financeiro',
      'funcionarios',
      'ia',
      'configuracoes',
      'agendamentos',
      'chat-equipe',
    ];

    // Admin / Owner ou tokens de gestor têm acesso total
    if (!token || token.startsWith('admin-') || token === 'dev-bypass' || userRole === 'owner' || userRole === 'manager' || userRole === 'gestor') {
      return FULL_PERMS;
    }

    if (storedPerms) {
      const parsed: string[] = JSON.parse(storedPerms);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ModuleKey[];
      }
    }

    // Regras padrão por Perfil de Funcionário — chat da equipe é liberado
    // pra TODO funcionário, de qualquer perfil (05/09/2026, pedido
    // explícito), diferente dos módulos operacionais que são por cargo.
    if (userRole.includes('waiter') || userRole.includes('garcom') || userRole.includes('atendente')) {
      return ['mesas', 'chat-equipe'];
    }
    if (userRole.includes('cook') || userRole.includes('cozinha')) {
      return ['cozinha', 'chat-equipe'];
    }
    if (userRole.includes('cashier') || userRole.includes('caixa')) {
      return ['pdv', 'mesas', 'chat-equipe'];
    }

    return FULL_PERMS;
  } catch {
    return [
      'dashboard',
      'pdv',
      'cozinha',
      'mesas',
      'comando',
      'cardapio',
      'estoque',
      'compras',
      'fornecedores',
      'financeiro',
      'funcionarios',
      'ia',
      'configuracoes',
      'agendamentos',
      'chat-equipe',
    ];
  }
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAriaBanner, setShowAriaBanner] = useState(true);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [atalhosNavegacao, setAtalhosNavegacao] = useState<Record<string, string>>({});

  const incompleteSetup = window.localStorage.getItem('miar-onboarding-completed') !== 'true';

  const companySegment = window.localStorage.getItem('miar-onboarding-segment') || 'restaurante';
  const permissions = getUserPermissions();

  // Filtragem ESTRITA de itens do menu baseada nas permissões e no segmento do estabelecimento
  const navItems = ALL_NAV_ITEMS.filter(
    (item) => permissions.includes(item.key) && isModuleAllowedForSegment(item.key, companySegment)
  );

  // Validação de acesso à rota atual e todas as sub-rotas do sistema
  useEffect(() => {
    const currentItem = ALL_NAV_ITEMS.find((item) => {
      if (location === item.href) return true;
      if (item.key === 'funcionarios' && location.startsWith('/painel/funcionarios')) return true;
      if (item.key === 'financeiro' && location.startsWith('/rentabilidade')) return true;
      if (item.key === 'estoque' && location.startsWith('/estoque')) return true;
      if (item.key === 'compras' && (location.startsWith('/compras') || location.startsWith('/fornecedores'))) return true;
      if (item.key === 'configuracoes' && location.startsWith('/configuracoes')) return true;
      return false;
    });

    if (currentItem && !permissions.includes(currentItem.key)) {
      const firstPermitted = ALL_NAV_ITEMS.find((item) => permissions.includes(item.key));
      const targetUrl = firstPermitted ? firstPermitted.href : '/login';
      toast.error(`🔒 Acesso Restrito: Seu usuário não possui permissão para acessar o módulo '${currentItem.label}'.`);
      setLocation(targetUrl);
    }
  }, [location, permissions, setLocation]);

  // Atalhos de teclado (Atalhos Inteligentes, ver pages/atalhos.tsx) — carrega
  // os atalhos de navegação do usuário logado e escuta o teclado global pra
  // navegar direto pro módulo quando a combinação bater. Antes disso, o
  // formulário de atalhos salvava no banco mas nada em lugar nenhum do app
  // realmente lia/aplicava o valor salvo.
  useEffect(() => {
    const token = window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
    if (!token) return;
    fetch('/api/atalhos', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { atalhos: [] }))
      .then((data: { atalhos: Array<{ action: string; key: string; tipo: string }> }) => {
        const mapa: Record<string, string> = {};
        for (const a of data.atalhos ?? []) {
          if (a.tipo === 'teclado' && a.action.startsWith('navegar-')) {
            mapa[a.action.replace('navegar-', '')] = a.key;
          }
        }
        setAtalhosNavegacao(mapa);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      const k = e.key.toLowerCase();
      if (!['control', 'alt', 'shift', 'meta'].includes(k)) parts.push(k);
      const combo = parts.join('+');

      const moduleKey = Object.keys(atalhosNavegacao).find((mk) => atalhosNavegacao[mk] === combo);
      if (!moduleKey) return;
      const item = ALL_NAV_ITEMS.find((i) => i.key === moduleKey);
      if (!item) return;
      e.preventDefault();
      setLocation(item.href);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [atalhosNavegacao, setLocation]);

  // Fechar sidebar mobile ao mudar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Atalho Cmd/Ctrl + K para busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    // Solta o Screen Pinning (se este era um login Operacional) antes de
    // sair — sem isso o app ficava travado na tela de login sem jeito de
    // trocar de usuário/sair do app num aparelho compartilhado.
    void stopKioskMode();
    window.localStorage.removeItem('miar-owner-token');
    window.sessionStorage.removeItem('miar-owner-token');
    window.localStorage.removeItem('miar-current-user-role');
    window.localStorage.removeItem('miar-current-user-permissions');
    window.localStorage.removeItem('miar-employee-permissions');
    clearTenantScopedCache();
    toast.success('Sessão encerrada.');
    setLocation('/login');
  };

  const filteredNav = navItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Lista de rotas de Primeiro Acesso e Cadastro que NÃO exibem menu lateral
  const ONBOARDING_FIRST_ACCESS_ROUTES = [
    '/',
    '/login',
    '/cadastro',
    '/auth',
    '/jornada',
    '/onboarding/estabelecimento',
    '/onboarding/produtos',
    '/onboarding/usuarios',
    '/onboarding/segmento',
    '/pos-cadastro',
    '/registro-protegido',
    '/bem-vindo',
    '/registro',
    '/socios',
    '/convite-entregador',
    '/vincular-representante',
    '/miar-intro',
  ];

  const isFirstAccessOrOnboarding =
    ONBOARDING_FIRST_ACCESS_ROUTES.includes(location) ||
    location.startsWith('/onboarding') ||
    location.startsWith('/cadastro') ||
    location.startsWith('/registro') ||
    window.localStorage.getItem('miar-first-access') === 'true' ||
    window.localStorage.getItem('miar-onboarding-completed') === 'false';

  // Se for Primeiro Acesso / Onboarding, renderiza a tela em modo limpo (Full Screen) sem menu lateral
  if (isFirstAccessOrOnboarding) {
    return (
      <div className="min-h-screen bg-[#06100A] text-[#F2F7F3] font-inter selection:bg-[#008000] selection:text-[#F2F7F3]">
        <main className="w-full min-h-screen">{children}</main>
      </div>
    );
  }

  // Se estiver na Cozinha KDS, apresenta layout imersivo limpo e fixo
  if (location === '/app/cozinha') {
    return (
      <div className="min-h-screen bg-[#06100A] text-[#F2F7F3] relative font-inter">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#16301F] bg-[#0B1A10] px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <ChefHat className="h-6 w-6 text-[#008000]" />
            <span className="font-manrope font-bold tracking-tight text-[#F2F7F3] text-lg">Modo Cozinha KDS</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-[#06100A] px-3 py-1.5 text-xs font-bold text-emerald-400 border border-[#16301F]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            MONITOR KDS FIXO & AO VIVO
          </div>
        </div>
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06100A] text-[#F2F7F3] flex flex-col md:flex-row font-inter">
      {/* DESKTOP SIDEBAR - Prussian Blue (#0B1A10) */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#16301F] bg-[#0B1A10] backdrop-blur-xl transition-all duration-300 z-30 sticky top-0 h-screen ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#06100A]/60">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#008000] flex items-center justify-center shadow-[0_2px_10px_rgba(255,195,0,0.3)]">
                <UtensilsCrossed className="h-5 w-5 text-[#06100A]" />
              </div>
              <span className="font-manrope font-black text-lg tracking-wider text-[#F2F7F3]">
                MIAR <span className="text-[#008000]">FOOD</span>
              </span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto h-9 w-9 rounded-xl bg-[#008000] flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-[#06100A]" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-1.5 text-[#8FA396] hover:bg-[#06100A]/50 hover:text-[#F2F7F3] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Dynamic Navigation List (Filtered by User Permissions) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location === item.href || (item.href === '/configuracoes' && location.startsWith('/painel/funcionarios'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#008000] text-[#F2F7F3] shadow-[0_2px_10px_rgba(255,195,0,0.3)] font-manrope font-black'
                    : 'text-[#8FA396] hover:bg-[#06100A]/60 hover:text-[#F2F7F3]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#F2F7F3]' : 'text-[#38B000]'}`} />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && atalhosNavegacao[item.key] && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                      active ? 'bg-[#06100A]/20 text-[#F2F7F3]' : 'bg-[#06100A] text-[#38B000] border border-[#16301F]'
                    }`}
                  >
                    {atalhosNavegacao[item.key].toUpperCase()}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3 border-t border-[#06100A]/60">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Encerrar Sessão</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER SIDEBAR */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-[#06100A]/80 backdrop-blur-md flex">
          <div className="w-4/5 max-w-xs bg-[#0B1A10] border-r border-[#16301F] h-full p-4 flex flex-col">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#06100A]/60">
              <span className="font-manrope font-extrabold text-lg text-[#008000]">MIAR FOOD</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-[#8FA396] hover:text-[#F2F7F3]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold ${
                      active
                        ? 'bg-[#008000] text-[#F2F7F3]'
                        : 'text-[#8FA396] hover:bg-[#06100A]/40 hover:text-[#F2F7F3]'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-[#38B000]" />
                    <span className="flex-1">{item.label}</span>
                    {atalhosNavegacao[item.key] && (
                      <span className="rounded-md border border-[#16301F] bg-[#06100A] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#38B000]">
                        {atalhosNavegacao[item.key].toUpperCase()}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl p-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#06100A]">
        {/* TOP HEADER - Prussian Blue (#0B1A10) */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#16301F] bg-[#0B1A10]/90 px-4 py-3 backdrop-blur-xl">
          {/* Left Mobile Menu Trigger & Search */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden rounded-xl border border-[#16301F] p-2 text-[#8FA396] hover:text-[#F2F7F3]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#06100A]/60 px-3.5 py-1.5 text-xs text-[#8FA396] hover:border-[#008000]/40 hover:text-[#F2F7F3] transition-all"
            >
              <Search className="h-3.5 w-3.5 text-[#38B000]" />
              <span className="hidden sm:inline">{t('nav.buscar_rota')}</span>
              <kbd className="hidden sm:inline rounded bg-[#0B1A10] px-1.5 py-0.5 text-[10px] font-mono text-[#38B000]">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            <SeletorIdioma />

            <Link
              href="/minha-ia"
              className="flex items-center gap-1.5 rounded-full border border-[#008000]/50 bg-[#008000]/10 px-3 py-1 text-xs font-bold text-[#38B000] hover:bg-[#008000]/20 transition-all"
            >
              <Bot className="h-3.5 w-3.5 text-[#38B000]" />
              <span>Ária Copilot</span>
            </Link>

            {/* Sininho de Notificações */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifPopup(!showNotifPopup)}
                className="relative p-2 rounded-xl border border-[#16301F] bg-[#06100A]/60 text-[#8FA396] hover:text-[#38B000] transition"
                title="Central de Notificações"
              >
                <Bell className="h-4 w-4" />
                {incompleteSetup && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#008000] animate-ping" />
                )}
              </button>
              {showNotifPopup && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[#16301F] bg-[#0B1A10] p-3 shadow-2xl z-50 text-xs">
                  <div className="flex items-center justify-between border-b border-[#16301F] pb-2 mb-2 font-bold text-[#38B000]">
                    <span>🔔 Central de Avisos</span>
                    <button type="button" onClick={() => setShowNotifPopup(false)} className="text-[#8FA396] hover:text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {incompleteSetup ? (
                    <div className="p-2.5 bg-[#06100A] rounded-xl border border-[#16301F] space-y-1.5">
                      <p className="font-extrabold text-[#F2F7F3]">🤖 IA Ária: Configuração Pendente</p>
                      <p className="text-[#8FA396] text-[11px] leading-relaxed">
                        Lembrete: realize o cadastro do seu segmento e cardápio para habilitar automações.
                      </p>
                      <Link
                        href="/onboarding/segmento"
                        onClick={() => setShowNotifPopup(false)}
                        className="inline-block text-[11px] text-[#008000] font-bold underline mt-1"
                      >
                        Ir para Configuração →
                      </Link>
                    </div>
                  ) : (
                    <p className="text-[#8FA396] p-2 text-center">Nenhuma notificação pendente no momento.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* BANNER DISCRETO DA IA ÁRIA */}
        {showAriaBanner && incompleteSetup && (
          <div className="shrink-0 bg-[#0B1A10] border-b border-[#008000]/40 px-4 py-2 text-xs flex items-center justify-between gap-3 text-[#F2F7F3]">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#38B000] shrink-0" />
              <span>
                🤖 <strong className="text-[#38B000]">IA Ária:</strong> Lembrete: conclua o cadastro do seu segmento e produtos para otimizar suas operações.
              </span>
              <Link href="/onboarding/segmento" className="ml-2 font-bold text-[#008000] underline hover:text-[#38B000]">
                Cadastrar segmento
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setShowAriaBanner(false)}
              className="text-[#8FA396] hover:text-[#F2F7F3] p-1 rounded hover:bg-[#06100A]/50"
              title="Fechar lembrete"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-[#16301F] bg-[#0B1A10]/95 backdrop-blur-xl px-2 py-2 flex items-center justify-around shadow-2xl">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-bold transition-colors ${
                active ? 'text-[#008000]' : 'text-[#8FA396]'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* COMMAND PALETTE MODAL (CMD + K) */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-[#06100A]/80 backdrop-blur-md px-4"
          onClick={() => setCmdOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[#16301F] bg-[#0B1A10] p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite para buscar uma rota..."
                className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-4 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      setLocation(item.href);
                      setCmdOpen(false);
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-bold text-[#8FA396] hover:bg-[#008000]/10 hover:text-[#008000] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#38B000]" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] text-[#38B000] uppercase font-mono">{item.category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
