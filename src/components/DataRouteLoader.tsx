import { Loader2 } from 'lucide-react';

interface DataRouteLoaderProps {
  label?: string;
}

export function DataRouteLoader({ label = 'Carregando dados da tela...' }: DataRouteLoaderProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}
