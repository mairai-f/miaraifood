import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { BarChart3, Building2, Calculator, ChevronRight, ClipboardList, Clock3, CreditCard, DatabaseBackup, Download, FileText, Gift, Laptop, Loader2, MapPinned, PackageSearch, Settings as SettingsIcon, ShieldAlert, Trash2, UserCog, WalletCards } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { useAuth } from '@/contexts/AuthContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePermissions } from '@/contexts/usePermissions';
import { usePlanAccess } from '@/contexts/PlanContext';
import { useData } from '@/contexts/DataContext';
import { useCurrentSubscription } from '@/hooks/use-current-subscription';
import { supabase } from '@/integrations/supabase/client';
import {
  checkDesktopUpdates,
  getOfflineStatus,
  installDesktopUpdate,
  listOfflineConflicts,
  onDesktopUpdateStatus,
  openDesktopUpdateDownload,
  readDesktopUpdateStatus,
  retryOfflineOperation,
  resolveOfflineConflict,
  type DesktopUpdateStatus,
  type OfflineConflictRecord,
} from '@/lib/offlineConcentrator';
import { getSubscriptionEndAt } from '@/lib/subscriptionStatus';
import { buildBackupPayload, downloadJsonBackup, type BackupPayload } from '@/lib/backupExport';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import { isRuntimeScopeAllowed, type ErpPermissionKey, type RuntimeScope } from '@/lib/permissions';
import { canUseDesktopFiscalModule } from '@/lib/fiscalAccess';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { StorePaymentSettingsPanel } from '@/components/StorePaymentSettingsPanel';

const CompanyProfileCard = lazy(() =>
  import('@/components/CompanyProfileCard').then((module) => ({
    default: module.CompanyProfileCard,
  })),
);

const PasskeySettingsCard = lazy(() =>
  import('@/components/PasskeySettingsCard').then((module) => ({
    default: module.PasskeySettingsCard,
  })),
);

const PrinterSettingsCard = lazy(() =>
  import('@/components/PrinterSettingsCard').then((module) => ({
    default: module.PrinterSettingsCard,
  })),
);

const OperatorManagementPanel = lazy(() =>
  import('@/components/OperatorManagementPanel').then((module) => ({
    default: module.OperatorManagementPanel,
  })),
);

const LocationsTerminalsPanel = lazy(() =>
  import('@/components/LocationsTerminalsPanel').then((module) => ({
    default: module.LocationsTerminalsPanel,
  })),
);

const CatalogConfigurationPanel = lazy(() =>
  import('@/components/CatalogConfigurationPanel').then((module) => ({
    default: module.CatalogConfigurationPanel,
  })),
);

const RESET_CONFIRM_TEXT = 'ZERAR';
const RESTORE_CONFIRM_TEXT = 'RESTAURAR';
type ResetTarget = 'financial' | 'reports';
type SettingsSection = 'empresa' | 'backup' | 'colaboradores' | 'filiais' | 'catalogo' | 'desktop' | 'risco' | 'pagamentos' | 'mesas';

interface SettingsNavigationItem {
  path: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
  featureKey: string;
  permissionKey: ErpPermissionKey;
  runtimeScope: RuntimeScope;
  fiscalDesktopAccess?: boolean;
  section?: SettingsSection;
}

