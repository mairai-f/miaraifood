import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, KeyRound, Plus, Users, Wallet } from 'lucide-react';
import type { Expense, Sale } from '@/types';

// Generated Supabase types are behind the current schema for these admin tables.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface OperatorProfile {
  user_id: string;
  username: string;
  email: string | null;
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
  operator?: {
    user_id: string;
    username: string;
    email: string | null;
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

const normalizeLabel = (value: string | null | undefined) => value?.trim().toLocaleLowerCase('pt-BR') ?? '';
const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

export function OperatorManagementPanel({
  createDialogOpen: controlledCreateDialogOpen,
  onCreateDialogOpenChange,
}: OperatorManagementPanelProps) {
  const { isAdmin, ownerUserId } = useAuth();
  const { sales, expenses, loading: dataLoading } = useData();
  const [operators, setOperators] = useState<OperatorProfile[]>([]);
  const [openCashSessions, setOpenCashSessions] = useState<OpenCashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<OperatorProfile | null>(null);
  const [latestCredential, setLatestCredential] = useState<{
    username: string;
    email: string | null;
    temporaryPassword: string;
  } | null>(null);
  const [internalCreateDialogOpen, setInternalCreateDialogOpen] = useState(false);

  const createDialogOpen = controlledCreateDialogOpen ?? internalCreateDialogOpen;
  const setCreateDialogOpen = onCreateDialogOpenChange ?? setInternalCreateDialogOpen;

  const resetCreateForm = useCallback(() => {
    setUsername('');
    setEmail('');
    setPassword('');
  }, []);

  const handleCreateDialogOpenChange = useCallback((open: boolean) => {
    setCreateDialogOpen(open);

    if (!open) {
      resetCreateForm();
    }
  }, [resetCreateForm, setCreateDialogOpen]);

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
        .select('user_id, username, email, created_at')
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
    if (!username.trim() || !email.trim() || !password.trim()) {
      toast.error('Preencha nome, e-mail e senha');
      return;
    }

    if (password.trim().length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres');
      return;
    }

    setCreating(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      body: {
        action: 'create',
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
      },
    });

    if (error || !data?.success || !data.operator || !data.temporaryPassword) {
      console.error('Erro ao criar operador:', error);
      toast.error(data?.error || 'Não foi possível criar o operador');
      setCreating(false);
      return;
    }

    setLatestCredential({
      username: data.operator.username,
      email: data.operator.email,
      temporaryPassword: data.temporaryPassword,
    });
    resetCreateForm();
    handleCreateDialogOpenChange(false);
    toast.success('Operador criado com sucesso');
    await loadData();
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!selectedOperator) return;
    if (!resetPassword.trim()) {
      toast.error('Informe a nova senha');
      return;
    }
    if (resetPassword.trim().length < 6) {
      toast.error('A nova senha precisa ter pelo menos 6 caracteres');
      return;
    }

    setResetting(true);

    const { data, error } = await supabase.functions.invoke<OperatorFunctionResponse>('manage-operators', {
      body: {
        action: 'reset_password',
        operatorUserId: selectedOperator.user_id,
        password: resetPassword.trim(),
      },
    });

    if (error || !data?.success || !data.operator || !data.temporaryPassword) {
      console.error('Erro ao redefinir senha do operador:', error);
      toast.error(data?.error || 'Não foi possível redefinir a senha');
      setResetting(false);
      return;
    }

    setLatestCredential({
      username: data.operator.username,
      email: data.operator.email,
      temporaryPassword: data.temporaryPassword,
    });
    setResetPassword('');
    setSelectedOperator(null);
    setResetDialogOpen(false);
    toast.success('Senha redefinida com sucesso');
    await loadData();
    setResetting(false);
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
                <p><strong>Nome:</strong> {latestCredential.username}</p>
                <p><strong>E-mail:</strong> {latestCredential.email || 'Sem e-mail'}</p>
                <p><strong>Senha provisoria:</strong> {latestCredential.temporaryPassword}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                A senha aparece apenas quando o operador e criado ou quando voce redefine a senha dele.
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
                            <p className="truncate text-sm text-muted-foreground">{operator.email || 'Sem e-mail'}</p>
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
                                <p className="mt-1 font-semibold">{new Date(openSession.opened_at).toLocaleString('pt-BR')}</p>
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
                          Redefinir senha
                        </Button>
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
              <Label>Nome</Label>
              <Input value={username} onChange={event => setUsername(event.target.value)} placeholder="Nome do operador" />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="operador@empresa.com" />
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Minimo de 6 caracteres" />
            </div>
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
              <Input
                type="password"
                value={resetPassword}
                onChange={event => setResetPassword(event.target.value)}
                placeholder="Informe a nova senha"
              />
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
