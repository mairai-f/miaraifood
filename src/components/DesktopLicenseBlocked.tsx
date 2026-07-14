import { HardDriveDownload, KeyRound, RefreshCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { ThemeModeToggle } from '@/components/ThemeModeToggle';

const SALES_PAGE_URL = 'https://www.happycashsite.com.br/#planos';

export function DesktopLicenseBlocked() {
  const { logout } = useAuth();
  const { error, code, planId, refresh, validUntil, validationExpiresAt } = useDesktopRuntime();
  const isOfflineValidationExpired = code === 'OFFLINE_VALIDATION_EXPIRED';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3fb] p-6 dark:bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(94,121,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(12,184,225,0.14),_transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(20,184,212,0.11),_transparent_42%)]" />
      <ThemeModeToggle compact className="absolute right-4 top-4 z-20 bg-card/80 backdrop-blur" />
      <Card className="relative w-full max-w-2xl rounded-[28px] border-border bg-card/88 shadow-[0_28px_80px_rgba(29,78,216,0.13)] backdrop-blur-xl dark:bg-card/95">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <KeyRound className="h-5 w-5" />
            </span>
            <CardTitle className="text-2xl">Licenca desktop indisponivel</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            {isOfflineValidationExpired
              ? 'O prazo de validacao offline terminou. Conecte o app a internet para renovar o acesso local.'
              : 'O aplicativo desktop do HappyCash funciona para contas com plano PRO ou HappyCashFood Offline em status ativo, com pagamento confirmado e licenca validada no backend.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="font-medium text-foreground">{error || 'Sua conta ainda nao esta apta para usar o desktop.'}</p>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p>Plano atual: {planId || 'nao identificado'}</p>
              <p>Codigo: {code || 'sem codigo'}</p>
              <p>Validade atual: {validUntil ? new Date(validUntil).toLocaleString('pt-BR') : 'sem validade ativa'}</p>
              {validationExpiresAt && (
                <p>Limite offline local: {new Date(validationExpiresAt).toLocaleString('pt-BR')}</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/70 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Como liberar</p>
            <p className="mt-1">
              {isOfflineValidationExpired
                ? 'Reconecte o desktop e clique em validar novamente. Depois disso, o modo offline volta a contar um novo prazo local de 5 dias.'
                : 'Ative o plano PRO ou HappyCashFood Offline no site e aguarde a confirmacao do pagamento. Assim que o status ficar ativo, o desktop volta a validar automaticamente.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                window.electronAPI?.openExternal(SALES_PAGE_URL);
              }}
              className="rounded-2xl"
            >
              <HardDriveDownload className="mr-2 h-4 w-4" />
              Abrir pagina dos planos
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
