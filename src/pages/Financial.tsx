import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TrendingUp, TrendingDown, DollarSign, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { formatDateOnly } from '../../shared/locale/format';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { parseDecimalInput } from '@/lib/numberInput';
import { getFinancialAccountRemainingAmount } from '@/lib/erpFinance';
import type { FinancialAccount } from '@/types/operations';
import { getRedactedLogValue } from '../../shared/security/redaction';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
// O schema gerado cobre todas as tabelas: a consulta volta a ser verificada.
const fromTable = <T extends keyof Database['public']['Tables']>(table: T) =>
  supabase.from(table);

export default function Financial() {
  const { sales, expenses, addExpense, deleteExpense, clients, getClientBalance, loading } = useData();
  const { ownerUserId } = useAuth();
  const { scope: operationalScope } = useOperationalScope();
  const operationalLocationId = operationalScope?.location.id ?? null;
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!ownerUserId) return;
    let active = true;
    const loadAccounts = async () => {
      setLoadingAccounts(true);
      const query = operationalLocationId
        ? fromTable('financial_accounts').select('*').eq('owner_user_id', ownerUserId).eq('location_id', operationalLocationId)
        : fromTable('financial_accounts').select('*').eq('owner_user_id', ownerUserId);
      const { data, error } = await query.order('due_date', { ascending: true }).limit(300);
      if (!active) return;
      if (error) {
        console.error('Erro ao carregar fluxo financeiro:', getRedactedLogValue(error));
        setFinancialAccounts([]);
      } else {
        setFinancialAccounts((data as unknown as FinancialAccount[]) ?? []);
      }
      setLoadingAccounts(false);
    };
    void loadAccounts();
    return () => {
      active = false;
    };
  }, [operationalLocationId, ownerUserId]);

  const filteredSales = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return sales.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
  }, [sales, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return expenses.filter(e => { 
      const d = new Date(e.date);
      const cat = (e.category || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isPDVCashOut = cat === 'saida de caixa' || cat === 'caixa' || cat === 'saida_pdv' || cat === 'sangria' || cat === 'suprimento';
      return !isPDVCashOut && d >= start && d <= end; 
    });
  }, [expenses, startDate, endDate]);

  const filteredAccounts = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00').getTime();
    const end = new Date(endDate + 'T23:59:59').getTime();
    return financialAccounts.filter(account => {
      const date = new Date(`${account.due_date}T12:00:00`).getTime();
      return date >= start && date <= end;
    });
  }, [endDate, financialAccounts, startDate]);

  const totalIncome = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenses;
  const openAccounts = filteredAccounts.filter(account => account.status === 'pending');
  const expectedReceivable = openAccounts
    .filter(account => account.account_type === 'receivable')
    .reduce((sum, account) => sum + getFinancialAccountRemainingAmount(account), 0);
  const expectedPayable = openAccounts
    .filter(account => account.account_type === 'payable')
    .reduce((sum, account) => sum + getFinancialAccountRemainingAmount(account), 0);
  const paidAccountsInPeriod = financialAccounts.filter(account => {
    if (account.status !== 'paid' || !account.paid_at) return false;
    const paidAt = new Date(account.paid_at).getTime();
    return paidAt >= new Date(startDate + 'T00:00:00').getTime() && paidAt <= new Date(endDate + 'T23:59:59').getTime();
  });
  const paidReceivable = paidAccountsInPeriod
    .filter(account => account.account_type === 'receivable')
    .reduce((sum, account) => sum + Number(account.paid_amount ?? account.amount ?? 0), 0);
  const paidPayable = paidAccountsInPeriod
    .filter(account => account.account_type === 'payable')
    .reduce((sum, account) => sum + Number(account.paid_amount ?? account.amount ?? 0), 0);
  const forecastBalance = totalIncome + expectedReceivable - totalExpenses - expectedPayable;
  const realizedBalance = totalIncome + paidReceivable - totalExpenses - paidPayable;
  const overdueAccounts = financialAccounts
    .filter(account => account.status === 'pending' && account.due_date < new Date().toISOString().slice(0, 10));
  const costCenterSummary = useMemo(() => {
    const map = new Map<string, { name: string; expenses: number; payable: number; receivable: number }>();
    const ensure = (name: string) => {
      const key = name.trim() || 'Sem centro';
      const current = map.get(key) ?? { name: key, expenses: 0, payable: 0, receivable: 0 };
      map.set(key, current);
      return current;
    };
    filteredExpenses.forEach(expense => {
      ensure(expense.cost_center || expense.category).expenses += Number(expense.amount ?? 0);
    });
    openAccounts.forEach(account => {
      const row = ensure(account.cost_center || 'Contas');
      if (account.account_type === 'payable') row.payable += getFinancialAccountRemainingAmount(account);
      if (account.account_type === 'receivable') row.receivable += getFinancialAccountRemainingAmount(account);
    });
    return Array.from(map.values()).sort((a, b) => (b.expenses + b.payable + b.receivable) - (a.expenses + a.payable + a.receivable)).slice(0, 8);
  }, [filteredExpenses, openAccounts]);

  // Accounts receivable (fiados)
  const activeClients = clients.filter(c => !c.deleted);
  const totalReceivable = activeClients.reduce((s, c) => s + getClientBalance(c.id), 0);

  const handleSave = async () => {
    if (!desc.trim() || !partyName.trim() || !amount) { toast.error('Preencha descrição, favorecido e valor'); return; }
    await addExpense(desc.trim(), parseDecimalInput(amount), category.trim(), {
      partyName: partyName.trim() || null,
      paymentMethod: paymentMethod.trim(),
      costCenter: costCenter.trim(),
      attachmentUrl: attachmentUrl.trim(),
    });
    setDesc(''); setAmount(''); setCategory(''); setPartyName(''); setPaymentMethod(''); setCostCenter(''); setAttachmentUrl(''); setOpen(false);
    toast.success('Despesa registrada!');
  };

  if (loading) {
    return <DataRouteLoader label="Carregando financeiro..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between" data-tour-id="financial-header">
        <h1 className="text-xl font-bold">💸 Financeiro</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" data-tour-id="financial-expense"><Plus className="h-4 w-4 mr-1" />Despesa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Descrição</Label><Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Aluguel" /></div>
              <div className="space-y-1"><Label>Pago a / favorecido</Label><Input value={partyName} onChange={e => setPartyName(e.target.value)} placeholder="Ex: Imobiliária ou fornecedor" /></div>
              <div className="space-y-1"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-1"><Label>Categoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex: Fornecedor, Aluguel" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Forma de pagamento</Label><Input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} placeholder="Pix, dinheiro, boleto" /></div>
                <div className="space-y-1"><Label>Centro de custo</Label><Input value={costCenter} onChange={e => setCostCenter(e.target.value)} placeholder="Operação, compras, marketing" /></div>
              </div>
              <div className="space-y-1"><Label>Comprovante</Label><Input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="Link ou referência do comprovante" /></div>
            </div>
            <DialogFooter><Button onClick={handleSave}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end" data-tour-id="financial-filters">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-40" /></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour-id="financial-stats">
        {[
          { label: 'Entradas realizadas', value: money(totalIncome), icon: TrendingUp, color: 'text-green-500' },
          { label: 'Saídas realizadas', value: money(totalExpenses), icon: TrendingDown, color: 'text-destructive' },
          { label: 'Saldo realizado', value: money(balance), icon: DollarSign, color: balance >= 0 ? 'text-green-500' : 'text-destructive' },
          { label: 'Fiado aberto', value: money(totalReceivable), icon: DollarSign, color: 'text-primary' },
          { label: 'A receber previsto', value: money(expectedReceivable), icon: TrendingUp, color: 'text-green-500' },
          { label: 'A pagar previsto', value: money(expectedPayable), icon: TrendingDown, color: 'text-destructive' },
          { label: 'Saldo previsto', value: money(forecastBalance), icon: DollarSign, color: forecastBalance >= 0 ? 'text-green-500' : 'text-destructive' },
          { label: 'Contas vencidas', value: String(overdueAccounts.length), icon: TrendingDown, color: overdueAccounts.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map((s, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-1 px-3 pt-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent className="px-3 pb-3"><p className={`text-lg font-bold ${s.color}`}>{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Fluxo previsto</CardTitle></CardHeader>
          <CardContent>
            {loadingAccounts ? <p className="text-xs text-muted-foreground">Carregando contas...</p> : openAccounts.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma conta aberta no período.</p> : (
              <div className="space-y-2">
                {openAccounts.slice(0, 12).map(account => (
                  <div key={account.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary/40 p-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{account.description}</p>
                      <p className="text-muted-foreground">{account.party_name || 'Sem favorecido'} · {formatDateOnly(account.due_date)}</p>
                      {(account.cost_center || account.payment_method) && <p className="text-muted-foreground">{[account.cost_center, account.payment_method].filter(Boolean).join(' · ')}</p>}
                    </div>
                    <span className={account.account_type === 'payable' ? 'shrink-0 font-bold text-destructive' : 'shrink-0 font-bold text-green-500'}>
                      {account.account_type === 'payable' ? '-' : '+'}{money(getFinancialAccountRemainingAmount(account))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Centro de custo</CardTitle></CardHeader>
          <CardContent>
            {costCenterSummary.length === 0 ? <p className="text-xs text-muted-foreground">Sem centro de custo no período.</p> : (
              <div className="space-y-2">
                {costCenterSummary.map(row => (
                  <div key={row.name} className="rounded-lg border bg-secondary/30 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.name}</p>
                      <p className="font-semibold">{money(row.receivable - row.expenses - row.payable)}</p>
                    </div>
                    <p className="mt-1 text-muted-foreground">Despesas {money(row.expenses)} · A pagar {money(row.payable)} · A receber {money(row.receivable)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expenses list */}
      <Card className="border-border/50" data-tour-id="financial-expenses-list">
        <CardHeader><CardTitle className="text-sm">Despesas</CardTitle></CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma despesa no período</p> : (
            <div className="space-y-2">
              {filteredExpenses.map(e => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-xs">
                  <div>
                    <p className="font-medium">{e.description}</p>
                    <p className="text-muted-foreground">{e.party_name || 'Favorecido não informado'} · {e.category} — {formatDateOnly(e.date)}</p>
                    {(e.cost_center || e.payment_method || e.attachment_url) && (
                      <p className="text-muted-foreground">
                        {[e.cost_center, e.payment_method, e.attachment_url ? 'Comprovante vinculado' : ''].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-destructive">{money(e.amount)}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Excluir despesa?</AlertDialogTitle><AlertDialogDescription>"{e.description}" será removida.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { deleteExpense(e.id); toast.success('Despesa excluída'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