const settingsNavigationItems: SettingsNavigationItem[] = [
  { path: '/configuracoes/empresa', section: 'empresa', title: 'Empresa', description: 'Dados, identidade e configuracao de impressao.', icon: Building2, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'both' },
  { path: '/configuracoes/backup', section: 'backup', title: 'Backup', description: 'Exportacao e restauracao dos dados.', icon: DatabaseBackup, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'both' },
  { path: '/configuracoes/colaboradores', section: 'colaboradores', title: 'Colaboradores', description: 'Cadastro, foto, endereco, acessos e escala basica.', icon: UserCog, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'both' },
  { path: '/configuracoes/filiais', section: 'filiais', title: 'Filiais e terminais', description: 'Lojas, terminais e escopo operacional.', icon: MapPinned, featureKey: 'settings.manage', permissionKey: 'multi_store.manage', runtimeScope: 'web' },
  { path: '/configuracoes/catalogo', section: 'catalogo', title: 'Catalogo avancado', description: 'Marcas, grupos, unidades e tabelas.', icon: PackageSearch, featureKey: 'settings.manage', permissionKey: 'products.manage', runtimeScope: 'web' },
  { path: '/configuracoes/desktop', section: 'desktop', title: 'Desktop e offline', description: 'Atualizacoes, sincronizacao e conflitos.', icon: Laptop, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'desktop' },
  { path: '/configuracoes/risco', section: 'risco', title: 'Zona de risco', description: 'Limpeza protegida de dados operacionais.', icon: ShieldAlert, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'both' },
  { path: '/configuracoes/pagamentos', section: 'pagamentos', title: 'Pagamentos', description: 'Pix e provedores de pagamento do estabelecimento.', icon: CreditCard, featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'web' },
  { path: '/configuracoes/mesas', section: 'mesas', title: 'Mesas e QR Codes', description: 'Gerencie mesas e imprima QR Codes.', icon: ClipboardList, featureKey: 'food.tables', permissionKey: 'food.tables.manage', runtimeScope: 'web' },
  { path: '/configuracoes/qrmenu', title: 'QR Menu', description: 'Cardápio, categorias, fotos e disponibilidade.', icon: ClipboardList, featureKey: 'food.qrmenu', permissionKey: 'food.qrmenu.manage', runtimeScope: 'web' },
  { path: '/financeiro', title: 'Financeiro', description: 'Despesas, fiados e fluxo financeiro.', icon: WalletCards, featureKey: 'financial.manage', permissionKey: 'financial.view', runtimeScope: 'both' },
  { path: '/notas', title: 'Notas', description: 'Configuracao e emissao fiscal.', icon: FileText, featureKey: 'notes.manage', permissionKey: 'fiscal.view', runtimeScope: 'both', fiscalDesktopAccess: true },
  { path: '/relatorios', title: 'Relatorios', description: 'Vendas, caixa, estoque e indicadores.', icon: BarChart3, featureKey: 'reports.view', permissionKey: 'reports.view', runtimeScope: 'both' },
  { path: '/operacoes', title: 'Operacoes', description: 'Compras, fornecedores e reposicao.', icon: ClipboardList, featureKey: 'financial.manage', permissionKey: 'purchases.view', runtimeScope: 'both' },
  { path: '/recompensas', title: 'Recompensas', description: 'Fidelidade e beneficios dos clientes.', icon: Gift, featureKey: 'rewards.manage', permissionKey: 'rewards.manage', runtimeScope: 'both' },
  { path: '/precificacao', title: 'Precificacao', description: 'Custos, margens e regras de preco.', icon: Calculator, featureKey: 'pricing.manage', permissionKey: 'pricing.view', runtimeScope: 'both' },
  { path: '/excluidos', title: 'Excluidos', description: 'Consulte cadastros removidos.', icon: Trash2, featureKey: 'deleted.view', permissionKey: 'deleted.view', runtimeScope: 'both' },
];

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

type BackupRestoreTableClient = {
  from: (table: string) => {
    upsert: (
      rows: Array<Record<string, unknown>>,
      options: { onConflict: string }
    ) => Promise<{ error: Error | null }>;
  };
};

const backupRestoreDb = supabase as unknown as BackupRestoreTableClient;

const planLabels: Record<string, string> = {
  demo: 'Demo 3 Dias',
  fiado: 'Plano Fiado',
  completo: 'Plano Completo',
  pro: 'Plano PRO',
};

