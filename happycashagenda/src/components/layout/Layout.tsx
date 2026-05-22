import { ReactNode } from 'react';
import { Header } from './Header';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { useAuth } from '@/hooks/useAuth';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import { motion } from 'framer-motion';
import { FloatingDock, DockItem } from '@/components/ui/floating-dock';
import { Home, Calendar, ShoppingBag, ClipboardList, LayoutDashboard } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  const { user, isAdmin } = useAuth();
  const { settings } = useAgendaBranding();
  const { isCurrentlyOpen } = useBusinessHours(settings.storeAccountId);
  const publicPath = (path: string) => withAgendaPublicSearch(path, settings);

  const dockItems: DockItem[] = [
    { title: 'Início', icon: <Home className="h-5 w-5" />, href: '/' },
    { title: 'Agendar', icon: <Calendar className="h-5 w-5" />, href: publicPath('/agendamento') },
    { title: 'Produtos', icon: <ShoppingBag className="h-5 w-5" />, href: publicPath('/produtos') },
    ...(user ? [{ title: 'Agendamentos', icon: <ClipboardList className="h-5 w-5" />, href: publicPath('/meus-agendamentos') }] : []),
    ...(isAdmin ? [{ title: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, href: '/painel' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {showHeader && <Header />}

      {/* Status Banner */}
      {showHeader && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`fixed top-16 left-0 right-0 z-40 py-1.5 text-center text-xs font-medium ${
            isCurrentlyOpen
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-b border-rose-500/20'
          }`}
        >
          {isCurrentlyOpen
            ? `${settings.displayName} aberto agora`
            : `${settings.displayName} fechado no momento`}
        </motion.div>
      )}

      <main className={showHeader ? 'pt-24 pb-20' : ''}>
        {children}
      </main>

      {showHeader && <FloatingDock items={dockItems} />}
    </div>
  );
}
