import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Package, Gift, Trash2, LogOut, Menu, X, UserCircle, Receipt, BarChart3, DollarSign, Boxes } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import happyCashLogo from '@/assets/happycash-logo.png';

const navItems = [
  { path: '/', label: 'Painel', icon: Home, shortcut: '1' },
  { path: '/pdv', label: 'PDV 🧾', icon: Receipt, shortcut: '2' },
  { path: '/clientes', label: 'Clientes', icon: Users, shortcut: '3' },
  { path: '/produtos', label: 'Produtos', icon: Package, shortcut: '4' },
  { path: '/estoque', label: 'Estoque', icon: Boxes, shortcut: '5' },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, shortcut: '6' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, shortcut: '7' },
  { path: '/recompensas', label: 'Recompensas', icon: Gift },
  { path: '/excluidos', label: 'Excluídos', icon: Trash2 },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { logout, user, username } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isPdvMode = location.pathname === '/pdv';

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
      const pathByKey: Record<string, string> = {
        '1': '/',
        '2': '/pdv',
        '3': '/clientes',
        '4': '/produtos',
        '5': '/estoque',
        '6': '/relatorios',
        '7': '/financeiro',
        F1: '/',
        F2: '/pdv',
        F3: '/clientes',
        F4: '/produtos',
        F5: '/estoque',
        F6: '/relatorios',
        F7: '/financeiro',
      };
      const path = pathByKey[event.key];
      if (!path) return;
      event.preventDefault();
      setOpen(false);
      navigate(path);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPdvMode, navigate]);

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
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:h-screen lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="border-b border-border px-4 py-5">
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
        <nav className="flex-1 p-4 space-y-1 overflow-auto">
          {navItems.map(item => {
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
        <div className="p-4 border-t border-border space-y-2">
          {user && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
              <UserCircle className="h-5 w-5 text-primary" />
              <span className="truncate font-medium">{username ?? user.email}</span>
            </div>
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
