import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BriefcaseBusiness, Eye, KeyRound, Pencil, Plus, Trash2, Users, Wallet } from 'lucide-react';
import type { Expense, Sale } from '@/types';
import { getOperatorCredentialError, operatorCredentialHint } from '../../shared/security/operatorCredential';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import { requestTurnstileToken } from '../../shared/security/turnstile';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { saveOfflineOperatorAccess } from '@/lib/offlineOperatorAccess';
import { OperatorPermissionSelector, type OperatorPermissionOption } from '@/components/OperatorPermissionSelector';
import { isErpPermissionKey, togglePermissionWithDependencies, type ErpPermissionKey } from '@/lib/permissions';

// Generated Supabase types are behind the current schema for these admin tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const adminVerificationClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'happycash-admin-settings-cash-verification',
    },
  },
);

interface OperatorProfile {
  user_id: string;
  username: string;
  role: StaffRole;
  job_title: string | null;
  created_at: string;
}

type StaffRole = 'operator' | 'waiter' | 'hr';

interface OpenCashSession {
  id: string;
  operator_user_id: string;
  operator_name: string;
  opening_amount: number;
  opened_at: string;
}

type PaymentMethodKey = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito';

interface OpenCashSummary {
  entriesTotal: number;
  cashOutTotal: number;
  currentBalance: number;
  paymentTotals: Record<PaymentMethodKey, number>;
  otherEntriesTotal: number;
  salesCount: number;
  cashOutCount: number;
  hasLegacyCashOutGap: boolean;
}
interface OperatorFunctionResponse {
  success?: boolean;
  cashSession?: {
    id: string;
  };
  operator?: {
    user_id: string;
    username: string;
    role?: StaffRole;
    job_title?: string;
  };
  error?: string;
}

interface OperatorManagementPanelProps {
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
  initialStaffRole?: StaffRole;
}

const fallbackJobTitle: Record<StaffRole, string> = {
  operator: 'Colaborador',
  waiter: 'Colaborador',
  hr: 'Analista de RH',
};
const staffRoleLabels: Record<StaffRole, string> = {
  operator: 'Colaborador',
  waiter: 'Colaborador',
  hr: 'RH isolado',
};
const isHrPermissionKey = (permissionKey: ErpPermissionKey) => permissionKey.startsWith('hr.');
const resolveStaffRoleFromPermissions = (permissionKeys: Iterable<ErpPermissionKey>): StaffRole => {
  const keys = [...permissionKeys];
  return keys.length > 0 && keys.every(isHrPermissionKey) ? 'hr' : 'operator';
};

const normalizeLabel = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

