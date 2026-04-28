import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, KeyRound, Plus, Trash2, Users, Wallet } from 'lucide-react';
import type { Expense, Sale } from '@/types';
import { formatDateTime } from '../../shared/locale/format';
import { getPasswordPolicyError, passwordPolicyHint } from '../../shared/security/passwordPolicy';

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
  created_at: string;
}

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
  };
  temporaryPassword?: string;
  error?: string;
}

interface OperatorManagementPanelProps {
  createDialogOpen?: boolean;
  onCreateDialogOpenChange?: (open: boolean) => void;
}

const paymentMethodCards: Array<{ key: PaymentMethodKey; label: string }> = [
  { key: 'dinheiro', label: 'Dinheiro' },
  { key: 'cartao_debito', label: 'Debito' },
  { key: 'pix', label: 'Pix' },
  { key: 'cartao_credito', label: 'Credito' },
];

const normalizeLabel = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

export function OperatorManagementPanel({
  createDialogOpen: controlledCreateDialogOpen,
  onCreateDialogOpenChange,
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
  const [closeCashAdminEmail, setCloseCashAdminEmail] = useState('');
  const [closeCashAdminPassword, setCloseCashAdminPassword] = useState('');
  const [closeCashError, setCloseCashError] = useState('');
  const [latestCredential, setLatestCredential] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);
  const [internalCreateDialogOpen, setInternalCreateDialogOpen] = useState(false);

  const createDialogOpen = controlledCreateDialogOpen ?? internalCreateDialogOpen;
  const setCreateDialogOpen = onCreateDialogOpenChange ?? setInternalCreateDialogOpen;

  const resetCreateForm = useCallback(() => {
    setUsername('');
    setPassword('');
  }, []);

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);

    if (!open) {
      resetCreateForm();
    }
  }, [resetCreateForm, setCreateDialogOpen]);

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

    return functionErrorMessage;
  }, []);

  const loadData = useCallback(async () => {
    if (!isAdmin || !ownerUserId) {
      setOperators([]);
      setOpenCashSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [{ data: operatorRows, error: operatorError }, { data: openRows, error: openError }] = await Promise.all([
      db
        .from('profiles')
        .select('user_id, username, created_at')
        .eq('owner_user_id', ownerUserId)
        .eq('role', 'operator')
        .order('created_at', { ascending: false }),
      db
        .from('cash_sessions')
        .select('id, operator_user_id, operator_name, opening_amount, opened_at')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
    ]);

    if (operatorError) {
      console.error('Erro ao carregar operadores:', operatorError);
      toast.error('Não foi possível carregar os operadores');
    }

    if (openError) {
      console.error('Erro ao carregar caixas abertos:', openError);
      toast.error('Não foi possível carregar os caixas abertos');
    }

    setOperators((operatorRows as OperatorProfile[]) ?? []);
    setOpenCashSessions((openRows as OpenCashSession[]) ?? []);
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

  if (!isAdmin) return null;

  const handleCreateOperator = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para cadastrar operadores.');
      return;
    }

    if (!username.trim() || !password.trim()) {
      toast.error('Preencha usuário e senha');
      return;
    }

    const passwordError = getPasswordPolicyError(password.trim());
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        action: 'create',
        username: username.trim(),
        password: password.trim(),
      },
    });

    if (error || !data?.success || !data.operator || !data.temporaryPassword) {
      let functionErrorMessage = data?.error || 'Não foi possível criar o operador';

      if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
        try {
          const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          functionErrorMessage = error.context.status === 401
            ? 'Sua sessão expirou ou não foi enviada corretamente. Entre novamente e tente de novo.'
            : functionErrorMessage;
        }
      }

      console.error('Erro ao criar operador:', error);
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível criar o operador', data));
      setCreating(false);
      return;
    }

    setLatestCredential({
      username: data.operator.username,
      temporaryPassword: data.temporaryPassword,
    });
    resetCreateForm();
    handleCreateDialogOpenChange(false);
    toast.success('Operador criado com sucesso');
    await loadData();
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para redefinir senhas.');
      return;
    }

    if (!selectedOperator) return;
    if (!resetPassword.trim()) {
      toast.error('Informe a nova senha');
      return;
    }
    const passwordError = getPasswordPolicyError(resetPassword.trim());
    if (passwordError) {
      toast.error(passwordError);
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

    if (error || !data?.success || !data.operator || !data.temporaryPassword) {
      let functionErrorMessage = data?.error || 'Não foi possível redefinir a senha';

      if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
        try {
          const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          functionErrorMessage = error.context.status === 401
            ? 'Sua sessão expirou ou não foi enviada corretamente. Entre novamente e tente de novo.'
            : functionErrorMessage;
        }
      }

      console.error('Erro ao redefinir senha do operador:', error);
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível redefinir a senha', data));
      setResetting(false);
      return;
    }

    setLatestCredential({
      username: data.operator.username,
      temporaryPassword: data.temporaryPassword,
    });
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
      console.error('Erro ao abrir caixa do operador:', error);
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível abrir o caixa para este operador', data));
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
      const { data: authData, error: authError } = await adminVerificationClient.auth.signInWithPassword({
        email: normalizedAdminEmail,
        password: adminPassword,
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
        console.error('Erro ao fechar caixa pelas configurações:', closeError);
        setCloseCashError('Não foi possível registrar o fechamento do caixa.');
        return;
      }

      toast.success(`Caixa de ${cashSessionToClose.operator.username} fechado`);
      resetCloseCashState();
      await loadData();
    } catch (error) {
      console.error('Erro ao validar administrador para fechar caixa:', error);
      setCloseCashError('Não foi possível validar o administrador.');
    } finally {
      await adminVerificationClient.auth.signOut();
      setClosingCash(false);
    }
  };

  const handleDeleteOperator = async (operator: OperatorProfile) => {
    if (!session?.access_token) {
      toast.error('Sua sessão expirou. Entre novamente para excluir operadores.');
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
      console.error('Erro ao excluir operador:', error);
      toast.error(await resolveFunctionErrorMessage(error, 'Não foi possível excluir o operador', data));
      setDeletingOperatorId(null);
      return;
    }

    toast.success(`Operador ${operator.username} excluido com sucesso`);
    await loadData();
    setDeletingOperatorId(null);
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-lg">Operadores e Caixa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cadastre operadores, redefina acessos e acompanhe quem esta com o caixa aberto.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Button onClick={() => handleCreateDialogOpenChange(true)} className="w-full lg:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar operador
              </Button>

              <div className="grid grid-cols-2 gap-2 sm:w-[280px]">
                <div className="rounded-lg border border-border bg-secondary/20 p-3">
                  <p className="text-xs text-muted-foreground">Operadores</p>
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

        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Credencial exibida na hora</h3>
            </div>

            {latestCredential ? (
              <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <p><strong>Usuário:</strong> {latestCredential.username}</p>
                <p><strong>Senha provisoria:</strong> {latestCredential.temporaryPassword}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O usuário e a senha aparecem apenas quando o operador e criado ou quando voce redefine a senha dele.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Por seguranca, o sistema nao mostra a senha atual depois que ela e salva no Auth.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Operadores cadastrados</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando operadores...</p>
            ) : operators.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum operador cadastrado.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {operators.map(operator => {
                  const openSession = openSessionByOperatorId.get(operator.user_id);
                  const openCashSummary = openSession ? openCashSummaryByOperatorId.get(operator.user_id) : null;

                  return (
                    <Card key={operator.user_id} className="border-border/50">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{operator.username}</p>
                            <p className="truncate text-sm text-muted-foreground">Login do operador</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${openSession ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                            {openSession ? 'Caixa aberto' : 'Caixa fechado'}
                          </span>
                        </div>

                        {openSession ? (
                          <div className="space-y-3 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-md border border-border/70 bg-background/80 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Operador</p>
                                <p className="mt-1 font-semibold">{openSession.operator_name}</p>
                              </div>
                              <div className="rounded-md border border-border/70 bg-background/80 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Abertura</p>
                                <p className="mt-1 font-semibold">{formatDateTime(openSession.opened_at)}</p>
                              </div>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-md border border-border/70 bg-background/80 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor inicial</p>
                                <p className="mt-1 text-base font-semibold">{formatMoney(Number(openSession.opening_amount || 0))}</p>
                              </div>
                              <div className="rounded-md border border-emerald-200/70 bg-emerald-50/60 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-emerald-700/80">Entradas</p>
                                <p className="mt-1 text-base font-semibold text-emerald-700">
                                  {formatMoney(openCashSummary?.entriesTotal ?? 0)}
                                </p>
                                <p className="text-xs text-emerald-700/80">
                                  {openCashSummary?.salesCount ?? 0} venda{(openCashSummary?.salesCount ?? 0) === 1 ? '' : 's'}
                                </p>
                              </div>
                              <div className="rounded-md border border-rose-200/70 bg-rose-50/60 p-3">
                                <p className="text-[11px] uppercase tracking-wide text-rose-700/80">Saidas</p>
                                <p className="mt-1 text-base font-semibold text-rose-700">
                                  {formatMoney(openCashSummary?.cashOutTotal ?? 0)}
                                </p>
                                <p className="text-xs text-rose-700/80">
                                  {openCashSummary?.cashOutCount ?? 0} registro{(openCashSummary?.cashOutCount ?? 0) === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                              <p className="text-[11px] uppercase tracking-wide text-primary/80">Total do caixa aberto</p>
                              <p className="mt-1 text-lg font-semibold text-primary">
                                {formatMoney(openCashSummary?.currentBalance ?? Number(openSession.opening_amount || 0))}
                              </p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {paymentMethodCards.map(paymentMethod => (
                                <div key={paymentMethod.key} className="rounded-md border border-border/70 bg-background/80 p-3">
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{paymentMethod.label}</p>
                                  <p className="mt-1 font-semibold">
                                    {formatMoney(openCashSummary?.paymentTotals[paymentMethod.key] ?? 0)}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {(openCashSummary?.otherEntriesTotal ?? 0) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Outras entradas registradas neste caixa: {formatMoney(openCashSummary?.otherEntriesTotal ?? 0)}
                              </p>
                            )}

                            {openCashSummary?.hasLegacyCashOutGap && (
                              <p className="text-xs text-muted-foreground">
                                Saidas antigas sem vinculo direto com operador podem nao aparecer neste resumo.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum caixa aberto para este operador agora.</p>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setSelectedOperator(operator);
                              setResetPassword('');
                              setResetDialogOpen(true);
                            }}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Redefinir senha
                          </Button>
                          {!openSession && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
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
                          {openSession && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
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
                                className="flex-1"
                                disabled={deletingOperatorId === operator.user_id}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {deletingOperatorId === operator.user_id ? 'Excluindo...' : 'Excluir'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir operador?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O operador "{operator.username}" sera removido do sistema.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => void handleDeleteOperator(operator)}
                                >
                                  Excluir operador
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar operador</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Usuário</Label>
              <Input value={username} onChange={event => setUsername(event.target.value)} placeholder="Ex: operador.caixa" />
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <PasswordInput value={password} onChange={event => setPassword(event.target.value)} placeholder="Use uma senha forte" />
              <p className="text-xs text-muted-foreground">{passwordPolicyHint}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Use de 3 a 24 caracteres com letras, numeros, ponto, hifen ou underscore.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleCreateDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateOperator()} disabled={creating}>
              {creating ? 'Criando...' : 'Criar operador'}
            </Button>
          </DialogFooter>
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
            <DialogTitle>Fechar caixa do operador</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <p className="text-muted-foreground">Operador</p>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetCloseCashState} disabled={closingCash}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCloseCashWithAdmin()} disabled={closingCash}>
              {closingCash ? 'Validando...' : 'Confirmar fechamento'}
            </Button>
          </DialogFooter>
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
            <DialogTitle>Abrir caixa para operador</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Operador</Label>
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
              O operador selecionado tera o caixa aberto com este valor inicial.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCashDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleOpenCashForOperator()} disabled={openingCash}>
              {openingCash ? 'Abrindo...' : 'Abrir caixa'}
            </Button>
          </DialogFooter>
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
            <DialogTitle>Redefinir senha do operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Operador</Label>
              <Input value={selectedOperator?.username || ''} readOnly />
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <PasswordInput
                value={resetPassword}
                onChange={event => setResetPassword(event.target.value)}
                placeholder="Informe uma senha forte"
              />
              <p className="text-xs text-muted-foreground">{passwordPolicyHint}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleResetPassword()} disabled={resetting}>
              {resetting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
