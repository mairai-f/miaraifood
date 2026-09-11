import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Armchair, Bell, BellOff, Calculator, ChefHat, Copy, Download, Loader2, Play, Plus, Printer, QrCode, UsersRound, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseDecimalInput } from '@/lib/numberInput';
import { planTablePaymentConfirmation } from '@/lib/tablePayments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/contexts/usePermissions';
import { closeFoodTableSession, createFoodTable, getFoodTableQrToken, listFoodTableBoard, listFoodTableConsumption, listFoodTablePaymentSplits, openFoodTableSession, splitFoodTableBill } from '@/lib/food';
import type { FoodTableBoardItem, FoodTablePaymentSplit } from '@/types/food';
import { enableWaiterNotifications, notifyWaiterCall, playWaiterCallAlert, readWaiterAlertPreferences, writeWaiterAlertPreferences } from '@/lib/waiterAlerts';

const statusLabel = {
  open: 'Ocupada',
  awaiting_payment: 'Aguardando conta',
  closed: 'Fechada',
  cancelled: 'Cancelada',
} as const;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character] ?? character);

// method e provider sao campos distintos no banco: method alimenta o CHECK de
// store_payment_transactions, provider aponta para o provedor habilitado.
// Dinheiro nao tem provedor -- e recebido na mao.
//
// Cartao fica fora ate existir integracao de verdade. Nada hoje cria a
// cobranca no Mercado Pago, e o payment-webhook procura a transacao por
// provider_transaction_id, campo que a criacao nunca preenche -- entao a
// transacao ficaria 'pending' para sempre e a mesa jamais fecharia.
const PAYMENT_OPTIONS = {
  pix: { label: 'Pix', method: 'pix', provider: 'pix_manual' },
  cash: { label: 'Dinheiro', method: 'cash', provider: null },
} as const;
type PaymentOptionId = keyof typeof PAYMENT_OPTIONS;

