import { ChevronRight, type LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ReportMetricCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  onClick: () => void;
};

export function ReportMetricCard({ label, value, icon: Icon, onClick }: ReportMetricCardProps) {
  return (
    <button type="button" className="group w-full text-left" onClick={onClick} aria-label={`Ver detalhes de ${label}`}>
      <Card className="h-full border-border/50 transition-colors group-hover:border-primary/60 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2">
        <CardHeader className="flex flex-row items-center justify-between px-3 pb-1 pt-3">
          <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
          <Icon className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2 px-3 pb-3">
          <p className="text-lg font-bold">{value}</p>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </CardContent>
      </Card>
    </button>
  );
}
