import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePlanAccess } from '@/contexts/PlanContext';
import { useCurrentSubscription } from '@/hooks/use-current-subscription';

const planLabels: Record<string, string> = {
  demo: 'Demo 12 Horas',
  fiado: 'Plano Fiado - 30 dias',
  completo: 'Plano Completo - 30 dias',
  pro: 'Plano PRO - 30 dias',
};

const HAPPY_CASH_SITE_PAYMENT_URL = 'https://happycashsite.vercel.app/dashboard';

export function FeatureLocked() {
  const { planId } = usePlanAccess();
  const { subscription } = useCurrentSubscription();
  const planLabel = planId ? planLabels[planId] || planId : 'Sem plano ativo';
  const demoExpired = subscription?.plan_id === 'demo' && subscription?.status === 'expired';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <ShieldAlert className="h-6 w-6 text-primary" />
            {demoExpired ? 'Sua demo expirou' : 'Recurso indisponível no seu plano'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoExpired ? (
            <>
              <p className="text-sm text-muted-foreground">
                O período de teste gratuito de 12 horas foi encerrado. Para continuar usando o sistema, agora é preciso ativar um plano pago.
              </p>
              <p className="text-sm text-muted-foreground">
                Entre no site da sua conta, escolha um plano e volte ao sistema depois da ativação.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Seu acesso atual é <strong className="text-foreground">{planLabel}</strong>. Esse recurso não está liberado
                para este plano.
              </p>
              <p className="text-sm text-muted-foreground">
                Se você acabou de trocar de plano, atualize a sessão. Caso contrário, faça o upgrade para continuar.
              </p>
            </>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            {demoExpired ? (
              <>
                <Button asChild className="sm:flex-1">
                  <a href={HAPPY_CASH_SITE_PAYMENT_URL} target="_blank" rel="noreferrer">
                    Ativar plano no site
                  </a>
                </Button>
                <Button asChild variant="outline" className="sm:flex-1">
                  <Link to="/configuracoes">Ver situação da conta</Link>
                </Button>
              </>
            ) : (
              <Button asChild className="sm:flex-1">
                <Link to="/">Voltar ao painel</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
