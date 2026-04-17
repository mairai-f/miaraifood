import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Package, Gift, Trash2, LogOut, Menu, X, UserCircle, Receipt, BarChart3, DollarSign, Boxes, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import happyCashLogo from '@/assets/happycash-logo.png';
import { roleLabel } from '@/lib/access';

const navItems = [
  { path: '/', label: 'Painel', icon: Home, shortcut: '1', roles: ['admin', 'operator'], featureKey: 'dashboard.view' },
  { path: '/pdv', label: 'PDV 🧾', icon: Receipt, shortcut: '2', roles: ['admin', 'operator'], featureKey: 'pdv.use' },
  { path: '/clientes', label: 'Clientes', icon: Users, shortcut: '3', roles: ['admin', 'operator'], featureKey: 'clients.manage' },
  { path: '/produtos', label: 'Produtos', icon: Package, shortcut: '4', roles: ['admin', 'operator'], featureKey: 'products.manage' },
  { path: '/estoque', label: 'Estoque', icon: Boxes, shortcut: '5', roles: ['admin'], featureKey: 'stock.manage' },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, shortcut: '6', roles: ['admin'], featureKey: 'reports.view' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, shortcut: '7', roles: ['admin'], featureKey: 'financial.manage' },
  { path: '/notas', label: 'Notas', icon: FileText, shortcut: '8', roles: ['admin'], featureKey: 'notes.manage' },
  { path: '/recompensas', label: 'Recompensas', icon: Gift, roles: ['admin'], featureKey: 'rewards.manage' },
  { path: '/excluidos', label: 'Excluídos', icon: Trash2, roles: ['admin'], featureKey: 'deleted.view' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { logout, user, username, role } = useAuth();
  const { hasFeature } = usePlanAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [scrollHints, setScrollHints] = useState({ top: false, bottom: false });
  const isPdvMode = location.pathname === '/pdv';
  const visibleNavItems = navItems.filter(item => item.roles.includes(role) && hasFeature(item.featureKey));
  const canOpenSettings = role === 'admin' && hasFeature('settings.manage');

  const handleAccountClick = () => {
    if (!canOpenSettings) return;
    setOpen(false);
    navigate('/configuracoes');
  };

  const updateScrollHints = useCallback(() => {
    const nav = navRef.current;
    if (!nav) {
      setScrollHints({ top: false, bottom: false });
      return;
    }

    const threshold = 8;
    const hasTopOverflow = nav.scrollTop > threshold;
    const hasBottomOverflow = nav.scrollTop + nav.clientHeight < nav.scrollHeight - threshold;

    setScrollHints((current) => {
      if (current.top === hasTopOverflow && current.bottom === hasBottomOverflow) {
        return current;
      }

      return { top: hasTopOverflow, bottom: hasBottomOverflow };
    });
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPdvMode) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      const pathByKey = visibleNavItems.reduce<Record<string, string>>((acc, item) => {
        if (!item.shortcut) return acc;
        acc[item.shortcut] = item.path;
        acc[`F${item.shortcut}`] = item.path;
        return acc;
      }, {});
      const path = pathByKey[event.key];
      if (!path) return;
      event.preventDefault();
      setOpen(false);
      navigate(path);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPdvMode, navigate, visibleNavItems]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const runUpdate = () => window.requestAnimationFrame(updateScrollHints);
    runUpdate();

    nav.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', runUpdate);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(runUpdate)
      : null;

    resizeObserver?.observe(nav);

    return () => {
      nav.removeEventListener('scroll', updateScrollHints);
      window.removeEventListener('resize', runUpdate);
      resizeObserver?.disconnect();
    };
  }, [location.pathname, open, updateScrollHints]);

  if (isPdvMode) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <main className="h-screen overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {open && <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-border bg-card transition-transform duration-300 lg:static lg:h-screen lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="shrink-0 border-b border-border px-4 py-5">
          <div className="relative flex items-start justify-end">
            <div className="min-w-0 flex-1 pr-2 text-center">
              <img
                src={happyCashLogo}
                alt="Logo do sistema"
                className="mx-auto h-auto w-full max-w-[168px] object-contain"
              />
              <p className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                SISTEMA DE GESTAO 2.0
              </p>
            </div>
            <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {scrollHints.top && (
            <div className="pointer-events-none absolute inset-x-4 top-0 z-10 flex justify-center bg-gradient-to-b from-card via-card/85 to-transparent pb-4 pt-2">
              <div className="rounded-full border border-border/70 bg-background/80 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm animate-[floatHint_1.7s_ease-in-out_infinite]">
                <ChevronUp className="h-4 w-4" />
              </div>
            </div>
          )}
          <nav ref={navRef} className="no-scrollbar min-h-0 h-full overflow-y-auto p-4 space-y-1">
            {visibleNavItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {'shortcut' in item && item.shortcut && (
                    <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'border-primary-foreground/40 text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                      {item.shortcut}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {scrollHints.bottom && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 z-10 flex justify-center bg-gradient-to-t from-card via-card/85 to-transparent pb-2 pt-4">
              <div className="rounded-full border border-border/70 bg-background/80 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm animate-[floatHint_1.7s_ease-in-out_infinite]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 space-y-2 border-t border-border p-4">
          {user && (
            canOpenSettings ? (
              <button
                type="button"
                onClick={handleAccountClick}
                className="w-full rounded-lg px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <span className="truncate font-medium">{username ?? user.email}</span>
                </div>
                <p className="mt-1 pl-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {roleLabel[role]} • Configuracoes
                </p>
              </button>
            ) : (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <span className="truncate font-medium">{username ?? user.email}</span>
                </div>
                <p className="mt-1 pl-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {roleLabel[role]}
                </p>
              </div>
            )
          )}
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors">
            <LogOut className="h-5 w-5" /><span>Sair</span>
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border p-3 sm:p-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-muted-foreground hover:text-foreground"><Menu className="h-6 w-6" /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