const formatBytes = (value: number | null | undefined) => {
  if (!value || value <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const SettingsSectionLoader = ({ label }: { label: string }) => (
  <Card>
    <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </CardContent>
  </Card>
);

export default function Settings() {
  const { session, ownerUserId } = useAuth();
  const { isDesktop, licensed: desktopLicensed, offlineEnabled, validUntil: desktopValidUntil, refresh: refreshDesktopLicense } = useDesktopRuntime();
  const { hasPermission } = usePermissions();
  const { hasFeature, planId } = usePlanAccess();
  const data = useData();
  const { refetch, syncNow, loading: dataLoading } = data;
  const { subscription, countdown, statusLabel, loading: loadingSubscription } = useCurrentSubscription();
  const { section: routeSection } = useParams<{ section?: string }>();
  const location = useLocation();
  const routeSectionFromPath = location.pathname.startsWith('/configuracoes/')
    ? location.pathname.split('/').filter(Boolean).at(-1)
    : undefined;
  const matchedSettingsSection = settingsNavigationItems.find((item) =>
    item.section === (routeSection ?? routeSectionFromPath)
  )?.section ?? null;
  const activeSettingsSection: SettingsSection | null = matchedSettingsSection;
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
  const [syncingOfflineNow, setSyncingOfflineNow] = useState(false);
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [checkingDesktopUpdate, setCheckingDesktopUpdate] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreBackup, setRestoreBackup] = useState<BackupPayload | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreAdminEmail, setRestoreAdminEmail] = useState('');
  const [restoreAdminPassword, setRestoreAdminPassword] = useState('');
  const [restoreConfirmationText, setRestoreConfirmationText] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [restoringBackup, setRestoringBackup] = useState(false);
  const pendingOfflineConflicts = useMemo(
    () => offlineConflicts.filter(conflict => !conflict.resolvedAt),
    [offlineConflicts],
  );
  const resolvedOfflineConflicts = useMemo(
    () => offlineConflicts.filter(conflict => conflict.resolvedAt),
    [offlineConflicts],
  );

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
  }, [isDesktop, loadDesktopUpdateRuntime, loadOfflineRuntime, ownerUserId]);

  useEffect(() => {
    if (!isDesktop) return;
    return onDesktopUpdateStatus(setDesktopUpdateStatus);
  }, [isDesktop]);

  const handleManualOfflineSync = useCallback(async () => {
    if (!isDesktop || syncingOfflineNow) return;

    setSyncingOfflineNow(true);

    try {
      await syncNow();
      await loadOfflineRuntime();
      toast.success('Sincronizacao do desktop atualizada.');
    } catch (error) {
      console.error('Nao foi possivel sincronizar o desktop agora:', getRedactedLogValue(error));
      toast.error('Nao foi possivel sincronizar o desktop agora.');
    } finally {
      setSyncingOfflineNow(false);
    }
  }, [isDesktop, loadOfflineRuntime, syncNow, syncingOfflineNow]);

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

    return getPublicErrorMessage(functionErrorMessage, fallbackMessage);
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

  const handleRetryOfflineOperation = useCallback(async (operationId: string) => {
    try {
      await retryOfflineOperation(operationId, true);
      await loadOfflineRuntime();
      await refetch();
      toast.success('Operacao reenfileirada para nova sincronizacao.');
    } catch {
      toast.error('Nao foi possivel reenfileirar a operacao offline.');
    }
  }, [loadOfflineRuntime, refetch]);

  const handleCheckDesktopUpdates = useCallback(async () => {
    setCheckingDesktopUpdate(true);

    try {
      const status = await checkDesktopUpdates();
      setDesktopUpdateStatus(status);

      if (status?.status === 'downloaded') {
        toast.success(`Atualizacao ${status.downloadedVersion || ''} pronta para instalar.`);
      } else if (status?.status === 'publishing') {
        toast.message(status.error || 'A nova release ainda esta sendo publicada. O MIAR AI/FOOD vai tentar novamente automaticamente.');
      } else if (status?.status === 'downloading') {
        toast.success(`Atualizacao ${status.availableVersion || ''} encontrada. Acompanhe o download nesta tela.`);
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

  const handleInstallDesktopUpdate = useCallback(async () => {
    try {
      const result = await installDesktopUpdate();

      if (!result?.success) {
        toast.error(result?.error || 'Nenhuma atualizacao pronta para instalar.');
      }
    } catch {
      toast.error('Nao foi possivel iniciar a instalacao da atualizacao.');
    }
  }, []);

  const handleOpenDesktopUpdateDownload = useCallback(async () => {
    try {
      const result = await openDesktopUpdateDownload();

      if (result?.success) {
        toast.success('Area segura de download aberta no site oficial.');
        return;
      }

      toast.error(result?.error || 'Nao foi possivel abrir a area segura de download.');
    } catch {
      toast.error('Nao foi possivel abrir a area segura de download.');
    }
  }, []);

  const handleExportBackup = useCallback(() => {
    downloadJsonBackup(buildBackupPayload({
      clients: data.clients,
      products: data.products,
      debtEntries: data.debtEntries,
      payments: data.payments,
      rewards: data.rewards,
      sales: data.sales,
      saleItems: data.saleItems,
      stockMovements: data.stockMovements,
      expenses: data.expenses,
      pricingRules: data.pricingRules,
      priceHistory: data.priceHistory,
    }));
    toast.success('Backup exportado com sucesso.');
  }, [data]);

  const resetRestoreDialogState = useCallback(() => {
    setRestoreBackup(null);
    setRestoreFileName('');
    setRestoreAdminEmail('');
    setRestoreAdminPassword('');
    setRestoreConfirmationText('');
    setRestoreError('');
    setRestoringBackup(false);
  }, []);

  const handleRestoreDialogOpenChange = useCallback((open: boolean) => {
    setRestoreDialogOpen(open);
    if (open) {
      setRestoreAdminEmail('');
      setRestoreAdminPassword('');
      setRestoreError('');
      return;
    }

    resetRestoreDialogState();
  }, [resetRestoreDialogState]);

  const isBackupPayload = (value: unknown): value is BackupPayload => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<BackupPayload>;
    const backupData = candidate.data;
    if (candidate.source !== 'happycash' || !backupData || typeof backupData !== 'object') return false;

    return [
      'clients',
      'products',
      'debtEntries',
      'payments',
      'rewards',
      'sales',
      'saleItems',
      'stockMovements',
      'expenses',
      'pricingRules',
      'priceHistory',
    ].every(key => Array.isArray((backupData as Record<string, unknown>)[key]));
  };

  const handleRestoreFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isBackupPayload(parsed)) {
        setRestoreBackup(null);
        setRestoreFileName('');
        setRestoreError('Arquivo inválido. Selecione um backup JSON gerado pelo MIAR AI/FOOD.');
        return;
      }

      setRestoreBackup(parsed);
      setRestoreFileName(file.name);
      setRestoreError('');
    } catch {
      setRestoreBackup(null);
      setRestoreFileName('');
      setRestoreError('Não foi possível ler o arquivo JSON.');
    }
  }, []);

  const stripLocalFields = (row: Record<string, unknown>) => {
    const {
      sync_status: _syncStatus,
      sync_error: _syncError,
      code: _code,
      ...rest
    } = row;
    return rest;
  };

  const upsertBackupRows = async (table: string, rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return;
    const { error } = await backupRestoreDb
      .from(table)
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  };

  const handleRestoreBackup = useCallback(async () => {
    if (!restoreBackup) {
      setRestoreError('Selecione um arquivo de backup antes de restaurar.');
      return;
    }

    if (!ownerUserId) {
      setRestoreError('Não foi possível identificar a loja atual.');
      return;
    }

    if (!restoreAdminEmail.trim() || !restoreAdminPassword.trim()) {
      setRestoreError('Informe login e senha do administrador.');
      return;
    }

    if (restoreConfirmationText.trim().toUpperCase() !== RESTORE_CONFIRM_TEXT) {
      setRestoreError('Digite RESTAURAR para confirmar a importação.');
      return;
    }

    setRestoringBackup(true);
    setRestoreError('');

    try {
      if (!session?.access_token) {
        setRestoreError('Sua sessão expirou. Entre novamente para restaurar o backup.');
        return;
      }

      const { data: verificationData, error: verificationError } = await supabase.functions.invoke<{ success?: boolean; error?: string }>('manage-operators', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'verify_admin',
          adminEmail: restoreAdminEmail.trim(),
          adminPassword: restoreAdminPassword,
        },
      });

      if (verificationError || !verificationData?.success) {
        setRestoreError(verificationData?.error || 'Email ou senha inválidos.');
        return;
      }

      const backupData = restoreBackup.data;
      await upsertBackupRows('clients', backupData.clients.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));
      await upsertBackupRows('products', backupData.products.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));
      await upsertBackupRows('rewards', backupData.rewards.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));
      await upsertBackupRows('product_category_pricing_rules', backupData.pricingRules.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        owner_user_id: ownerUserId,
      })));
      await upsertBackupRows('product_price_history', backupData.priceHistory.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        owner_user_id: ownerUserId,
      })));
      await upsertBackupRows('sales', backupData.sales.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));
      await upsertBackupRows('sale_items', backupData.saleItems.map(row => stripLocalFields(row as unknown as Record<string, unknown>)));
      await upsertBackupRows('debt_entries', backupData.debtEntries.map(row => stripLocalFields(row as unknown as Record<string, unknown>)));
      await upsertBackupRows('payments', backupData.payments.map(row => stripLocalFields(row as unknown as Record<string, unknown>)));
      await upsertBackupRows('stock_movements', backupData.stockMovements.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));
      await upsertBackupRows('expenses', backupData.expenses.map(row => ({
        ...stripLocalFields(row as unknown as Record<string, unknown>),
        user_id: ownerUserId,
      })));

      await refetch();
      toast.success('Backup restaurado com sucesso.');
      handleRestoreDialogOpenChange(false);
    } catch (error) {
      console.error('Erro ao restaurar backup:', getRedactedLogValue(error));
      setRestoreError(getPublicErrorMessage(error, 'Não foi possível restaurar o backup.'));
      toast.error('Não foi possível restaurar o backup.');
    } finally {
      setRestoringBackup(false);
    }
  }, [
    handleRestoreDialogOpenChange,
    ownerUserId,
    refetch,
    restoreAdminEmail,
    restoreAdminPassword,
    restoreBackup,
    restoreConfirmationText,
    session?.access_token,
  ]);

  const resetTitle = resetTarget === 'financial'
    ? 'Confirmar limpeza de financeiro'
    : 'Confirmar limpeza de relatórios';

  const resetDescription = resetTarget === 'financial'
    ? 'Serão removidos despesas, fiados e pagamentos da loja.'
    : 'Serão removidas vendas e itens vendidos usados nos relatórios.';
  const currentPlanLabel = subscription?.plan_id ? planLabels[subscription.plan_id] || subscription.plan_id : 'Sem plano ativo';
  const currentDeadline = getSubscriptionEndAt(subscription);
  const updateProgress = Math.max(0, Math.min(100, desktopUpdateStatus?.progress ?? 0));
  const updateIsDownloading = desktopUpdateStatus?.status === 'downloading';
  const updateIsPublishing = desktopUpdateStatus?.status === 'publishing';
  const updateIsDownloaded = desktopUpdateStatus?.status === 'downloaded';
  const updateIsInstalling = desktopUpdateStatus?.status === 'installing';
  const updateHasError = desktopUpdateStatus?.status === 'error';
  const visibleSettingsNavigationItems = settingsNavigationItems.filter((item) => {
    if (!hasPermission(item.permissionKey) || !hasFeature(item.featureKey)) return false;
    if (!isRuntimeScopeAllowed(item.runtimeScope, isDesktop)) return false;
    if (!item.fiscalDesktopAccess) return true;
    return canUseDesktopFiscalModule({
      isDesktop,
      licensed: desktopLicensed,
      planId,
      activation: readDesktopActivation(),
    });
  });
  const activeSettingsTitle = settingsNavigationItems.find((item) => item.section === activeSettingsSection)?.title;

  if (dataLoading) {
    return <DataRouteLoader label="Carregando configuracoes..." />;
  }

  return (
    <div className="space-y-6">
      {updateIsInstalling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-6 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-primary/25 bg-card p-6 text-center shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Atualizando MIAR AI/FOOD</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Instalando a nova versao. O aplicativo vai reiniciar sozinho em instantes.
              </p>
            </div>
            <Progress value={100} className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">Nao feche esta janela.</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          {activeSettingsTitle || 'Configuracoes'}
        </h1>
        {activeSettingsSection && (
          <p className="page-subtitle">Área administrativa aberta separadamente da Central de Configurações.</p>
        )}
      </div>

      {!activeSettingsSection && <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              Licenca e validade
            </CardTitle>
            {!loadingSubscription && <Badge variant={countdown.badgeVariant}>{statusLabel}</Badge>}
          </div>
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
                      Este plano fica apto para liberar o download do desktop na area logada do site.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>}

      {!activeSettingsSection && <section aria-labelledby="settings-navigation-title" className="space-y-3">
        <div>
          <h2 id="settings-navigation-title" className="text-xl font-semibold">Central administrativa</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleSettingsNavigationItems.map((item) => {
            const cardContent = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <item.icon className="h-6 w-6" />
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="mt-5">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-muted-foreground">{item.description}</p>
                </div>
              </>
            );
            const cardClassName = 'group flex min-h-36 flex-col justify-between rounded-xl border border-border/70 bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/60';

            return (
              <Link key={item.path} to={item.path} className={cardClassName}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      </section>}

      {activeSettingsSection === 'pagamentos' && <StorePaymentSettingsPanel />}

      {activeSettingsSection === 'desktop' && isDesktop && (
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

            {(updateIsDownloading || updateIsDownloaded) && (
              <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {updateIsDownloaded ? 'Atualizacao baixada' : 'Baixando atualizacao'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {updateIsDownloaded
                        ? `Versao ${desktopUpdateStatus?.downloadedVersion || desktopUpdateStatus?.availableVersion || 'mais recente'} pronta para instalar.`
                        : `Versao ${desktopUpdateStatus?.availableVersion || 'mais recente'} em download dentro do MIAR AI/FOOD.`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{Math.round(updateProgress)}%</span>
                </div>
                <Progress value={updateIsDownloaded ? 100 : updateProgress} className="h-2.5" />
                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {formatBytes(desktopUpdateStatus?.transferred)} de {formatBytes(desktopUpdateStatus?.total)}
                  </span>
                  {desktopUpdateStatus?.bytesPerSecond ? (
                    <span>{formatBytes(desktopUpdateStatus.bytesPerSecond)}/s</span>
                  ) : null}
                </div>
                {updateIsDownloaded && (
                  <Button type="button" onClick={() => void handleInstallDesktopUpdate()} disabled={updateIsInstalling}>
                    {updateIsInstalling ? 'Atualizando...' : 'Reiniciar e instalar'}
                  </Button>
                )}
              </div>
            )}

            {updateIsPublishing && (
              <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Release em publicacao</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {desktopUpdateStatus?.error || 'A nova release ainda esta sendo publicada. O MIAR AI/FOOD vai tentar novamente automaticamente em instantes.'}
                  </p>
                </div>
              </div>
            )}

            {updateHasError && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Atualizacao nao concluiu automaticamente</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {desktopUpdateStatus?.error || 'O MIAR AI/FOOD nao conseguiu finalizar a instalacao automaticamente.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" onClick={() => void handleCheckDesktopUpdates()} disabled={checkingDesktopUpdate}>
                    Tentar novamente
                  </Button>
                  <Button type="button" onClick={() => void handleOpenDesktopUpdateDownload()}>
                    Abrir download no site
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={() => void handleManualOfflineSync()} disabled={syncingOfflineNow}>
                {syncingOfflineNow ? 'Sincronizando desktop...' : 'Sincronizar desktop agora'}
              </Button>
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

            {pendingOfflineConflicts.length > 0 && (
              <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Conflitos pendentes do concentrador</p>
                  <p className="text-sm text-muted-foreground">
                    Revise os itens abaixo, ajuste o cadastro remoto se necessario e marque como resolvido quando a causa for tratada.
                  </p>
                </div>

                <div className="space-y-3">
                  {pendingOfflineConflicts.slice(0, 5).map(conflict => (
                    <div key={conflict.id} className="rounded-lg border border-border/70 bg-background/80 p-3 text-sm">
                      <p className="font-medium text-foreground">{conflict.operationType}</p>
                      <p className="mt-1 text-muted-foreground">
                        {getPublicErrorMessage(conflict.message, 'Falha ao sincronizar a fila offline.')}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Registrado em {new Date(conflict.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => void handleRetryOfflineOperation(conflict.operationId)}
                        >
                          Tentar novamente
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleResolveOfflineConflict(conflict.id)}
                        >
                          Marcar como resolvido
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingOfflineConflicts.length === 0 && resolvedOfflineConflicts.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Historico de conflitos resolvidos</p>
                  <p className="text-sm text-muted-foreground">
                    Estes itens ja foram tratados no concentrador local e nao contam como pendentes.
                  </p>
                </div>

                <div className="space-y-3">
                  {resolvedOfflineConflicts.slice(0, 5).map(conflict => (
                    <div key={conflict.id} className="rounded-lg border border-border/70 bg-background/80 p-3 text-sm">
                      <p className="font-medium text-foreground">{conflict.operationType}</p>
                      <p className="mt-1 text-muted-foreground">
                        {getPublicErrorMessage(conflict.message, 'Falha ao sincronizar a fila offline.')}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Registrado em {new Date(conflict.createdAt).toLocaleString('pt-BR')}
                        {conflict.resolvedAt ? ` • resolvido em ${new Date(conflict.resolvedAt).toLocaleString('pt-BR')}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSettingsSection === 'empresa' && (
        <Suspense fallback={<SettingsSectionLoader label="Carregando dados da empresa..." />}>
          <>
            <CompanyProfileCard />
            <PasskeySettingsCard />
            <PrinterSettingsCard />
          </>
        </Suspense>
      )}

      {activeSettingsSection === 'backup' && <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4 text-primary" />
            Backup e exportação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Baixe uma cópia local dos dados da loja para segurança, conferência ou migração manual.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="font-semibold">{data.clients.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Produtos</p>
              <p className="font-semibold">{data.products.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">Vendas e fiados</p>
              <p className="font-semibold">{data.sales.length + data.debtEntries.length}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleExportBackup}>
              <Download className="mr-2 h-4 w-4" />Baixar backup JSON
            </Button>

            <Dialog open={restoreDialogOpen} onOpenChange={handleRestoreDialogOpenChange}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline">
                  Restaurar backup JSON
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Restaurar backup JSON</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                    A restauração atualiza ou recria registros pelo ID do backup. Revise o arquivo antes de confirmar.
                  </div>

                  <div className="space-y-1">
                    <Label>Arquivo de backup</Label>
                    <Input type="file" accept="application/json,.json" onChange={event => void handleRestoreFileChange(event)} />
                    {restoreFileName && <p className="text-xs text-muted-foreground">Selecionado: {restoreFileName}</p>}
                  </div>

                  {restoreBackup && (
                    <div className="grid gap-2 rounded-lg border border-border/70 bg-background/70 p-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Clientes</p>
                        <p className="font-semibold">{restoreBackup.data.clients.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Produtos</p>
                        <p className="font-semibold">{restoreBackup.data.products.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vendas/fiados</p>
                        <p className="font-semibold">{restoreBackup.data.sales.length + restoreBackup.data.debtEntries.length}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Login do administrador</Label>
                    <Input
                      type="email"
                      name="settings-restore-admin-login"
                      value={restoreAdminEmail}
                      onChange={event => setRestoreAdminEmail(event.target.value)}
                      placeholder="admin@empresa.com"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Senha do administrador</Label>
                    <PasswordInput
                      name="settings-restore-admin-password"
                      value={restoreAdminPassword}
                      onChange={event => setRestoreAdminPassword(event.target.value)}
                      placeholder="Digite a senha"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Confirmação final</Label>
                    <Input
                      value={restoreConfirmationText}
                      onChange={event => setRestoreConfirmationText(event.target.value)}
                      placeholder='Digite "RESTAURAR" para confirmar'
                    />
                  </div>

                  {restoreError && (
                    <p className="text-sm font-medium text-destructive">{restoreError}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => handleRestoreDialogOpenChange(false)} disabled={restoringBackup}>
                    Cancelar
                  </Button>
                  <Button onClick={() => void handleRestoreBackup()} disabled={restoringBackup || !restoreBackup}>
                    {restoringBackup ? 'Restaurando...' : 'Confirmar restauração'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>}

      {activeSettingsSection === 'colaboradores' && (
        <Suspense fallback={<SettingsSectionLoader label="Carregando colaboradores..." />}>
          <OperatorManagementPanel />
        </Suspense>
      )}

      {activeSettingsSection === 'filiais' && !isDesktop && (
        <Suspense
          fallback={<SettingsSectionLoader label="Carregando filiais e terminais..." />}
        >
          <LocationsTerminalsPanel />
        </Suspense>
      )}

      {activeSettingsSection === 'catalogo' && !isDesktop && (
        <Suspense
          fallback={<SettingsSectionLoader label="Carregando catalogo avancado..." />}
        >
          <CatalogConfigurationPanel />
        </Suspense>
      )}

      {activeSettingsSection === 'risco' && <Card className="border-destructive/30">
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
            Os clientes, produtos e colaboradores continuam cadastrados.
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
                    name="settings-reset-admin-login"
                    value={adminEmail}
                    onChange={event => setAdminEmail(event.target.value)}
                    placeholder="admin@empresa.com"
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Senha do administrador</Label>
                  <PasswordInput
                    name="settings-reset-admin-password"
                    value={adminPassword}
                    onChange={event => setAdminPassword(event.target.value)}
                    placeholder="Digite a senha"
                    autoComplete="new-password"
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
      </Card>}
    </div>
  );
}
