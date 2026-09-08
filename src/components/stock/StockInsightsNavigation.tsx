import { BarChart3, Package, ScrollText } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useStockAnalytics } from '@/hooks/useStockAnalytics';
import { cn } from '@/lib/utils';

const sections = [
  {
    path: '/estoque/movimentacoes',
    title: 'Movimentações',
    description: 'Histórico de entradas, saídas e ajustes.',
    icon: ScrollText,
  },
  {
    path: '/estoque/curva-abc',
    title: 'Curva ABC',
    description: 'Produtos mais relevantes dos últimos 90 dias.',
    icon: BarChart3,
  },
  {
    path: '/estoque/sugestoes-compra',
    title: 'Sugestões de compras',
    description: 'Itens com risco de ruptura e reposição sugerida.',
    icon: Package,
  },
] as const;

export function StockInsightsNavigation() {
  const location = useLocation();
  const { abcRows, purchaseSuggestions, stockMovementsCount } = useStockAnalytics();

  const countByPath: Record<(typeof sections)[number]['path'], string> = {
    '/estoque/movimentacoes': `${stockMovementsCount} registros`,
    '/estoque/curva-abc': `${abcRows.length} produtos`,
    '/estoque/sugestoes-compra': `${purchaseSuggestions.length} sugestões`,
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {sections.map((section) => {
        const active = location.pathname === section.path;

        return (
          <Link
            key={section.path}
            to={section.path}
            className={cn(
              'rounded-xl border p-4 transition-colors',
              active
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border/60 bg-card hover:border-primary/40 hover:bg-accent/40',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{section.title}</p>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>
              <section.icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <p className={cn('mt-3 text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
              {countByPath[section.path]}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
