import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StockInsightsNavigation } from '@/components/stock/StockInsightsNavigation';

type StockInsightsPageLayoutProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function StockInsightsPageLayout({ title, description, children }: StockInsightsPageLayoutProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <Button asChild variant="outline" size="sm" className="w-full md:w-auto">
          <Link to="/estoque">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao estoque
          </Link>
        </Button>
      </div>

      <StockInsightsNavigation />
      {children}
    </div>
  );
}
