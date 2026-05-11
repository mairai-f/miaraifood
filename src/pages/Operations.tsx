import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Barcode, Boxes, CalendarClock, CheckCircle2, ClipboardCheck, FileDown, Loader2, PackagePlus, Percent, Plus, RefreshCw, ShieldCheck, TrendingUp, WalletCards } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { supabase } from '@/integrations/supabase/client';
import { parseDecimalInput } from '@/lib/numberInput';

type PurchaseOrder = {
  id: string;
  supplier_name: string;
  invoice_number: string;
  purchase_date: string;
  status: string;
  total_amount: number;
  notes: string;
};

type FinancialAccount = {
  id: string;
  account_type: 'payable' | 'receivable';
  description: string;
  party_name: string;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: 'pending' | 'paid' | 'canceled';
};

type ProductPromotion = {
  id: string;
  product_name: string;
  title: string;
  discount_type: 'amount' | 'percent' | 'fixed_price';
  discount_value: number;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
};

type ProductBatch = {
  id: string;
  product_name: string;
  batch_code: string;
  quantity: number;
  expiration_date: string;
  alert_days: number;
};

const fromTable = (table: string) => supabase.from(table as never);
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
const parseMoney = (value: string) => Math.max(0, parseDecimalInput(value));
const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const daysUntil = (value: string) => {
  const date = new Date(`${value}T00:00:00`).getTime();
  const now = new Date(`${today()}T00:00:00`).getTime();
  return Math.ceil((date - now) / 86400000);
};

