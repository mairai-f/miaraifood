import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Armchair, BellRing, MessageCircle, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { usePermissions } from '@/contexts/usePermissions';

type Item = { path: string; label: string; icon: typeof Armchair; permission: 'food.tables.view' | 'food.waiter_calls.handle' | 'chat.view' };

/**
 * Mobile shell for a waiter. It deliberately wraps the existing pages instead
 * of recreating the food, payment or chat rules in a second app.
 */
export function WaiterLayout({ children }: { children: ReactNode }) {
  const { username, user } = useAuth();
  const { scope } = useOperationalScope();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const items: Item[] = [
    { path: '/mesas', label: 'Mesas', icon: Armchair, permission: 'food.tables.view' },
    { path: '/chamados', label: 'Chamados', icon: BellRing, permission: 'food.waiter_calls.handle' },
    { path: '/conversas', label: 'Conversas', icon: MessageCircle, permission: 'chat.view' },
    { path: '/garcom/perfil', label: 'Perfil', icon: UserRound, permission: 'food.tables.view' },
  ];
  const visible = items.filter((item) => hasPermission(item.permission));

  return (
    <div className="min-h-dvh bg-background pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <img src="/miar-collapsed-icon.svg" alt="MIAR" className="h-9 w-9 rounded-xl" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">Olá, {username || user?.email?.split('@')[0] || 'Garçom'}</p>
            <p className="truncate text-xs text-muted-foreground">{scope?.location.name || 'Salão'}</p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Garçom</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl">{children}</main>

      <nav aria-label="Navegação do garçom" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-stretch justify-around">
          {visible.map((item) => {
            const active = location.pathname === item.path;
            const Icon = item.icon;
            return <Link key={item.path} to={item.path} className={`flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <Icon className="h-5 w-5" />{item.label}
            </Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
