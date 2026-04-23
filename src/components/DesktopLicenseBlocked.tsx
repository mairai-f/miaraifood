import { HardDriveDownload, KeyRound, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';

const SALES_PAGE_URL = 'https://happycashsite.vercel.app/#planos';

export function DesktopLicenseBlocked() {
  const { logout } = useAuth();
  const { error, code, planId, validUntil, refresh } = useDesktopRuntime();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl border-border/70">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <KeyRound className="h-5 w-5" />
            <CardTitle className="text-2xl">Licenca desktop indisponivel</CardTitle>
          </div>
          <CardDescription>
            O aplicativo desktop do HappyCash so funciona para contas com plano PRO ativo e licenca validada no backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-background/70 p-4">
            <p className="font-medium text-foreground">{error || 'Sua conta ainda nao esta apta para usar o desktop.'}</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Plano atual: {planId || 'nao identificado'}</p>
              <p>Codigo: {code || 'sem codigo'}</p>
              <p>Validade atual: {validUntil ? new Date(validUntil).toLocaleString('pt-BR') : 'sem validade ativa'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como liberar</p>
            <p className="mt-1">Ative o plano PRO no site. Assim que o pagamento for confirmado, o desktop volta a validar automaticamente.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                window.electronAPI?.openExternal(SALES_PAGE_URL);
              }}
            >
              <HardDriveDownload className="mr-2 h-4 w-4" />
              Abrir pagina do plano PRO
            </Button>
            <Button type="button" variant="outline" onClick={() => void refresh()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Validar novamente
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
