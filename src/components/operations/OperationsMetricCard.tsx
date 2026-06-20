import { ChevronRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

type OperationsMetricCardProps = {
  label: string;
  value: string | number;
  onClick: () => void;
};

export function OperationsMetricCard({ label, value, onClick }: OperationsMetricCardProps) {
  return (
    <button type="button" className="group w-full text-left" onClick={onClick} aria-label={`Ver detalhes de ${label}`}>
      <Card className="h-full transition-colors group-hover:border-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </CardContent>
      </Card>
    </button>
  );
}