export default function FoodTables() {
  const { scope, loading: scopeLoading } = useOperationalScope();
  const { hasPermission } = usePermissions();
  const [tables, setTables] = useState<FoodTableBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<FoodTableBoardItem | null>(null);
  const [peopleCount, setPeopleCount] = useState('1');
  const [peopleCountByTable, setPeopleCountByTable] = useState<Record<string,string>>({});
  const [splits, setSplits] = useState<FoodTablePaymentSplit[]>([]);
  const [consumption, setConsumption] = useState<Array<{ id: string; product_name: string; quantity: number; unit_price: number; line_total: number }>>([]);
  const [tableOrders, setTableOrders] = useState<Array<{ id: string; status: string; created_at: string }>>([]);
  const [paymentCalls, setPaymentCalls] = useState<any[]>([]);
  const [paymentParts, setPaymentParts] = useState<Array<{ method: string; provider: string | null; amount: number; label?: string }>>([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirmedPaid, setConfirmedPaid] = useState(0);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentOptionId>('pix');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [code, setCode] = useState('');
  const [seats, setSeats] = useState('4');
  const canManage = hasPermission('food.tables.manage');
  const canManageQr = hasPermission('food.qr.manage');
  const [alertPreferences, setAlertPreferences] = useState(readWaiterAlertPreferences);
  const initializedCallsRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!scope?.location.id) {
      setTables([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTables(await listFoodTableBoard(scope.location.id));
      const { data: calls } = await (supabase as any).from('food_waiter_calls').select('id,table_session_id,status,created_at,food_table_sessions(table_id)').eq('status','open').order('created_at', { ascending: false });
      setPaymentCalls(calls ?? []);
    } catch (error) {
      console.error('Não foi possível carregar as mesas:', error);
      toast.error('Não foi possível carregar as mesas desta filial.');
    } finally {
      setLoading(false);
    }
  }, [scope?.location.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!scope?.location.id) return;
    const channel = supabase
      .channel(`waiter-calls-${scope.location.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_waiter_calls' }, (payload) => {
        const call = payload.new as { status?: string; table_session_id?: string };
        if (call.status !== 'open') return;
        const table = tables.find((item) => item.activeSession?.id === call.table_session_id);
        const tableCode = table?.code ?? 'Uma mesa';
        playWaiterCallAlert();
        notifyWaiterCall(tableCode);
        toast.info(`${tableCode} chamou o garçom pelo QR Menu.`);
        void refresh();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, scope?.location.id, tables]);
  useEffect(() => {
    // The initial load is not an alert: only calls that arrive after the waiter opened the page are audible.
    if (!loading) initializedCallsRef.current = true;
  }, [loading]);

  const toggleSound = () => {
    const next = { ...alertPreferences, soundEnabled: !alertPreferences.soundEnabled };
    writeWaiterAlertPreferences(next);
    setAlertPreferences(next);
  };

  const activateNotifications = async () => {
    const enabled = await enableWaiterNotifications();
    const next = { ...readWaiterAlertPreferences(), notificationsEnabled: enabled };
    setAlertPreferences(next);
    toast[enabled ? 'success' : 'warning'](enabled ? 'Notificações do garçom ativadas.' : 'Permita as notificações no navegador para ativá-las.');
  };
  useEffect(() => {
    const sessionId = selectedTable?.activeSession?.id;
    const count = Number(peopleCount);
    if (!sessionId || !Number.isInteger(count) || count < 1 || count > 100) return;
    void splitFoodTableBill(sessionId, count).then(setSplits).catch(() => undefined);
  }, [peopleCount, selectedTable?.activeSession?.id]);
  useEffect(() => {
    const total = consumption.reduce((sum, item) => sum + item.line_total, 0);
    const pendingPeople = Math.max(1, (Number(peopleCount) || 1) - paymentParts.length);
    const paid = paymentParts.reduce((sum, part) => sum + part.amount, 0);
    if (total > 0) setPaymentAmount(Math.max(0, (total - paid) / pendingPeople).toFixed(2));
  }, [consumption, peopleCount, paymentParts.length]);

  useEffect(() => {
    if (!selectedTable) { setQrDataUrl(''); setQrToken(''); return; }
    void (async () => {
      try {
        const token = await getFoodTableQrToken(selectedTable.id);
        setQrToken(token);
        const dataUrl = await QRCode.toDataURL(`${window.location.origin}/qrmenu/${token}`, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
        setQrDataUrl(dataUrl);
      } catch (err) {
        const fallbackToken = (selectedTable.id.replace(/-/g, '') + '0123456789abcdef0123456789abcdef').slice(0, 64);
        setQrToken(fallbackToken);
        const dataUrl = await QRCode.toDataURL(`${window.location.origin}/qrmenu/${fallbackToken}`, { width: 360, margin: 2 });
        setQrDataUrl(dataUrl);
      }
    })();
  }, [selectedTable]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scope?.location.id || !code.trim()) return;
    const parsedSeats = Number(seats);
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 100) {
      toast.error('Informe entre 1 e 100 lugares.');
      return;
    }
    setCreating(true);
    try {
      await createFoodTable({ location_id: scope.location.id, code, seats: parsedSeats });
      setCode('');
      setSeats('4');
      toast.success('Mesa criada. O QR poderá ser configurado na próxima etapa.');
      await refresh();
    } catch (error) {
      console.error('Não foi possível criar a mesa:', error);
      toast.error('Não foi possível criar a mesa. Verifique se o código já existe.');
    } finally {
      setCreating(false);
    }
  };

  const openTable = async (table: FoodTableBoardItem) => {
    setOpeningTableId(table.id);
    try {
      await openFoodTableSession(table.id);
      toast.success(`${table.code} aberta.`);
      await refresh();
    } catch (error) {
      console.error('Não foi possível abrir a mesa:', error);
      toast.error('Não foi possível abrir a mesa. Ela pode já estar ocupada.');
    } finally {
      setOpeningTableId(null);
    }
  };

  const openTableModal = async (table: FoodTableBoardItem) => {
    setSelectedTable(table);
    setSplits([]); setConsumption([]); setTableOrders([]);
    setPaymentParts([]); setPaymentAmount(''); setPaymentConfirmed(false); setConfirmedPaid(0);
    setPeopleCount(peopleCountByTable[table.id] ?? String(table.activeSession?.guest_count ?? 1));
    if (!table.activeSession) return;
    try { const [nextSplits, nextConsumption] = await Promise.all([listFoodTablePaymentSplits(table.activeSession.id), listFoodTableConsumption(table.activeSession.id)]); setSplits(nextSplits); setConsumption(nextConsumption); const db=supabase as any; const {data: orders}=await db.from('food_orders').select('id,status,created_at').eq('table_session_id', table.activeSession.id).order('created_at', { ascending: false }); setTableOrders(orders ?? []); const ids=(orders??[]).map((o:any)=>o.id); if(ids.length){ const {data: tx}=await db.from('store_payment_transactions').select('amount,status').in('order_id',ids).eq('status','paid'); setConfirmedPaid((tx??[]).reduce((sum:number,t:any)=>sum+Number(t.amount),0)); } }
    catch { toast.error('Não foi possível carregar a divisão desta mesa.'); }
  };

  const calculateSplit = async () => {
    const sessionId = selectedTable?.activeSession?.id;
    const count = Number(peopleCount);
    if (!sessionId || !Number.isInteger(count) || count < 1 || count > 100) {
      toast.error('Informe entre 1 e 100 pessoas.');
      return;
    }
    setSplitting(true);
    try {
      setSplits(await splitFoodTableBill(sessionId, count));
      toast.success('Conta dividida entre as pessoas.');
    } catch (error) {
      console.error('Não foi possível dividir a conta:', error);
      toast.error('Não foi possível dividir esta conta agora.');
    } finally { setSplitting(false); }
  };
  const closeTable = async () => {
    if (!selectedTable?.activeSession || !hasPermission('food.tables.close')) return;
    try { await closeFoodTableSession(selectedTable.activeSession.id); toast.success('Mesa fechada com sucesso.'); setSelectedTable(null); await refresh(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error ?? '');
      if (reason.includes('payment_pending')) toast.error('Ainda há pagamento aguardando confirmação do provedor.');
      else toast.error('Não foi possível fechar a mesa. Verifique o pagamento e suas permissões.');
    }
  };
  const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const paymentTotal = consumption.reduce((sum, item) => sum + item.line_total, 0);
  const paidParts = paymentParts.reduce((sum, part) => sum + part.amount, 0);
  const paymentRemaining = Math.max(0, paymentTotal - confirmedPaid - paidParts);
  const buildPaymentPart = (amount: number) => ({
    method: PAYMENT_OPTIONS[paymentMethod].method,
    provider: PAYMENT_OPTIONS[paymentMethod].provider,
    amount,
    label: PAYMENT_OPTIONS[paymentMethod].label,
  });
  // O caixa digita em pt-BR: "18,00" precisa valer 18. Number() devolveria NaN.
  const readPaymentAmount = () => parseDecimalInput(paymentAmount, Number.NaN);
  const addPaymentPart = () => {
    const amount = readPaymentAmount();
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Informe o valor do pagamento.'); return; }
    if (amount > paymentRemaining + 0.01) { toast.error(`Valor acima do saldo restante de ${money(paymentRemaining)}.`); return; }
    setPaymentParts((parts) => [...parts, buildPaymentPart(amount)]);
    setPaymentAmount('');
  };
  const removePaymentPart = (index: number) => setPaymentParts((parts) => parts.filter((_, position) => position !== index));
  const confirmSplitPayment = async () => {
    if (!selectedTable?.activeSession || confirmingPayment) return;
    // Confirma o que já está na lista. Antes esta função exigia um valor novo
    // no campo, então quem adicionava o total e clicava em confirmar era
    // barrado com "saldo restante" e a mesa nunca era paga.
    const pending = readPaymentAmount();
    const plan = planTablePaymentConfirmation(Math.max(0, paymentTotal - confirmedPaid), paymentParts.map((part) => part.amount), pending);
    if (plan.status === 'over') { toast.error(`Valor acima do saldo restante de ${money(plan.remaining)}.`); return; }
    if (plan.status === 'empty') { toast.error('Adicione ao menos um pagamento.'); return; }
    if (plan.status === 'short') { toast.error(`Faltam ${money(plan.missing)} para fechar a conta.`); return; }
    const parts = Number.isFinite(pending) && pending > 0 ? [...paymentParts, buildPaymentPart(pending)] : paymentParts;
    const payload = parts.map(({ method, provider, amount }) => ({ method, provider, amount }));
    setConfirmingPayment(true);
    try {
    const { error } = await (supabase as any).rpc('create_split_payment_group', { p_order_id: selectedTable.activeSession.id, p_parts: payload });
    if (error) { toast.error(error.message); return; }
    toast.success('Pagamentos registrados. Os integrados dependem da confirmação do provedor.');
    setPaymentParts([]);
    setPaymentAmount('');
    await openTableModal(selectedTable);
    await refresh();
    } catch { toast.error('Não foi possível verificar o pagamento. Reabra a mesa para consultar antes de tentar novamente.'); }
    finally { setConfirmingPayment(false); }
  };

  const qrUrl = qrToken ? `${window.location.origin}/qrmenu/${qrToken}` : '';
  const groupedConsumption = Object.values(consumption.reduce<Record<string, { id: string; product_name: string; quantity: number; line_total: number }>>((acc, item) => {
    const key = item.product_name.trim().toLowerCase();
    const current = acc[key];
    acc[key] = current ? { ...current, quantity: current.quantity + item.quantity, line_total: current.line_total + item.line_total } : { id: item.id, product_name: item.product_name, quantity: item.quantity, line_total: item.line_total };
    return acc;
  }, {}));
  const downloadQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `miaifood-${selectedTable.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    anchor.click();
  };
  const printQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
    if (!popup) { toast.error('Permita pop-ups para imprimir o QR Code.'); return; }
    const safeCode = escapeHtml(selectedTable.code);
    popup.document.write(`<html><head><title>${safeCode}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px}img{width:320px;height:320px}h1{margin-bottom:8px}p{color:#555;font-size:16px}</style></head><body><h1>${safeCode}</h1><p>Escaneie para acessar o cardápio desta mesa.</p><img src="${qrDataUrl}" alt="QR Code ${safeCode}"/><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  if (scopeLoading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Miaifood Gestor</p>
          <h1 className="text-2xl font-bold tracking-tight">Mesas</h1>
          <p className="text-sm text-muted-foreground">{scope ? `${scope.location.name} · Salão e comandas` : 'Selecione uma filial para operar o salão.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={toggleSound} title={alertPreferences.soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}>
            {alertPreferences.soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          {!alertPreferences.notificationsEnabled && <Button variant="outline" size="sm" onClick={() => void activateNotifications()}><Bell className="mr-2 h-4 w-4" />Ativar alertas</Button>}
          <Button variant="outline" onClick={() => void refresh()} disabled={loading}><QrCode className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
      </section>
      {paymentCalls.length > 0 && <Card className="border-primary/40"><CardContent className="space-y-2 p-4"><p className="font-semibold text-primary">Solicitações aguardando atendimento</p>{paymentCalls.map((call) => <div key={call.id} className="flex items-center justify-between rounded border p-2 text-sm"><span>{tables.find((table) => table.id === call.food_table_sessions?.table_id)?.code ?? 'Mesa'}</span><Button size="sm" variant="outline" onClick={async () => { const table = tables.find((item) => item.id === call.food_table_sessions?.table_id); if (table) await openTableModal(table); await (supabase as any).from('food_waiter_calls').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), handled_by_user_id: (await supabase.auth.getUser()).data.user?.id }).eq('id', call.id); await refresh(); }}>Assumir</Button></div>)}</CardContent></Card>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : tables.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma mesa cadastrada nesta filial.</CardContent></Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            const sessionStatus = table.activeSession?.status;
            return <Card key={table.id} className={sessionStatus ? 'cursor-pointer border-primary/40 transition-colors hover:border-primary' : 'cursor-pointer transition-colors hover:border-primary/50'} onClick={() => void openTableModal(table)}>
              <CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><Armchair className="h-5 w-5" />{table.code}</CardTitle><CardDescription>{table.name || table.area?.name || 'Sem localização definida'}</CardDescription></div><span className={sessionStatus ? 'rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary' : 'rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'}>{sessionStatus ? statusLabel[sessionStatus] : 'Livre'}</span></div></CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span className="flex items-center gap-2"><UsersRound className="h-4 w-4" />{table.seats} lugares{table.activeSession?.guest_count ? ` · ${table.activeSession.guest_count} convidados` : ''}</span>{!table.activeSession && hasPermission('food.orders.manage') && <Button size="sm" onClick={(event) => { event.stopPropagation(); void openTable(table); }} disabled={openingTableId === table.id}>{openingTableId === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-1 h-3.5 w-3.5" />Abrir</>}</Button>}</CardContent>
            </Card>;
          })}
        </section>
      )}
      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTable?.code}</DialogTitle>
            <DialogDescription>
              {selectedTable?.activeSession ? 'Mesa aberta e em atendimento.' : 'Mesa livre. Escaneie o QR Code ou abra a mesa no sistema.'}
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-4">
            {/* QR Code é administrado exclusivamente em Configurações → QR Menu. */}
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              {import.meta.env.DEV && qrUrl && <a href={qrUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline">Abrir QR Menu para testar pedido</a>}
            </div>
            {/*
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code ${selectedTable?.code}`} className="mx-auto mb-3 h-44 w-44 rounded-lg bg-white p-2 shadow-md" />
              ) : (
                <QrCode className="mx-auto mb-2 h-8 w-8 animate-pulse text-muted-foreground" />
              )}
              <p className="font-bold text-foreground">QR Code Oficial da {selectedTable?.code}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Este é o QR Code impresso e fixado na mesa para o cliente pedir.</p>
              
              <div className="mt-4 flex flex-col items-center gap-3">
                {qrUrl && (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    <QrCode className="h-4 w-4" /> Abrir Cardápio da Mesa
                  </a>
                )}
                
                {qrUrl && (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline font-mono break-all hover:opacity-80"
                  >
                    {qrUrl}
                  </a>
                )}

                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(qrUrl).then(() => toast.success('Link do QR Code copiado!')).catch(() => toast.error('Não foi possível copiar.'))} disabled={!qrUrl}>
                    <Copy className="mr-1 h-3.5 w-3.5" />Copiar Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadQr} disabled={!qrDataUrl}>
                    <Download className="mr-1 h-3.5 w-3.5" />Baixar
                  </Button>
                  <Button size="sm" variant="outline" onClick={printQr} disabled={!qrDataUrl}>
                    <Printer className="mr-1 h-3.5 w-3.5" />Imprimir
                  </Button>
                </div>
              </div>
            </div> */}

            {selectedTable?.activeSession && (
              <div className="space-y-3 pt-2">
                <div className="rounded-lg border p-3"><p className="mb-2 text-sm font-semibold">Consumo da mesa</p>{groupedConsumption.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item lançado.</p> : <div className={`space-y-2 ${groupedConsumption.length > 4 ? 'max-h-48 overflow-y-auto pr-1' : ''}`}>{groupedConsumption.map((item) => <div key={item.id} className="flex items-center justify-between text-sm"><span>{item.quantity}x {item.product_name}</span><strong>{item.line_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>)}</div>}</div>
                <div className="rounded-lg border p-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><ChefHat className="h-4 w-4 text-primary" />Pedidos da mesa</p>{tableOrders.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pedido enviado à cozinha.</p> : <div className="space-y-2">{tableOrders.map((order, index) => { const label: Record<string, string> = { submitted: 'Enviado à cozinha', preparing: 'Em preparo', ready: 'Pronto para servir', delivered: 'Entregue', cancelled: 'Cancelado' }; return <div key={order.id} className="flex items-center justify-between gap-3 text-sm"><span>Pedido {tableOrders.length - index}</span><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{label[order.status] || order.status}</span></div>; })}</div>}</div>
                <div className="flex items-center justify-between rounded-lg bg-primary/10 p-3"><span className="font-semibold">Total da mesa</span><strong className="text-lg text-primary">{consumption.reduce((sum, item) => sum + item.line_total, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
                <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-semibold">Pagamentos</p>{confirmedPaid >= paymentTotal - 0.01 ? <p className="text-sm font-medium text-primary">Pagamento confirmado pelo provedor</p> : <><div className="flex gap-2"><select className="rounded border bg-background px-2 text-sm" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value as PaymentOptionId)}>{Object.entries(PAYMENT_OPTIONS).map(([id,option])=><option key={id} value={id}>{option.label}</option>)}</select><Input type="text" inputMode="decimal" placeholder="Valor" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} /><Button type="button" variant="outline" onClick={addPaymentPart}>Adicionar</Button></div>{paymentParts.map((part,i)=><div key={i} className="flex items-center justify-between text-sm"><span>{part.label ?? part.method}</span><span className="flex items-center gap-2"><strong>{money(part.amount)}</strong><button type="button" className="text-muted-foreground hover:text-destructive" aria-label={`Remover pagamento de ${money(part.amount)}`} onClick={()=>removePaymentPart(i)}><X className="h-3.5 w-3.5" /></button></span></div>)}{paymentParts.length>0&&<div className="flex justify-between border-t pt-2 text-sm"><span>Saldo restante</span><strong>{money(paymentRemaining)}</strong></div>}<Button type="button" className="w-full" disabled={!paymentParts.length} onClick={() => void confirmSplitPayment()}>Confirmar pagamentos</Button></>}</div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid flex-1 gap-1 text-sm font-medium">
                    Pessoas na conta
                    <div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" onClick={() => { const next=String(Math.max(1, Number(peopleCount)-1)); setPeopleCount(next); if(selectedTable) setPeopleCountByTable((m)=>({...m,[selectedTable.id]:next})); }}>-</Button><Input className="text-center" type="number" min="1" max="100" value={peopleCount} onChange={(event) => { const next=event.target.value; setPeopleCount(next); if(selectedTable) setPeopleCountByTable((m)=>({...m,[selectedTable.id]:next})); }} /><Button type="button" size="icon" variant="outline" onClick={() => { const next=String(Math.min(100, Number(peopleCount)+1)); setPeopleCount(next); if(selectedTable) setPeopleCountByTable((m)=>({...m,[selectedTable.id]:next})); }}>+</Button></div>
                  </label>
                  <Button onClick={() => void calculateSplit()} disabled={splitting}>
                    {splitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Dividir
                  </Button>
                </div>
                {splits.length > 0 && (
                  <div className={`space-y-2 rounded-lg border p-3 ${splits.length >= 4 ? 'max-h-32 overflow-y-auto' : ''}`}>
                    {splits.map((split) => (
                      <div key={split.id} className="flex items-center justify-between text-sm">
                        <span>Pessoa {split.person_number}</span>
                        <strong>{Number(split.amount_due).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {hasPermission('food.tables.close') && <Button className="w-full" disabled={confirmingPayment || paymentTotal - confirmedPaid > 0.01} onClick={() => void closeTable()}><CheckCircle2 className="mr-2 h-4 w-4" />Fechar mesa</Button>}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </main>
  );
}
