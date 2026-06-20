import { useState, useMemo } from 'react';
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
import { formatDateOnly } from '../../shared/locale/format';

export default function Financial() {
  const { sales, expenses, addExpense, deleteExpense, clients, getClientBalance } = useData();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [partyName, setPartyName] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredSales = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return sales.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
  }, [sales, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return expenses.filter(e => { const d = new Date(e.date); return d >= start && d <= end; });
  }, [expenses, startDate, endDate]);

  const totalIncome = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Accounts receivable (fiados)
  const activeClients = clients.filter(c => !c.deleted);
  const totalReceivable = activeClients.reduce((s, c) => s + getClientBalance(c.id), 0);

  const handleSave = async () => {
    if (!desc.trim() || !partyName.trim() || !amount) { toast.error('Preencha descrição, favorecido e valor'); return; }
    await addExpense(desc.trim(), parseFloat(amount), category.trim(), { partyName: partyName.trim() || null });
    setDesc(''); setAmount(''); setCategory(''); setPartyName(''); setOpen(false);
    toast.success('Despesa registrada!');
  };

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
          { label: 'Entradas', value: `R$ ${totalIncome.toFixed(2)}`, icon: TrendingUp, color: 'text-green-500' },
          { label: 'Saídas', value: `R$ ${totalExpenses.toFixed(2)}`, icon: TrendingDown, color: 'text-destructive' },
          { label: 'Saldo', value: `R$ ${balance.toFixed(2)}`, icon: DollarSign, color: balance >= 0 ? 'text-green-500' : 'text-destructive' },
          { label: 'A Receber (Fiados)', value: `R$ ${totalReceivable.toFixed(2)}`, icon: DollarSign, color: 'text-primary' },
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
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-destructive">R$ {e.amount.toFixed(2)}</span>
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
