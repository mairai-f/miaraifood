import { useCallback, useEffect, useState } from 'react';
import { Clock3, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { CompanyProfileCard } from '@/components/CompanyProfileCard';
import { OperatorManagementPanel } from '@/components/OperatorManagementPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { useData } from '@/contexts/DataContext';
import { useCurrentSubscription } from '@/hooks/use-current-subscription';
import { supabase } from '@/integrations/supabase/client';
import {
  checkDesktopUpdates,
  getOfflineStatus,
  listOfflineConflicts,
  readDesktopUpdateStatus,
  resolveOfflineConflict,
  type DesktopUpdateStatus,
  type OfflineConflictRecord,
} from '@/lib/offlineConcentrator';
import { getSubscriptionEndAt } from '@/lib/subscriptionStatus';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const CREATE_OPERATOR_MODAL = 'cadastrar-operador';
const RESET_CONFIRM_TEXT = 'ZERAR';
type ResetTarget = 'financial' | 'reports';

interface ResetActionResponse {
  success?: boolean;
  deleted?: {
    sales?: number;
    saleItems?: number;
    expenses?: number;
    payments?: number;
    debtEntries?: number;
  };
  error?: string;
}

const planLabels: Record<string, string> = {
  demo: 'Demo 3 Horas',
  fiado: 'Plano Fiado',
  completo: 'Plano Completo',
  pro: 'Plano PRO',
};

export default function Settings() {
  const { session, ownerUserId } = useAuth();
  const { isDesktop, offlineEnabled, validUntil: desktopValidUntil, refresh: refreshDesktopLicense } = useDesktopRuntime();
  const { refetch } = useData();
  const { subscription, countdown, statusLabel, loading: loadingSubscription } = useCurrentSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const isCreateOperatorModalOpen = searchParams.get('modal') === CREATE_OPERATOR_MODAL;
  const [resetTarget, setResetTarget] = useState<ResetTarget | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [resetError, setResetError] = useState('');
  const [resettingData, setResettingData] = useState(false);
  const [offlineRuntime, setOfflineRuntime] = useState<Awaited<ReturnType<typeof getOfflineStatus>> | null>(null);
  const [offlineConflictCount, setOfflineConflictCount] = useState(0);
  const [offlineConflicts, setOfflineConflicts] = useState<OfflineConflictRecord[]>([]);
  const [loadingOfflineStatus, setLoadingOfflineStatus] = useState(false);
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [checkingDesktopUpdate, setCheckingDesktopUpdate] = useState(false);

  const loadOfflineRuntime = useCallback(async () => {
    if (!isDesktop || !ownerUserId) {
      setOfflineRuntime(null);
      setOfflineConflictCount(0);
      setOfflineConflicts([]);
      return;
    }

    setLoadingOfflineStatus(true);

    try {
      const [runtimeStatus, conflicts] = await Promise.all([
        getOfflineStatus(ownerUserId),
        listOfflineConflicts(ownerUserId),
      ]);

      setOfflineRuntime(runtimeStatus);
      setOfflineConflicts(conflicts);
      setOfflineConflictCount(conflicts.filter(conflict => !conflict.resolvedAt).length);
    } finally {
      setLoadingOfflineStatus(false);
    }
  }, [isDesktop, ownerUserId]);

  const loadDesktopUpdateRuntime = useCallback(async () => {
    if (!isDesktop) {
      setDesktopUpdateStatus(null);
      return;
    }

    const nextStatus = await readDesktopUpdateStatus();
    setDesktopUpdateStatus(nextStatus);
  }, [isDesktop]);

  useEffect(() => {
    void loadOfflineRuntime();
    void loadDesktopUpdateRuntime();

    if (!isDesktop || !ownerUserId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOfflineRuntime();
      void loadDesktopUpdateRuntime();
    }, 20_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDesktop, loadDesktopUpdateRuntime, loadOfflineRuntime, ownerUserId]);

  const handleCreateDialogOpenChange = (open: boolean) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (open) {
      nextSearchParams.set('modal', CREATE_OPERATOR_MODAL);
    } else {
      nextSearchParams.delete('modal');
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const resolveFunctionErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: ResetActionResponse
  ) => {
    let functionErrorMessage = data?.error || fallbackMessage;

    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
        functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
      } catch {
        functionErrorMessage = error.context.status === 401
          ? 'Sua sessão expirou. Entre novamente para continuar.'
          : functionErrorMessage;
      }
    }

    return functionErrorMessage;
  }, []);

  const resetResetDialogState = useCallback(() => {
    setAdminEmail('');
    setAdminPassword('');
    setConfirmationText('');
    setResetError('');
    setResetTarget(null);
  }, []);

  const handleResetDialogOpenChange = useCallback((open: boolean) => {
    setResetDialogOpen(open);
    if (!open) {
      resetResetDialogState();
    }
  }, [resetResetDialogState]);

  const handleResetFinancialAndReports = async () => {
    if (!resetTarget) {
      setResetError('Selecione o tipo de limpeza que deseja executar.');
      return;
    }

    if (!session?.access_token) {
      setResetError('Sua sessão expirou. Faça login novamente.');
      return;
    }

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setResetError('Informe login e senha do administrador.');
      return;
    }

    if (confirmationText.trim().toUpperCase() !== RESET_CONFIRM_TEXT) {
      setResetError('Digite ZERAR para confirmar a limpeza.');
      return;
    }

    setResetError('');
    setResettingData(true);

    try {
      const action = resetTarget === 'financial' ? 'reset_financial' : 'reset_reports';

      const { data, error } = await supabase.functions.invoke<ResetActionResponse>('manage-operators', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action,
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
        },
      });

      if (error || !data?.success) {
        const fallbackMessage = resetTarget === 'financial'
          ? 'Não foi possível zerar o financeiro.'
          : 'Não foi possível zerar os relatórios.';
        const message = await resolveFunctionErrorMessage(error, fallbackMessage, data);
        setResetError(message);
        toast.error(message);
        return;
      }

      await refetch();

      const deleted = data.deleted ?? {};
      if (resetTarget === 'financial') {
        toast.success(
          `Financeiro zerado: ${deleted.expenses ?? 0} despesa(s), ${deleted.debtEntries ?? 0} fiado(s), ${deleted.payments ?? 0} pagamento(s).`
        );
      } else {
        toast.success(
          `Relatórios zerados: ${deleted.sales ?? 0} venda(s) e ${deleted.saleItems ?? 0} item(ns) de venda.`
        );
      }
      handleResetDialogOpenChange(false);
    } catch {
      const fallbackMessage = 'Não foi possível concluir a limpeza agora. Tente novamente.';
      setResetError(fallbackMessage);
      toast.error(fallbackMessage);
    } finally {
      setResettingData(false);
    }
  };

  const openResetDialog = useCallback((target: ResetTarget) => {
    setResetTarget(target);
    setResetError('');
    setResetDialogOpen(true);
  }, []);

  const handleResolveOfflineConflict = useCallback(async (conflictId: string) => {
    try {
      await resolveOfflineConflict(conflictId, true);
      await loadOfflineRuntime();
      toast.success('Conflito marcado como resolvido no concentrador local.');
    } catch {
      toast.error('Nao foi possivel atualizar o status do conflito offline.');
    }
  }, [loadOfflineRuntime]);

  const handleCheckDesktopUpdates = useCallback(async () => {
    setCheckingDesktopUpdate(true);

    try {
      const status = await checkDesktopUpdates();
      setDesktopUpdateStatus(status);

      if (status?.status === 'downloaded') {
        toast.success(`Atualizacao ${status.downloadedVersion || ''} pronta para instalar.`);
      } else if (status?.status === 'downloading') {
        toast.success(`Atualizacao ${status.availableVersion || ''} encontrada. Download iniciado em segundo plano.`);
      } else if (status?.status === 'idle') {
        toast.success('Aplicativo desktop ja esta na versao mais recente.');
      } else if (status?.status === 'disabled') {
        toast.message('O auto update fica desativado durante o desenvolvimento local.');
      } else if (status?.status === 'error') {
        toast.error(status.error || 'Falha ao verificar atualizacoes do desktop.');
      }
    } catch {
      toast.error('Nao foi possivel verificar atualizacoes do desktop agora.');
    } finally {
      setCheckingDesktopUpdate(false);
    }
  }, []);

  const resetTitle = resetTarget === 'financial'
    ? 'Confirmar limpeza de financeiro'
    : 'Confirmar limpeza de relatórios';

  const resetDescription = resetTarget === 'financial'
    ? 'Serão removidos despesas, fiados e pagamentos da loja.'
    : 'Serão removidas vendas e itens vendidos usados nos relatórios.';
  const currentPlanLabel = subscription?.plan_id ? planLabels[subscription.plan_id] || subscription.plan_id : 'Sem plano ativo';
  const currentDeadline = getSubscriptionEndAt(subscription);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configuracoes
        </h1>
        <p className="page-subtitle">
          Gerencie acessos da loja e abra o cadastro de operadores pelo seu nome no menu lateral.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              Licenca e validade
            </CardTitle>
            {!loadingSubscription && <Badge variant={countdown.badgeVariant}>{statusLabel}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Marcador rapido para acompanhar quanto tempo falta no plano atual antes do vencimento.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSubscription ? (
            <div className="text-sm text-muted-foreground">Carregando status da assinatura...</div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plano atual</p>
                  <p className="mt-2 font-semibold">{currentPlanLabel}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Marcador</p>
                  <p className="mt-2 font-semibold">{countdown.markerLabel || 'Sem prazo ativo'}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Valido ate</p>
                  <p className="mt-2 font-semibold">
                    {currentDeadline ? new Date(currentDeadline).toLocaleString('pt-BR') : 'Sem vencimento definido'}
                  </p>
                </div>
              </div>

              {countdown.remainingLabel && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{countdown.markerLabel}</p>
                  <p className="mt-1">{countdown.remainingLabel}</p>
                  {subscription?.plan_id === 'pro' && !countdown.isExpired && (
                    <p className="mt-2 text-primary">
                      O plano PRO fica apto para liberar o download do desktop na area logada do site.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {isDesktop && (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Desktop e concentrador offline
              </CardTitle>
              <Badge variant={offlineEnabled ? 'default' : 'outline'}>
                {offlineEnabled ? 'Offline liberado' : 'Offline bloqueado'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Status local do app desktop, fila de sincronizacao e validade da licenca em runtime.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Versao desktop</p>
                <p className="mt-2 font-semibold">{offlineRuntime?.runtime.appVersion || 'Nao identificado'}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fila pendente</p>
                <p className="mt-2 font-semibold">{offlineRuntime?.pendingCount ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conflitos</p>
                <p className="mt-2 font-semibold">{offlineConflictCount}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Licenca desktop</p>
                <p className="mt-2 font-semibold">
                  {desktopValidUntil ? new Date(desktopValidUntil).toLocaleString('pt-BR') : 'Sem validade ativa'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              <p>Ultimo snapshot local: {offlineRuntime?.snapshotUpdatedAt ? new Date(offlineRuntime.snapshotUpdatedAt).toLocaleString('pt-BR') : 'ainda nao salvo'}</p>
              <p className="mt-1">Banco local: {offlineRuntime?.runtime.databasePath || 'nao identificado'}</p>
              <p className="mt-1">Canal de update: {desktopUpdateStatus?.channel || offlineRuntime?.runtime.updateChannel || 'latest'}</p>
              <p className="mt-1">
                Status do update: {desktopUpdateStatus?.status || 'idle'}
                {desktopUpdateStatus?.availableVersion ? ` • nova versao ${desktopUpdateStatus.availableVersion}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => void loadOfflineRuntime()} disabled={loadingOfflineStatus}>
                Atualizar status offline
              </Button>
              <Button type="button" variant="outline" onClick={() => void refreshDesktopLicense()}>
                Revalidar licenca desktop
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleCheckDesktopUpdates()} disabled={checkingDesktopUpdate}>
                {checkingDesktopUpdate ? 'Verificando update...' : 'Verificar atualizacao'}
              </Button>
            </div>

            {offlineConflicts.length > 0 && (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Conflitos pendentes do concentrador</p>
                  <p className="text-sm text-muted-foreground">
                    Revise os itens abaixo, ajuste o cadastro remoto se necessario e marque como resolvido quando a causa for tratada.
                  </p>
                </div>

                <div className="space-y-3">
                  {offlineConflicts.slice(0, 5).map(conflict => (
                    <div key={conflict.id} className="rounded-lg border border-border/70 bg-background/80 p-3 text-sm">
                      <p className="font-medium text-foreground">{conflict.operationType}</p>
                      <p className="mt-1 text-muted-foreground">{conflict.message}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Registrado em {new Date(conflict.createdAt).toLocaleString('pt-BR')}
                        {conflict.resolvedAt ? ` • resolvido em ${new Date(conflict.resolvedAt).toLocaleString('pt-BR')}` : ''}
                      </p>
                      {!conflict.resolvedAt && (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleResolveOfflineConflict(conflict.id)}
                          >
                            Marcar como resolvido
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CompanyProfileCard />

      <OperatorManagementPanel
        createDialogOpen={isCreateOperatorModalOpen}
        onCreateDialogOpenChange={handleCreateDialogOpenChange}
      />

      <Card className="border-destructive/30">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <ShieldAlert className="h-4 w-4" />
            Zona de risco
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha exatamente o que deseja zerar. Cada ação pede confirmação e credencial de administrador.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Os clientes, produtos e operadores continuam cadastrados.
          </p>

          <Dialog open={resetDialogOpen} onOpenChange={handleResetDialogOpenChange}>
            <div className="flex flex-wrap gap-2">
              <DialogTrigger asChild>
                <Button variant="destructive" onClick={() => openResetDialog('financial')}>
                  Zerar financeiro
                </Button>
              </DialogTrigger>
              <DialogTrigger asChild>
                <Button variant="destructive" onClick={() => openResetDialog('reports')}>
                  Zerar relatórios
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{resetTitle}</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Ação irreversível: os dados apagados não poderão ser recuperados. {resetDescription}
                </div>

                <div className="space-y-1">
                  <Label>Login do administrador (email)</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    placeholder="admin@empresa.com"
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Senha do administrador</Label>
                  <PasswordInput
                    value={adminPassword}
                    onChange={event => setAdminPassword(event.target.value)}
                    placeholder="Digite a senha"
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Confirmação final</Label>
                  <Input
                    value={confirmationText}
                    onChange={event => setConfirmationText(event.target.value)}
                    placeholder='Digite "ZERAR" para confirmar'
                  />
                </div>

                {resetError && (
                  <p className="text-sm font-medium text-destructive">{resetError}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleResetDialogOpenChange(false)}
                  disabled={resettingData}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleResetFinancialAndReports()}
                  disabled={resettingData}
                >
                  {resettingData ? 'Zerando...' : 'Confirmar e zerar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
