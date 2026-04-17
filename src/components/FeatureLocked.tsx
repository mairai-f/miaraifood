import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlanAccess } from '@/contexts/PlanContext';

const planLabels: Record<string, string> = {
  demo: 'Demo 3 Horas',
  fiado: 'Plano Fiado - 30 dias',
  completo: 'Plano Completo - 30 dias',
  pro: 'Plano PRO - 30 dias',
};

export function FeatureLocked() {
  const { planId } = usePlanAccess();
  const planLabel = planId ? planLabels[planId] || planId : 'Sem plano ativo';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Recurso indisponível no seu plano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Seu acesso atual é <strong className="text-foreground">{planLabel}</strong>. Esse recurso não está liberado
            para este plano.
          </p>
          <p className="text-sm text-muted-foreground">
            Se você acabou de trocar de plano, atualize a sessão. Caso contrário, faça o upgrade para continuar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="sm:flex-1">
              <Link to="/">Voltar ao painel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