export function OperatorManagementPanel({
  createDialogOpen: controlledCreateDialogOpen,
  onCreateDialogOpenChange,
  initialStaffRole,
}: OperatorManagementPanelProps) {
  const { isAdmin, ownerUserId, session } = useAuth();
  const { sales, expenses, loading: dataLoading } = useData();
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [openCashSessions, setOpenCashSessions] = useState<OpenCashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [openingCash, setOpeningCash] = useState(false);
  const [closingCash, setClosingCash] = useState(false);
  const [deletingOperatorId, setDeletingOperatorId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [adminAuthorizationOpen, setAdminAuthorizationOpen] = useState(false);
  const [pendingAccessAction, setPendingAccessAction] = useState<'create' | 'update' | null>(null);
  const [adminAuthorizationEmail, setAdminAuthorizationEmail] = useState('');
  const [adminAuthorizationPassword, setAdminAuthorizationPassword] = useState('');
  const [adminAuthorizationError, setAdminAuthorizationError] = useState('');
  const [permissionOptions, setPermissionOptions] = useState<OperatorPermissionOption[]>([]);
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<Set<ErpPermissionKey>>(new Set());
  const [permissionKeysByOperatorId, setPermissionKeysByOperatorId] = useState<Record<string, Set<ErpPermissionKey>>>({});
  const [loadingPermissionOptions, setLoadingPermissionOptions] = useState(false);
  const [createStep, setCreateStep] = useState<'data' | 'permissions' | 'review'>('data');
  const [openingAmount, setOpeningAmount] = useState('');
  const [openCashDialogOpen, setOpenCashDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [operatorToOpenCash, setOperatorToOpenCash] = useState<OperatorProfile | null>(null);
  const [cashSessionToClose, setCashSessionToClose] = useState<{
    operator: OperatorProfile;
    session: OpenCashSession;
    summary: OpenCashSummary | null;
  } | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<OperatorProfile | null>(null);
  const [editingOperator, setEditingOperator] = useState<OperatorProfile | null>(null);
  const [closeCashAdminEmail, setCloseCashAdminEmail] = useState('');
  const [closeCashAdminPassword, setCloseCashAdminPassword] = useState('');
  const [closeCashError, setCloseCashError] = useState('');
  const [latestCredential, setLatestCredential] = useState<{
    username: string;
    jobTitle: string;
  } | null>(null);
  const [internalCreateDialogOpen, setInternalCreateDialogOpen] = useState(false);

  const createDialogOpen = controlledCreateDialogOpen ?? internalCreateDialogOpen;
  const setCreateDialogOpen = onCreateDialogOpenChange ?? setInternalCreateDialogOpen;

  const resetCreateForm = useCallback(() => {
    const startsAsHr = initialStaffRole === 'hr';
    setUsername('');
    setPassword('');
    setJobTitle(startsAsHr ? fallbackJobTitle.hr : '');
    setSelectedPermissionKeys(startsAsHr ? new Set<ErpPermissionKey>(['hr.view']) : new Set());
    setCreateStep('data');
  }, [initialStaffRole]);

  const resetAdminAuthorization = useCallback(() => {
    setAdminAuthorizationOpen(false);
    setPendingAccessAction(null);
    setAdminAuthorizationEmail('');
    setAdminAuthorizationPassword('');
    setAdminAuthorizationError('');
  }, []);

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);

    if (!open) {
      setEditingOperator(null);
      resetAdminAuthorization();
      resetCreateForm();
    }
  }, [resetAdminAuthorization, resetCreateForm, setCreateDialogOpen]);

  const accessDialogOpen = createDialogOpen || Boolean(editingOperator);

  useEffect(() => {
    if (!createDialogOpen || editingOperator || !initialStaffRole) return;
    setJobTitle((current) => current.trim() ? current : fallbackJobTitle[initialStaffRole]);
    if (initialStaffRole === 'hr') {
      setSelectedPermissionKeys((current) => current.size > 0 ? current : new Set<ErpPermissionKey>(['hr.view']));
    }
  }, [createDialogOpen, editingOperator, initialStaffRole]);

  const handleAccessDialogOpenChange = useCallback((open: boolean) => {
    if (open) return;
    setEditingOperator(null);
    if (createDialogOpen) setCreateDialogOpen(false);
    resetAdminAuthorization();
    resetCreateForm();
  }, [createDialogOpen, resetAdminAuthorization, resetCreateForm, setCreateDialogOpen]);

  useEffect(() => {
    if (!accessDialogOpen || permissionOptions.length > 0) return;
    setLoadingPermissionOptions(true);
    void db.from('erp_permission_catalog')
      .select('permission_key, module_key, name, description')
      .order('module_key')
      .order('name')
      .then(({ data, error }: { data: unknown; error: unknown }) => {
        if (error) {
          console.error('Erro ao carregar acessos do operador:', getRedactedLogValue(error));
          toast.error('Nao foi possivel carregar os acessos disponiveis.');
          return;
        }
        setPermissionOptions(((data ?? []) as OperatorPermissionOption[]).filter((permission) => isErpPermissionKey(permission.permission_key)));
      })
      .finally(() => setLoadingPermissionOptions(false));
  }, [accessDialogOpen, permissionOptions.length]);

  const visiblePermissionOptions = permissionOptions;

  const resolveFunctionErrorMessage = useCallback(async (
    error: unknown,
    fallbackMessage: string,
    data?: OperatorFunctionResponse
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

  const saveOperatorOfflineAccessIfPossible = useCallback(async (
    operator: OperatorFunctionResponse['operator'],
    secret: string,
  ) => {
    if (!operator || !ownerUserId || typeof window === 'undefined' || !window.electronAPI) {
      return;
    }

    const activation = readDesktopActivation();
    if (!activation || activation.ownerUserId !== ownerUserId) {
      return;
    }

    try {
      if (operator.role === 'hr') {
        return;
      }

      await saveOfflineOperatorAccess({
        userId: operator.user_id,
        ownerUserId,
        username: operator.username,
        email: null,
        role: 'operator',
        secret,
      });
    } catch (error) {
      console.error('Nao foi possivel salvar o acesso offline do operador:', getRedactedLogValue(error));
      toast.warning('Colaborador salvo online, mas nao foi possivel preparar o login offline nesta maquina.');
    }
  }, [ownerUserId]);

  const loadData = useCallback(async () => {
    if (!isAdmin || !ownerUserId) {
      setOperators([]);
      setOpenCashSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [
      { data: operatorRows, error: operatorError },
      { data: openRows, error: openError },
      { data: permissionRows, error: permissionError },
    ] = await Promise.all([
      db
        .from('profiles')
        .select('user_id, username, role, job_title, created_at')
        .eq('owner_user_id', ownerUserId)
        .in('role', ['operator', 'waiter', 'hr'])
        .order('created_at', { ascending: false }),
      db
        .from('cash_sessions')
        .select('id, operator_user_id, operator_name, opening_amount, opened_at')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
      db
        .from('erp_staff_permission_overrides')
        .select('user_id, permission_key, allowed')
        .eq('owner_user_id', ownerUserId)
        .eq('allowed', true),
    ]);

    if (operatorError) {
      console.error('Erro ao carregar operadores:', getRedactedLogValue(operatorError));
      toast.error('Não foi possível carregar os colaboradores');
    }

    if (openError) {
      console.error('Erro ao carregar caixas abertos:', getRedactedLogValue(openError));
      toast.error('Não foi possível carregar os caixas abertos');
    }

    if (permissionError) {
      console.error('Erro ao carregar acessos dos colaboradores:', getRedactedLogValue(permissionError));
      toast.error('Nao foi possivel carregar os acessos dos colaboradores');
    }

    setOperators(((operatorRows as OperatorProfile[]) ?? []).map(operator => ({
      ...operator,
      role: operator.role === 'waiter' ? 'waiter' : operator.role === 'hr' ? 'hr' : 'operator',
    })));
    setOpenCashSessions((openRows as OpenCashSession[]) ?? []);
    const nextPermissionKeysByOperatorId: Record<string, Set<ErpPermissionKey>> = {};
    for (const row of (permissionRows ?? []) as Array<{ user_id: string; permission_key: string }>) {
      if (!isErpPermissionKey(row.permission_key)) continue;
      nextPermissionKeysByOperatorId[row.user_id] ??= new Set<ErpPermissionKey>();
      nextPermissionKeysByOperatorId[row.user_id].add(row.permission_key);
    }
    setPermissionKeysByOperatorId(nextPermissionKeysByOperatorId);
    setLoading(false);
  }, [isAdmin, ownerUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openSessionByOperatorId = new Map(openCashSessions.map(session => [session.operator_user_id, session]));
  const hasSingleOpenSession = openCashSessions.length === 1;
  const isLoading = loading || dataLoading;

  const matchesSessionSale = useCallback((sale: Sale, cashSession: OpenCashSession) => {
    if (sale.status === 'cancelled') return false;
    if (new Date(sale.date).getTime() < new Date(cashSession.opened_at).getTime()) return false;
    return normalizeLabel(sale.seller_name) === normalizeLabel(cashSession.operator_name);
  }, []);

  const matchesSessionExpense = useCallback((expense: Expense, cashSession: OpenCashSession) => {
    if (expense.category !== 'Saída de caixa') return false;
    if (new Date(expense.date).getTime() < new Date(cashSession.opened_at).getTime()) return false;
    return hasSingleOpenSession;
  }, [hasSingleOpenSession]);

  const openCashSummaryByOperatorId = useMemo(() => {
    return new Map<string, OpenCashSummary>(
      openCashSessions.map(cashSession => {
        const sessionSales = sales.filter(sale => matchesSessionSale(sale, cashSession));
        const sessionCashOuts = expenses.filter(expense => matchesSessionExpense(expense, cashSession));
        const paymentTotals: Record<PaymentMethodKey, number> = {
          dinheiro: 0,
          pix: 0,
          cartao_debito: 0,
          cartao_credito: 0,
        };

        let otherEntriesTotal = 0;

        for (const sale of sessionSales) {
          if (sale.payment_method in paymentTotals) {
            paymentTotals[sale.payment_method as PaymentMethodKey] += Number(sale.total || 0);
            continue;
          }

          otherEntriesTotal += Number(sale.total || 0);
        }

        const entriesTotal = sessionSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        const cashOutTotal = sessionCashOuts.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const hasLegacyCashOutGap = !hasSingleOpenSession && expenses.some(expense =>
          expense.category === 'Saída de caixa'
          && new Date(expense.date).getTime() >= new Date(cashSession.opened_at).getTime()
        );

        return [
          cashSession.operator_user_id,
          {
            entriesTotal,
            cashOutTotal,
            currentBalance: Number(cashSession.opening_amount || 0) + entriesTotal - cashOutTotal,
            paymentTotals,
            otherEntriesTotal,
            salesCount: sessionSales.length,
            cashOutCount: sessionCashOuts.length,
            hasLegacyCashOutGap,
          },
        ];
      })
    );
  }, [expenses, hasSingleOpenSession, matchesSessionExpense, matchesSessionSale, openCashSessions, sales]);

  const togglePermission = (permissionKey: ErpPermissionKey, checked: boolean) => {
    setSelectedPermissionKeys((current) => togglePermissionWithDependencies(current, permissionKey, checked));
  };

  const togglePermissionModule = (permissionKeys: ErpPermissionKey[], checked: boolean) => {
    setSelectedPermissionKeys((current) => permissionKeys.reduce(
      (next, permissionKey) => togglePermissionWithDependencies(next, permissionKey, checked),
      current,
    ));
  };

  const selectedPermissionNames = visiblePermissionOptions
    .filter((permission) => selectedPermissionKeys.has(permission.permission_key))
    .map((permission) => permission.name);
  const inferredStaffRole = resolveStaffRoleFromPermissions(selectedPermissionKeys);

  const operatorCanOperateCash = (operator: OperatorProfile) =>
    operator.role !== 'hr' && (permissionKeysByOperatorId[operator.user_id]?.has('pdv.open_cash') ?? false);

  const handleEditOperator = (operator: OperatorProfile) => {
    setEditingOperator(operator);
    setUsername(operator.username);
    setPassword('');
    resetAdminAuthorization();
    setJobTitle(operator.job_title?.trim() || fallbackJobTitle[operator.role]);
    setSelectedPermissionKeys(new Set(permissionKeysByOperatorId[operator.user_id] ?? []));
    setCreateStep('data');
  };

  if (!isAdmin) return null;

  const validateAccessFormBeforeAuthorization = () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para cadastrar colaboradores.');
      return false;
    }

    if (!username.trim() || !password.trim() || !jobTitle.trim()) {
      toast.error('Preencha funcao, usuario e senha ou PIN');
      return false;
    }

    if (selectedPermissionKeys.size === 0) {
      toast.error('Selecione ao menos um acesso para o colaborador.');
      setCreateStep('permissions');
      return false;
    }

    const credentialError = getOperatorCredentialError(password.trim());
    if (credentialError) {
      toast.error(credentialError);
      return false;
    }

    return true;
  };

  const validateUpdateAccessBeforeAuthorization = () => {
    if (!session?.access_token || !editingOperator) {
      toast.error('Sua sessao expirou. Entre novamente para editar colaboradores.');
      return false;
    }

    if (jobTitle.trim().length < 2 || jobTitle.trim().length > 60) {
      toast.error('Informe uma funcao entre 2 e 60 caracteres.');
      return false;
    }

    if (selectedPermissionKeys.size === 0) {
      toast.error('Selecione ao menos um acesso para o colaborador.');
      setCreateStep('permissions');
      return false;
    }

    return true;
  };

  const requestAdminAuthorization = () => {
    const isUpdate = Boolean(editingOperator);
    const valid = isUpdate ? validateUpdateAccessBeforeAuthorization() : validateAccessFormBeforeAuthorization();
    if (!valid) return;

    setPendingAccessAction(isUpdate ? 'update' : 'create');
    setAdminAuthorizationEmail('');
    setAdminAuthorizationPassword('');
    setAdminAuthorizationError('');
    setAdminAuthorizationOpen(true);
  };

  const handleCreateOperator = async (adminEmail: string, adminPassword: string) => {
    setCreating(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'create',
        username: username.trim(),
        password: password.trim(),
        jobTitle: jobTitle.trim(),
        staffRole: inferredStaffRole,
        permissionKeys: [...selectedPermissionKeys],
        adminEmail,
        adminPassword,
      },
    });

    if (error || !data?.success || !data.operator) {
      const message = await resolveFunctionErrorMessage(error, 'Não foi possível criar o colaborador', data);
      toast.error(message);
      setAdminAuthorizationError(message);
      setAdminAuthorizationPassword('');
      setCreating(false);
      return false;
    }

    setLatestCredential({
      username: data.operator.username,
      jobTitle: data.operator.job_title || jobTitle.trim(),
    });
    await saveOperatorOfflineAccessIfPossible(data.operator, password.trim());
    resetCreateForm();
    handleCreateDialogOpenChange(false);
    toast.success('Colaborador criado com sucesso');
    await loadData();
    setCreating(false);
    resetAdminAuthorization();
    return true;
  };

  const handleUpdateOperatorAccess = async (adminEmail: string, adminPassword: string) => {
    if (!editingOperator) return false;
    setCreating(true);
    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        action: 'update_access',
        operatorUserId: editingOperator.user_id,
        jobTitle: jobTitle.trim(),
        staffRole: inferredStaffRole,
        permissionKeys: [...selectedPermissionKeys],
        adminEmail,
        adminPassword,
      },
    });

    if (error || !data?.success) {
      const message = await resolveFunctionErrorMessage(error, 'Nao foi possivel atualizar o colaborador', data);
      toast.error(message);
      setAdminAuthorizationError(message);
      setAdminAuthorizationPassword('');
      setCreating(false);
      return false;
    }

    handleAccessDialogOpenChange(false);
    toast.success('Funcao e acessos atualizados');
    await loadData();
    setCreating(false);
    resetAdminAuthorization();
    return true;
  };

  const handleConfirmAdminAuthorization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const adminEmail = adminAuthorizationEmail.trim();
    const adminPassword = adminAuthorizationPassword.trim();

    if (!adminEmail || !adminPassword) {
      setAdminAuthorizationError('Digite login e senha do administrador.');
      return;
    }

    setAdminAuthorizationError('');
    if (pendingAccessAction === 'create') {
      await handleCreateOperator(adminEmail, adminPassword);
      return;
    }
    if (pendingAccessAction === 'update') {
      await handleUpdateOperatorAccess(adminEmail, adminPassword);
    }
  };

  const handleResetPassword = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para redefinir senhas.');
      return;
    }

    if (!selectedOperator) return;
    if (!resetPassword.trim()) {
      toast.error('Informe a nova senha ou PIN');
      return;
    }
    const credentialError = getOperatorCredentialError(resetPassword.trim());
    if (credentialError) {
      toast.error(credentialError);
      return;
    }

    setResetting(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'reset_password',
        operatorUserId: selectedOperator.user_id,
        password: resetPassword.trim(),
      },
    });

    if (error || !data?.success || !data.operator) {
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível redefinir a senha', data));
      setResetting(false);
      return;
    }

    setLatestCredential({
      username: data.operator.username,
      jobTitle: selectedOperator.job_title?.trim() || fallbackJobTitle[selectedOperator.role],
    });
    await saveOperatorOfflineAccessIfPossible(data.operator, resetPassword.trim());
    setResetPassword('');
    setSelectedOperator(null);
    setResetDialogOpen(false);
    toast.success('Senha redefinida com sucesso');
    await loadData();
    setResetting(false);
  };

  const handleOpenCashForOperator = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para abrir caixas.');
      return;
    }

    if (!operatorToOpenCash) return;

    const parsedOpeningAmount = Number.parseFloat(openingAmount || '0');
    if (Number.isNaN(parsedOpeningAmount) || parsedOpeningAmount < 0) {
      toast.error('Informe um valor inicial valido');
      return;
    }

    setOpeningCash(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'open_cash',
        operatorUserId: operatorToOpenCash.user_id,
        openingAmount: Number(parsedOpeningAmount.toFixed(2)),
      },
    });

    if (error || !data?.success || !data.cashSession) {
      console.error('Erro ao abrir caixa do operador:', getRedactedLogValue(error));
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível abrir o caixa para este colaborador', data));
      setOpeningCash(false);
      return;
    }

    toast.success(`Caixa aberto para ${operatorToOpenCash.username}`);
    setOpenCashDialogOpen(false);
    setOperatorToOpenCash(null);
    setOpeningAmount('');
    await loadData();
    setOpeningCash(false);
  };

  const resetCloseCashState = () => {
    setCashSessionToClose(null);
    setCloseCashAdminEmail('');
    setCloseCashAdminPassword('');
    setCloseCashError('');
  };

  const handleCloseCashWithAdmin = async () => {
    if (!cashSessionToClose) return;

    const normalizedAdminEmail = closeCashAdminEmail.trim().toLowerCase();
    const adminPassword = closeCashAdminPassword.trim();

    if (!normalizedAdminEmail) {
      setCloseCashError('Digite o email do administrador.');
      return;
    }

    if (!adminPassword) {
      setCloseCashError('Digite a senha do administrador.');
      return;
    }

    setClosingCash(true);
    setCloseCashError('');

    try {
      const captchaToken = await requestTurnstileToken('app-admin-verification');
      const { data: authData, error: authError } = await adminVerificationClient.auth.signInWithPassword({
        email: normalizedAdminEmail,
        password: adminPassword,
        options: { captchaToken },
      });

      if (authError || !authData.user?.id) {
        setCloseCashError('Email ou senha de administrador incorretos.');
        return;
      }

      const adminDb = adminVerificationClient as unknown as typeof db;
      const { data: adminProfile, error: adminProfileError } = await adminDb
        .from('profiles')
        .select('role, owner_user_id, username')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
        setCloseCashError('A conta informada não é de administrador.');
        return;
      }

      const adminOwnerUserId = adminProfile.owner_user_id ?? authData.user.id;
      if (ownerUserId && adminOwnerUserId !== ownerUserId) {
        setCloseCashError('Administrador não pertence a esta loja.');
        return;
      }

      const closedAt = new Date().toISOString();
      const closingBalance = cashSessionToClose.summary?.currentBalance
        ?? Number(cashSessionToClose.session.opening_amount || 0);

      const { error: closeError } = await adminDb
        .from('cash_sessions')
        .update({
          status: 'closed',
          closed_at: closedAt,
          closed_by_user_id: authData.user.id,
          closed_by_name: adminProfile.username || authData.user.email || normalizedAdminEmail,
          closing_balance: Number(closingBalance.toFixed(2)),
        })
        .eq('id', cashSessionToClose.session.id);

      if (closeError) {
        console.error('Erro ao fechar caixa pelas configurações:', getRedactedLogValue(closeError));
        setCloseCashError('Não foi possível registrar o fechamento do caixa.');
        return;
      }

      toast.success(`Caixa de ${cashSessionToClose.operator.username} fechado`);
      resetCloseCashState();
      await loadData();
    } catch (error) {
      console.error('Erro ao validar administrador para fechar caixa:', getRedactedLogValue(error));
      setCloseCashError('Não foi possível validar o administrador.');
    } finally {
      await adminVerificationClient.auth.signOut();
      setClosingCash(false);
    }
  };

  const handleDeleteOperator = async (operator: OperatorProfile) => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para excluir colaboradores.');
      return;
    }

    setDeletingOperatorId(operator.user_id);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'delete',
        operatorUserId: operator.user_id,
      },
    });

    if (error || !data?.success) {
      console.error('Erro ao excluir operador:', getRedactedLogValue(error));
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível excluir o colaborador', data));
      setDeletingOperatorId(null);
      return;
    }

    toast.success(`Colaborador ${operator.username} excluido com sucesso`);
    await loadData();
    setDeletingOperatorId(null);
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg">Colaboradores, acessos e caixa</CardTitle>
              <p className="text-sm text-muted-foreground">
                A lista fica compacta; use Editar para ajustar funcao e acessos individuais.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Button onClick={() => handleCreateDialogOpenChange(true)} className="w-full lg:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar colaborador
              </Button>

              <div className="grid grid-cols-2 gap-2 sm:w-[280px]">
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Equipe</p>
                  <p className="text-2xl font-bold">
                    <Users className="mr-2 inline h-4 w-4 text-primary" />
                    {operators.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Caixas abertos</p>
                  <p className="text-2xl font-bold">
                    <Wallet className="mr-2 inline h-4 w-4 text-primary" />
                    {openCashSessions.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {latestCredential && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 shrink-0 text-primary" />
                <span><strong>{latestCredential.username}</strong> · {latestCredential.jobTitle}</span>
              </div>
              <span className="text-xs text-muted-foreground">Credencial salva e protegida.</span>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold">Equipe cadastrada</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando equipe...</p>
            ) : operators.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum acesso operacional cadastrado.</p>
            ) : (
              <div className="divide-y rounded-lg border border-border/70">
                {operators.map(operator => {
                  const openSession = openSessionByOperatorId.get(operator.user_id);
                  const openCashSummary = openSession ? openCashSummaryByOperatorId.get(operator.user_id) : null;
                  const canOperateCash = operatorCanOperateCash(operator);

                  return (
                    <div key={operator.user_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {operator.username.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold">{operator.username}</p>
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              <BriefcaseBusiness className="h-3 w-3" />
                              {staffRoleLabels[operator.role]}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${openSession ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                              {openSession ? 'Caixa aberto' : canOperateCash ? 'Caixa fechado' : 'Sem caixa'}
                            </span>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            {operator.job_title?.trim() || fallbackJobTitle[operator.role]}
                            {openSession ? ` · ${formatMoney(openCashSummary?.currentBalance ?? Number(openSession.opening_amount || 0))}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEditOperator(operator)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedOperator(operator);
                              setResetPassword('');
                              setResetDialogOpen(true);
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Senha
                          </Button>
                          {!openSession && canOperateCash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOperatorToOpenCash(operator);
                                setOpeningAmount('0.00');
                                setOpenCashDialogOpen(true);
                              }}
                            >
                              <Wallet className="mr-2 h-4 w-4" />
                              Abrir caixa
                            </Button>
                          )}
                          {openSession && canOperateCash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCashSessionToClose({
                                  operator,
                                  session: openSession,
                                  summary: openCashSummary ?? null,
                                });
                                setCloseCashAdminEmail('');
                                setCloseCashAdminPassword('');
                                setCloseCashError('');
                              }}
                            >
                              <Wallet className="mr-2 h-4 w-4" />
                              Fechar caixa
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deletingOperatorId === operator.user_id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingOperatorId === operator.user_id ? 'Excluindo...' : 'Excluir'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir colaborador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O colaborador "{operator.username}" sera removido do sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteOperator(operator)}
                                >
                                  Excluir colaborador
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={accessDialogOpen} onOpenChange={handleAccessDialogOpenChange}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[90vh] sm:max-w-6xl sm:rounded-lg">
          <DialogHeader>
            <div className="border-b px-4 py-4 sm:px-6">
              <DialogTitle>{editingOperator ? 'Editar colaborador e acessos' : 'Cadastrar colaborador'}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                A funcao identifica o colaborador; o administrador define o acesso marcando os checkboxes.
              </DialogDescription>
              <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
                {(['data', 'permissions', 'review'] as const).map((step, index) => (
                  <Button key={step} type="button" size="sm" variant={createStep === step ? 'default' : 'outline'} onClick={() => setCreateStep(step)}>
                    {index + 1}. {step === 'data' ? 'Dados' : step === 'permissions' ? 'Acessos' : 'Revisão'}
                  </Button>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 md:grid-cols-[320px_minmax(0,1fr)]">
            <form
              className={`${createStep === 'data' ? 'block' : 'hidden'} overflow-y-auto border-r p-4 md:block sm:p-6`}
              onSubmit={(event) => {
                event.preventDefault();
                requestAdminAuthorization();
              }}
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Função</Label>
                  <Input
                    value={jobTitle}
                    onChange={event => setJobTitle(event.target.value)}
                    placeholder="Ex: Caixa da manha, Gerente, Atendimento"
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">O administrador escreve o nome. A função não libera permissões automaticamente.</p>
                </div>
                <div className="space-y-1">
                  <Label>Usuário</Label>
                  <Input
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    placeholder="Ex: colaborador.caixa"
                    readOnly={Boolean(editingOperator)}
                  />
                </div>
                {!editingOperator && (
                  <div className="space-y-1">
                    <Label>Senha ou PIN inicial</Label>
                    <PasswordInput value={password} onChange={event => setPassword(event.target.value)} placeholder="Use uma senha forte ou PIN" />
                    <p className="text-xs text-muted-foreground">{operatorCredentialHint}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {editingOperator ? 'O usuário não muda nesta tela para preservar o login.' : 'Use de 3 a 24 caracteres com letras, números, ponto, hífen ou underscore.'}
                </p>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Tipo calculado pelo acesso</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {staffRoleLabels[inferredStaffRole]}: quando marcar somente acessos de RH, o menu fica isolado no RH. Com outros acessos, o colaborador segue os checkboxes selecionados.
                  </p>
                </div>
                <div className="hidden rounded-lg border bg-muted/30 p-3 text-sm md:block">
                  <p className="font-medium">Resumo</p>
                  <p className="text-muted-foreground">{staffRoleLabels[inferredStaffRole]} · {jobTitle || 'Funcao nao informada'} · {selectedPermissionKeys.size} acessos</p>
                </div>
              </div>
            </form>

            <div className={`${createStep === 'permissions' ? 'block' : 'hidden'} overflow-y-auto p-4 md:block sm:p-6`}>
              <OperatorPermissionSelector
                permissions={visiblePermissionOptions}
                selected={selectedPermissionKeys}
                loading={loadingPermissionOptions}
                onToggle={togglePermission}
                onToggleModule={togglePermissionModule}
              />
            </div>

            <div className={`${createStep === 'review' ? 'block' : 'hidden'} overflow-y-auto p-4 md:hidden`}>
              <div className="space-y-4 rounded-lg border p-4">
                <div><p className="text-xs text-muted-foreground">Tipo calculado</p><p className="font-semibold">{staffRoleLabels[inferredStaffRole]}</p></div>
                <div><p className="text-xs text-muted-foreground">Função</p><p className="font-semibold">{jobTitle || 'Não informada'}</p></div>
                <div><p className="text-xs text-muted-foreground">Usuário</p><p className="font-semibold">{username || 'Não informado'}</p></div>
                <div><p className="text-xs text-muted-foreground">Acessos ({selectedPermissionNames.length})</p><p className="mt-1 text-sm">{selectedPermissionNames.join(', ') || 'Nenhum acesso selecionado'}</p></div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t p-4 sm:px-6">
            <div className="hidden w-full justify-end gap-2 md:flex">
              <Button type="button" variant="outline" onClick={() => handleAccessDialogOpenChange(false)}>Cancelar</Button>
              <Button
                type="button"
                onClick={requestAdminAuthorization}
                disabled={creating || loadingPermissionOptions}
              >
                {creating ? 'Salvando...' : editingOperator ? 'Salvar alteracoes' : 'Criar acesso'}
              </Button>
            </div>
            <div className="flex w-full justify-between gap-2 md:hidden">
              <Button type="button" variant="outline" onClick={() => createStep === 'data' ? handleAccessDialogOpenChange(false) : setCreateStep(createStep === 'review' ? 'permissions' : 'data')}>
                {createStep === 'data' ? 'Cancelar' : 'Voltar'}
              </Button>
              {createStep === 'data' && <Button type="button" onClick={() => setCreateStep('permissions')}>Continuar</Button>}
              {createStep === 'permissions' && <Button type="button" onClick={() => setCreateStep('review')} disabled={selectedPermissionKeys.size === 0}>Revisar</Button>}
              {createStep === 'review' && (
                <Button type="button" onClick={requestAdminAuthorization} disabled={creating}>
                  {creating ? 'Salvando...' : editingOperator ? 'Salvar' : 'Criar acesso'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adminAuthorizationOpen}
        onOpenChange={(open) => {
          if (!open && !creating) resetAdminAuthorization();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar como administrador</DialogTitle>
            <DialogDescription>
              Para criar ou alterar acessos, confirme com o email e a senha do administrador da loja. Esses dados nao ficam salvos.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleConfirmAdminAuthorization}>
            <div className="space-y-1">
              <Label>Login do administrador (email)</Label>
              <Input
                type="email"
                value={adminAuthorizationEmail}
                onChange={event => setAdminAuthorizationEmail(event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Senha do administrador</Label>
              <PasswordInput
                value={adminAuthorizationPassword}
                onChange={event => setAdminAuthorizationPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="current-password"
              />
            </div>
            {adminAuthorizationError ? (
              <p className="text-sm font-medium text-destructive">{adminAuthorizationError}</p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetAdminAuthorization} disabled={creating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Validando...' : 'Confirmar e salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cashSessionToClose)}
        onOpenChange={open => {
          if (!open) {
            resetCloseCashState();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar caixa do colaborador</DialogTitle>
            <DialogDescription>
              Confirme com o administrador para registrar o fechamento do caixa.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCloseCashWithAdmin();
            }}
          >
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <p className="text-muted-foreground">Colaborador</p>
              <p className="font-semibold">{cashSessionToClose?.operator.username || '-'}</p>
              <p className="mt-2 text-muted-foreground">Total atual</p>
              <p className="font-semibold">
                {formatMoney(cashSessionToClose?.summary?.currentBalance ?? Number(cashSessionToClose?.session.opening_amount || 0))}
              </p>
            </div>

            <div className="space-y-1">
              <Label>Login do administrador (email)</Label>
              <Input
                type="email"
                value={closeCashAdminEmail}
                onChange={event => setCloseCashAdminEmail(event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="username"
              />
            </div>

            <div className="space-y-1">
              <Label>Senha do administrador</Label>
              <PasswordInput
                value={closeCashAdminPassword}
                onChange={event => setCloseCashAdminPassword(event.target.value)}
                placeholder="Digite a senha"
                autoComplete="current-password"
              />
            </div>

            {closeCashError && (
              <p className="text-sm font-medium text-destructive">{closeCashError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCloseCashState} disabled={closingCash}>
                Cancelar
              </Button>
              <Button type="submit" disabled={closingCash}>
                {closingCash ? 'Validando...' : 'Confirmar fechamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openCashDialogOpen}
        onOpenChange={open => {
          setOpenCashDialogOpen(open);
          if (!open) {
            setOperatorToOpenCash(null);
            setOpeningAmount('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir caixa para colaborador</DialogTitle>
            <DialogDescription>
              Informe o valor inicial para abrir o caixa do colaborador selecionado.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleOpenCashForOperator();
            }}
          >
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Input value={operatorToOpenCash?.username || ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Valor inicial</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={openingAmount}
                onChange={event => setOpeningAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O colaborador selecionado tera o caixa aberto com este valor inicial.
            </p>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCashDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={openingCash}>
                {openingCash ? 'Abrindo...' : 'Abrir caixa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={open => {
          setResetDialogOpen(open);
          if (!open) {
            setResetPassword('');
            setSelectedOperator(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha do colaborador</DialogTitle>
            <DialogDescription>
              Defina uma nova senha ou PIN para o colaborador usar no login.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleResetPassword();
            }}
          >
            <div className="space-y-1">
              <Label>Colaborador</Label>
              <Input value={selectedOperator?.username || ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Nova senha ou PIN</Label>
              <PasswordInput
                value={resetPassword}
                onChange={event => setResetPassword(event.target.value)}
                placeholder="Informe uma senha forte ou PIN"
              />
              <p className="text-xs text-muted-foreground">{operatorCredentialHint}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetting}>
                {resetting ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