export default function Operations() {
  const { user, ownerUserId } = useAuth();
  const {
    products,
    clients,
    debtEntries,
    sales,
    saleItems,
    stockMovements,
    expenses,
    updateProduct,
    offlinePreparationStatus,
    offlinePreparationMessage,
    offlineSnapshotUpdatedAt,
    refetch,
  } = useData();
  const effectiveOwnerId = ownerUserId ?? user?.id ?? '';
  const activeProducts = useMemo(() => products.filter((product) => !product.deleted), [products]);

  const [loading, setLoading] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [batches, setBatches] = useState<ProductBatch[]>([]);

  const [purchaseForm, setPurchaseForm] = useState({
    supplier_name: '',
    invoice_number: '',
    purchase_date: today(),
    product_id: '',
    quantity: '',
    unit_cost: '',
    freight_amount: '',
    tax_amount: '',
    due_date: today(),
    create_payable: true,
    receive_stock: true,
    notes: '',
  });

  const [accountForm, setAccountForm] = useState({
    account_type: 'payable' as 'payable' | 'receivable',
    description: '',
    party_name: '',
    amount: '',
    due_date: today(),
    notes: '',
  });

  const [labelForm, setLabelForm] = useState({ product_id: '', quantity: '12' });
  const [promotionForm, setPromotionForm] = useState({
    product_id: '',
    title: '',
    discount_type: 'amount' as 'amount' | 'percent' | 'fixed_price',
    discount_value: '',
    starts_at: today(),
    ends_at: '',
    notes: '',
  });
  const [batchForm, setBatchForm] = useState({
    product_id: '',
    batch_code: '',
    quantity: '',
    expiration_date: today(),
    alert_days: '30',
    notes: '',
  });

  const expiringBatches = useMemo(
    () => batches.filter((batch) => daysUntil(batch.expiration_date) <= Number(batch.alert_days ?? 30)),
    [batches],
  );

  const todaySales = useMemo(
    () => sales.filter((sale) => sale.date?.slice(0, 10) === today() && sale.status !== 'canceled'),
    [sales],
  );

  const todaySaleIds = useMemo(() => new Set(todaySales.map((sale) => sale.id)), [todaySales]);

  const todayGrossTotal = useMemo(
    () => todaySales.reduce((sum, sale) => sum + Number(sale.total ?? 0), 0),
    [todaySales],
  );

  const todayProfitTotal = useMemo(
    () => saleItems
      .filter((item) => todaySaleIds.has(item.sale_id))
      .reduce((sum, item) => {
        const fallbackProfit = Number(item.net_total ?? item.total ?? 0) - Number(item.cost_price ?? 0) * Number(item.quantity ?? 0);
        return sum + Number(item.total_profit ?? fallbackProfit);
      }, 0),
    [saleItems, todaySaleIds],
  );

  const currentMonth = today().slice(0, 7);
  const monthExpensesTotal = useMemo(
    () => expenses
      .filter((expense) => expense.date?.slice(0, 7) === currentMonth)
      .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
    [expenses, currentMonth],
  );

  const openFiadoTotal = useMemo(
    () => debtEntries
      .filter((entry) => entry.status === 'pending' && !entry.deleted)
      .reduce((sum, entry) => sum + Number(entry.total ?? 0), 0),
    [debtEntries],
  );

  const pendingAccountsTotal = useMemo(
    () => accounts
      .filter((account) => account.status === 'pending')
      .reduce((sum, account) => sum + Number(account.amount ?? 0), 0),
    [accounts],
  );

  const selectedPurchaseProduct = activeProducts.find((product) => product.id === purchaseForm.product_id);
  const selectedLabelProduct = activeProducts.find((product) => product.id === labelForm.product_id);

  const onboardingItems = useMemo(() => [
    { label: 'Cadastrar produtos', done: activeProducts.length > 0 },
    { label: 'Cadastrar clientes', done: clients.length > 0 },
    { label: 'Registrar primeira compra', done: purchases.length > 0 },
    { label: 'Organizar contas a pagar/receber', done: accounts.length > 0 },
    { label: 'Criar promoção inicial', done: promotions.length > 0 },
    { label: 'Controlar validade/lote', done: batches.length > 0 },
    { label: 'Preparar operação offline', done: offlinePreparationStatus === 'ready' },
  ], [accounts.length, activeProducts.length, batches.length, clients.length, offlinePreparationStatus, promotions.length, purchases.length]);

  const onboardingProgress = Math.round((onboardingItems.filter((item) => item.done).length / onboardingItems.length) * 100);

  const auditEvents = useMemo(() => {
    const canceledSales = sales
      .filter((sale) => sale.status === 'canceled')
      .slice(0, 8)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        date: sale.date,
        title: 'Venda cancelada',
        detail: `${money(sale.total)}${sale.cancel_reason ? ` - ${sale.cancel_reason}` : ''}`,
      }));
    const stockAdjustments = stockMovements
      .filter((movement) => !['sale', 'purchase'].includes(String(movement.reason ?? '').toLowerCase()))
      .slice(0, 8)
      .map((movement) => ({
        id: `stock-${movement.id}`,
        date: movement.date,
        title: 'Movimento de estoque',
        detail: `${movement.type} ${movement.quantity} - ${movement.reason || 'Sem motivo'}`,
      }));
    const overdueAccounts = accounts
      .filter((account) => account.status === 'pending' && account.due_date < today())
      .slice(0, 8)
      .map((account) => ({
        id: `account-${account.id}`,
        date: account.due_date,
        title: account.account_type === 'payable' ? 'Conta vencida a pagar' : 'Conta vencida a receber',
        detail: `${account.description} - ${money(account.amount)}`,
      }));

    return [...overdueAccounts, ...canceledSales, ...stockAdjustments]
      .sort((left, right) => String(right.date).localeCompare(String(left.date)))
      .slice(0, 20);
  }, [accounts, sales, stockMovements]);

  const loadOperations = useCallback(async () => {
    if (!effectiveOwnerId) return;
    setLoading(true);

    const [purchaseResult, accountResult, promotionResult, batchResult] = await Promise.all([
      fromTable('purchase_orders').select('*').eq('owner_user_id', effectiveOwnerId).order('purchase_date', { ascending: false }).limit(20),
      fromTable('financial_accounts').select('*').eq('owner_user_id', effectiveOwnerId).order('due_date', { ascending: true }).limit(80),
      fromTable('product_promotions').select('*').eq('owner_user_id', effectiveOwnerId).order('created_at', { ascending: false }).limit(60),
      fromTable('product_batches').select('*').eq('owner_user_id', effectiveOwnerId).order('expiration_date', { ascending: true }).limit(80),
    ]);

    setLoading(false);

    const error = purchaseResult.error || accountResult.error || promotionResult.error || batchResult.error;
    if (error) {
      console.error('Erro ao carregar operações:', error);
      toast.error('Não foi possível carregar os módulos operacionais.');
      return;
    }

    setPurchases(purchaseResult.data ?? []);
    setAccounts(accountResult.data ?? []);
    setPromotions(promotionResult.data ?? []);
    setBatches(batchResult.data ?? []);
  }, [effectiveOwnerId]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const savePurchase = async () => {
    if (!effectiveOwnerId) return;
    if (!selectedPurchaseProduct) {
      toast.error('Escolha o produto comprado.');
      return;
    }

    const quantity = parseMoney(purchaseForm.quantity);
    const unitCost = parseMoney(purchaseForm.unit_cost);
    const freight = parseMoney(purchaseForm.freight_amount);
    const tax = parseMoney(purchaseForm.tax_amount);
    const subtotal = quantity * unitCost;
    const total = subtotal + freight + tax;

    if (quantity <= 0 || unitCost <= 0) {
      toast.error('Informe quantidade e custo unitário.');
      return;
    }

    const { data: order, error: orderError } = await fromTable('purchase_orders')
      .insert({
        owner_user_id: effectiveOwnerId,
        supplier_name: purchaseForm.supplier_name.trim(),
        invoice_number: purchaseForm.invoice_number.trim(),
        purchase_date: purchaseForm.purchase_date,
        status: purchaseForm.receive_stock ? 'received' : 'open',
        subtotal,
        freight_amount: freight,
        tax_amount: tax,
        total_amount: total,
        notes: purchaseForm.notes.trim(),
      })
      .select('*')
      .single();

    if (orderError) {
      console.error('Erro ao salvar compra:', orderError);
      toast.error('Não foi possível registrar a compra.');
      return;
    }

    const { error: itemError } = await fromTable('purchase_order_items').insert({
      owner_user_id: effectiveOwnerId,
      purchase_order_id: order.id,
      product_id: selectedPurchaseProduct.id,
      product_name: selectedPurchaseProduct.name,
      quantity,
      unit_cost: unitCost,
      total_cost: subtotal,
    });

    if (itemError) {
      console.error('Erro ao salvar item da compra:', itemError);
      toast.error('Compra criada, mas o item não foi registrado.');
    }

    if (purchaseForm.create_payable) {
      await fromTable('financial_accounts').insert({
        owner_user_id: effectiveOwnerId,
        account_type: 'payable',
        description: `Compra ${selectedPurchaseProduct.name}`,
        party_name: purchaseForm.supplier_name.trim(),
        amount: total,
        due_date: purchaseForm.due_date,
        source: 'purchase',
        notes: purchaseForm.invoice_number ? `NF ${purchaseForm.invoice_number}` : purchaseForm.notes.trim(),
      });
    }

    if (purchaseForm.receive_stock) {
      await updateProduct(selectedPurchaseProduct.id, {
        stock: Number(selectedPurchaseProduct.stock ?? 0) + quantity,
        purchase_cost: unitCost,
      });
    }

    toast.success('Compra registrada.');
    setPurchaseForm({
      supplier_name: '',
      invoice_number: '',
      purchase_date: today(),
      product_id: '',
      quantity: '',
      unit_cost: '',
      freight_amount: '',
      tax_amount: '',
      due_date: today(),
      create_payable: true,
      receive_stock: true,
      notes: '',
    });
    await loadOperations();
  };

  const saveAccount = async () => {
    if (!effectiveOwnerId) return;
    const amount = parseMoney(accountForm.amount);
    if (!accountForm.description.trim() || amount <= 0) {
      toast.error('Informe descrição e valor.');
      return;
    }

    const { error } = await fromTable('financial_accounts').insert({
      owner_user_id: effectiveOwnerId,
      account_type: accountForm.account_type,
      description: accountForm.description.trim(),
      party_name: accountForm.party_name.trim(),
      amount,
      due_date: accountForm.due_date,
      notes: accountForm.notes.trim(),
    });

    if (error) {
      console.error('Erro ao salvar conta:', error);
      toast.error('Não foi possível salvar a conta.');
      return;
    }

    toast.success('Conta registrada.');
    setAccountForm({ account_type: 'payable', description: '', party_name: '', amount: '', due_date: today(), notes: '' });
    await loadOperations();
  };

  const markAccountPaid = async (account: FinancialAccount) => {
    const { error } = await fromTable('financial_accounts')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', account.id);

    if (error) {
      toast.error('Não foi possível marcar como pago.');
      return;
    }

    await loadOperations();
  };

  const printLabels = () => {
    if (!selectedLabelProduct) {
      toast.error('Escolha um produto para imprimir etiqueta.');
      return;
    }

    const quantity = Math.max(1, Math.min(120, Number.parseInt(labelForm.quantity, 10) || 1));
    const labels = Array.from({ length: quantity }, () => selectedLabelProduct);
    const content = `
      <html>
        <head>
          <title>Etiquetas HappyCash</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 12px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
            .label { border: 1px dashed #222; border-radius: 6px; padding: 8px; min-height: 74px; display: flex; flex-direction: column; justify-content: center; }
            .name { font-size: 12px; font-weight: 700; }
            .price { font-size: 20px; font-weight: 800; margin-top: 4px; }
            .code { font-size: 10px; letter-spacing: 2px; margin-top: 6px; }
            @media print { body { margin: 0; } .label { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid">
            ${labels.map((product) => `
              <div class="label">
                <div class="name">${product.name}</div>
                <div class="price">${money(product.price)}</div>
                <div class="code">${product.barcode || product.code || product.id.slice(0, 8)}</div>
              </div>
            `).join('')}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    printWindow?.document.write(content);
    printWindow?.document.close();
  };

  const savePromotion = async () => {
    if (!effectiveOwnerId) return;
    const product = activeProducts.find((item) => item.id === promotionForm.product_id);
    const value = parseMoney(promotionForm.discount_value);
    if (!product || !promotionForm.title.trim() || value <= 0) {
      toast.error('Informe produto, nome da promoção e valor.');
      return;
    }

    const { error } = await fromTable('product_promotions').insert({
      owner_user_id: effectiveOwnerId,
      product_id: product.id,
      product_name: product.name,
      title: promotionForm.title.trim(),
      discount_type: promotionForm.discount_type,
      discount_value: value,
      starts_at: promotionForm.starts_at,
      ends_at: promotionForm.ends_at || null,
      notes: promotionForm.notes.trim(),
    });

    if (error) {
      toast.error('Não foi possível salvar a promoção.');
      return;
    }

    toast.success('Promoção cadastrada.');
    setPromotionForm({ product_id: '', title: '', discount_type: 'amount', discount_value: '', starts_at: today(), ends_at: '', notes: '' });
    await loadOperations();
  };

  const saveBatch = async () => {
    if (!effectiveOwnerId) return;
    const product = activeProducts.find((item) => item.id === batchForm.product_id);
    if (!product || !batchForm.expiration_date) {
      toast.error('Escolha produto e validade.');
      return;
    }

    const { error } = await fromTable('product_batches').insert({
      owner_user_id: effectiveOwnerId,
      product_id: product.id,
      product_name: product.name,
      batch_code: batchForm.batch_code.trim(),
      quantity: parseMoney(batchForm.quantity),
      expiration_date: batchForm.expiration_date,
      alert_days: Math.max(0, Number.parseInt(batchForm.alert_days, 10) || 30),
      notes: batchForm.notes.trim(),
    });

    if (error) {
      toast.error('Não foi possível salvar validade/lote.');
      return;
    }

    toast.success('Validade cadastrada.');
    setBatchForm({ product_id: '', batch_code: '', quantity: '', expiration_date: today(), alert_days: '30', notes: '' });
    await loadOperations();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operações</h1>
          <p className="text-sm text-muted-foreground">
            Compras, contas, etiquetas, promoções, validade e sincronização em um só lugar.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadOperations()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {expiringBatches.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Produtos com validade próxima</AlertTitle>
          <AlertDescription>
            {expiringBatches.length} lote(s) estão vencidos ou dentro do prazo de alerta configurado.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Compras recentes</p><p className="text-2xl font-bold">{purchases.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendente financeiro</p><p className="text-2xl font-bold">{money(pendingAccountsTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Promoções ativas</p><p className="text-2xl font-bold">{promotions.filter((item) => item.active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Alertas de validade</p><p className="text-2xl font-bold">{expiringBatches.length}</p></CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendas hoje</p><p className="text-2xl font-bold">{money(todayGrossTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lucro estimado hoje</p><p className="text-2xl font-bold">{money(todayProfitTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Despesas do mês</p><p className="text-2xl font-bold">{money(monthExpensesTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Fiado em aberto</p><p className="text-2xl font-bold">{money(openFiadoTotal)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="compras" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="implantacao">Implantação</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
          <TabsTrigger value="promocoes">Promoções</TabsTrigger>
          <TabsTrigger value="validade">Validade</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="implantacao" className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5" /> Implantação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Progresso</p>
                <p className="text-3xl font-bold">{onboardingProgress}%</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${onboardingProgress}%` }} />
              </div>
              <div className="space-y-2">
                {onboardingItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm font-medium">{item.label}</span>
                    <Badge variant={item.done ? 'default' : 'outline'}>{item.done ? 'OK' : 'Pendente'}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Próximas ações</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {onboardingItems.filter((item) => !item.done).slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-md border p-4">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Pendente na implantação da loja.</p>
                </div>
              ))}
              {onboardingItems.every((item) => item.done) && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Implantação completa</AlertTitle>
                  <AlertDescription>Os pontos principais da operação já foram configurados.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicadores">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Lucro real</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Indicador</TableHead><TableHead>Valor</TableHead><TableHead>Base</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow><TableCell>Vendas de hoje</TableCell><TableCell>{money(todayGrossTotal)}</TableCell><TableCell>{todaySales.length} venda(s)</TableCell></TableRow>
                  <TableRow><TableCell>Lucro estimado de hoje</TableCell><TableCell>{money(todayProfitTotal)}</TableCell><TableCell>Itens vendidos com custo</TableCell></TableRow>
                  <TableRow><TableCell>Despesas do mês</TableCell><TableCell>{money(monthExpensesTotal)}</TableCell><TableCell>{currentMonth}</TableCell></TableRow>
                  <TableRow><TableCell>Fiado em aberto</TableCell><TableCell>{money(openFiadoTotal)}</TableCell><TableCell>Dívidas pendentes</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compras" className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><PackagePlus className="h-5 w-5" /> Registrar compra</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Fornecedor</Label><Input value={purchaseForm.supplier_name} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>NF / documento</Label><Input value={purchaseForm.invoice_number} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_number: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={purchaseForm.purchase_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchase_date: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, due_date: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Select value={purchaseForm.product_id} onValueChange={(value) => setPurchaseForm({ ...purchaseForm, product_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Escolha um produto" /></SelectTrigger>
                  <SelectContent>{activeProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5"><Label>Qtd.</Label><Input inputMode="decimal" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Custo un.</Label><Input inputMode="decimal" value={purchaseForm.unit_cost} onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Frete</Label><Input inputMode="decimal" value={purchaseForm.freight_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, freight_amount: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Imposto</Label><Input inputMode="decimal" value={purchaseForm.tax_amount} onChange={(e) => setPurchaseForm({ ...purchaseForm, tax_amount: e.target.value })} /></div>
              </div>
              <Textarea value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="Observações da compra" />
              <div className="flex flex-wrap gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.receive_stock} onChange={(e) => setPurchaseForm({ ...purchaseForm, receive_stock: e.target.checked })} /> Entrar no estoque</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={purchaseForm.create_payable} onChange={(e) => setPurchaseForm({ ...purchaseForm, create_payable: e.target.checked })} /> Gerar conta a pagar</label>
              </div>
              <Button onClick={() => void savePurchase()} className="gap-2"><Plus className="h-4 w-4" /> Salvar compra</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Últimas compras</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Fornecedor</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{purchases.map((purchase) => (
                  <TableRow key={purchase.id}><TableCell>{formatDate(purchase.purchase_date)}</TableCell><TableCell>{purchase.supplier_name || '-'}</TableCell><TableCell>{money(purchase.total_amount)}</TableCell><TableCell><Badge variant="outline">{purchase.status}</Badge></TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contas" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Nova conta</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={accountForm.account_type} onValueChange={(value: 'payable' | 'receivable') => setAccountForm({ ...accountForm, account_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="payable">Conta a pagar</SelectItem><SelectItem value="receivable">Conta a receber</SelectItem></SelectContent>
              </Select>
              <Input placeholder="Descrição" value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} />
              <Input placeholder="Fornecedor ou cliente" value={accountForm.party_name} onChange={(e) => setAccountForm({ ...accountForm, party_name: e.target.value })} list="known-parties" />
              <datalist id="known-parties">{clients.map((client) => <option key={client.id} value={client.name} />)}</datalist>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input inputMode="decimal" placeholder="Valor" value={accountForm.amount} onChange={(e) => setAccountForm({ ...accountForm, amount: e.target.value })} />
                <Input type="date" value={accountForm.due_date} onChange={(e) => setAccountForm({ ...accountForm, due_date: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={accountForm.notes} onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })} />
              <Button onClick={() => void saveAccount()}>Salvar conta</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Agenda financeira</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Vence</TableHead><TableHead>Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>{accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell><Badge variant={account.account_type === 'payable' ? 'destructive' : 'secondary'}>{account.account_type === 'payable' ? 'Pagar' : 'Receber'}</Badge></TableCell>
                    <TableCell><p className="font-medium">{account.description}</p><p className="text-xs text-muted-foreground">{account.party_name}</p></TableCell>
                    <TableCell>{formatDate(account.due_date)}</TableCell>
                    <TableCell>{money(account.amount)}</TableCell>
                    <TableCell>{account.status === 'pending' && <Button size="sm" variant="outline" onClick={() => void markAccountPaid(account)}>Pago</Button>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="etiquetas" className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Barcode className="h-5 w-5" /> Etiquetas</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={labelForm.product_id} onValueChange={(value) => setLabelForm({ ...labelForm, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
                <SelectContent>{activeProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min="1" max="120" value={labelForm.quantity} onChange={(e) => setLabelForm({ ...labelForm, quantity: e.target.value })} />
              <Button onClick={printLabels} className="gap-2"><FileDown className="h-4 w-4" /> Imprimir etiquetas</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Prévia</CardTitle></CardHeader>
            <CardContent>
              <div className="max-w-xs rounded-md border border-dashed p-4">
                <p className="text-sm font-semibold">{selectedLabelProduct?.name || 'Produto'}</p>
                <p className="mt-1 text-2xl font-black">{money(selectedLabelProduct?.price ?? 0)}</p>
                <p className="mt-2 text-xs tracking-[0.2em] text-muted-foreground">{selectedLabelProduct?.barcode || 'CODIGO'}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="promocoes" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Nova promoção</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={promotionForm.product_id} onValueChange={(value) => setPromotionForm({ ...promotionForm, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>{activeProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Nome da promoção" value={promotionForm.title} onChange={(e) => setPromotionForm({ ...promotionForm, title: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select value={promotionForm.discount_type} onValueChange={(value: 'amount' | 'percent' | 'fixed_price') => setPromotionForm({ ...promotionForm, discount_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="amount">Desconto em R$</SelectItem><SelectItem value="percent">Desconto em %</SelectItem><SelectItem value="fixed_price">Preço fixo</SelectItem></SelectContent>
                </Select>
                <Input inputMode="decimal" placeholder="Valor" value={promotionForm.discount_value} onChange={(e) => setPromotionForm({ ...promotionForm, discount_value: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" value={promotionForm.starts_at} onChange={(e) => setPromotionForm({ ...promotionForm, starts_at: e.target.value })} />
                <Input type="date" value={promotionForm.ends_at} onChange={(e) => setPromotionForm({ ...promotionForm, ends_at: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={promotionForm.notes} onChange={(e) => setPromotionForm({ ...promotionForm, notes: e.target.value })} />
              <Button onClick={() => void savePromotion()}>Salvar promoção</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Promoções cadastradas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {promotions.map((promotion) => (
                <div key={promotion.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium">{promotion.title}</p><p className="text-sm text-muted-foreground">{promotion.product_name}</p></div>
                    <Badge variant={promotion.active ? 'default' : 'outline'}>{promotion.active ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  <p className="mt-2 text-sm">Valor: {promotion.discount_type === 'percent' ? `${promotion.discount_value}%` : money(promotion.discount_value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validade" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Validade e lote</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <Select value={batchForm.product_id} onValueChange={(value) => setBatchForm({ ...batchForm, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>{activeProducts.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input placeholder="Lote" value={batchForm.batch_code} onChange={(e) => setBatchForm({ ...batchForm, batch_code: e.target.value })} />
                <Input inputMode="decimal" placeholder="Quantidade" value={batchForm.quantity} onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })} />
                <Input type="date" value={batchForm.expiration_date} onChange={(e) => setBatchForm({ ...batchForm, expiration_date: e.target.value })} />
                <Input type="number" min="0" value={batchForm.alert_days} onChange={(e) => setBatchForm({ ...batchForm, alert_days: e.target.value })} />
              </div>
              <Textarea placeholder="Observações" value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} />
              <Button onClick={() => void saveBatch()}>Salvar validade</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lotes monitorados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead>Lote</TableHead><TableHead>Validade</TableHead><TableHead>Qtd.</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{batches.map((batch) => {
                  const remaining = daysUntil(batch.expiration_date);
                  return (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.product_name}</TableCell><TableCell>{batch.batch_code || '-'}</TableCell><TableCell>{formatDate(batch.expiration_date)}</TableCell><TableCell>{batch.quantity}</TableCell>
                      <TableCell><Badge variant={remaining < 0 ? 'destructive' : remaining <= batch.alert_days ? 'secondary' : 'outline'}>{remaining < 0 ? 'Vencido' : `${remaining} dias`}</Badge></TableCell>
                    </TableRow>
                  );
                })}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Backup e sincronização</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Status local</AlertTitle>
                <AlertDescription>
                  Preparação offline: {offlinePreparationStatus}. {offlinePreparationMessage || 'Sem mensagem adicional.'}
                </AlertDescription>
              </Alert>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Última cópia offline</p><p className="font-semibold">{offlineSnapshotUpdatedAt ? new Date(offlineSnapshotUpdatedAt).toLocaleString('pt-BR') : 'Ainda não preparada'}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Produtos carregados</p><p className="font-semibold">{products.length}</p></div>
                <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Clientes carregados</p><p className="font-semibold">{clients.length}</p></div>
              </div>
              <Button onClick={() => void refetch()} className="gap-2"><RefreshCw className="h-4 w-4" /> Sincronizar agora</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Auditoria comercial</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Evento</TableHead><TableHead>Detalhe</TableHead></TableRow></TableHeader>
                <TableBody>
                  {auditEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDate(event.date)}</TableCell>
                      <TableCell>{event.title}</TableCell>
                      <TableCell>{event.detail}</TableCell>
                    </TableRow>
                  ))}
                  {auditEvents.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-muted-foreground">Nenhum evento crítico recente.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
