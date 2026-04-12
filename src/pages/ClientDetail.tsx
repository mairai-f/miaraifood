import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Plus, DollarSign, MessageCircle, Trash2, CheckCircle, Edit, X, User, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isThisWeek, isThisMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { findClientByRef, getClientUniqueSlug } from '@/lib/clientSlug';
import { getPaymentLabel, groupPaymentSnapshotItems, parsePaymentType } from '@/lib/payment';
import { buildWhatsAppUrl, buildItemWhatsAppUrl, buildPaymentWhatsAppUrl } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';

const formatDateLocal = (dateStr: string) => {
  const utcDate = new Date(dateStr);
  const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
  return format(localDate, 'dd/MM/yyyy HH:mm', { locale: ptBR });
};

const formatDateLocalShort = (dateStr: string) => {
  const utcDate = new Date(dateStr);
  const localDate = new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
  return format(localDate, 'dd/MM/yyyy', { locale: ptBR });
};

const utcToLocal = (dateStr: string) => {
  const utcDate = new Date(dateStr);
  return new Date(utcDate.getTime() - 3 * 60 * 60 * 1000);
};

const localToUtc = (localDate: Date) => {
  return new Date(localDate.getTime() + 3 * 60 * 60 * 1000);
};

const samePaymentMoment = (left?: string | null, right?: string | null) => {
  if (!left || !right) return false;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
};

type HistoryItem = { kind: 'debt'; date: string; productName: string; quantity: number; total: number; registered_by?: string };

export default function ClientDetail() {
  const { clientRef } = useParams<{ clientRef: string }>();
  const navigate = useNavigate();
  const data = useData();
  const { username } = useAuth();

  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; price: number } | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [editEntry, setEditEntry] = useState<string | null>(null);
  const [editDateAdded, setEditDateAdded] = useState('');
  const [editDatePaid, setEditDatePaid] = useState('');
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string } | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openPaymentGroups, setOpenPaymentGroups] = useState<Set<string>>(new Set());
  const [openPaymentItems, setOpenPaymentItems] = useState<Set<string>>(new Set());
  const [openHistoryItems, setOpenHistoryItems] = useState<Set<string>>(new Set());

  const client = findClientByRef(data.clients.filter(c => !c.deleted), clientRef || '');
  const id = client?.id;

  const allClientEntries = useMemo(() => data.debtEntries.filter(d => d.client_id === id), [data.debtEntries, id]);
  const entries = useMemo(() => allClientEntries.filter(d => !d.deleted), [allClientEntries]);
  const clientPayments = useMemo(() => data.payments.filter(p => p.client_id === id), [data.payments, id]);
  const parsedPayments = useMemo(
    () =>
      clientPayments.map(payment => {
        const parsedType = parsePaymentType(payment.type);
        const snapshot =
          parsedType.kind === 'total'
            ? groupPaymentSnapshotItems(
                allClientEntries
                  .filter(entry => entry.status === 'paid' && samePaymentMoment(entry.date_paid, payment.date))
                  .map(entry => ({
                    product_name: entry.product_name,
                    quantity: entry.quantity,
                    total: entry.total,
                    date_added: entry.date_added,
                    registered_by: entry.registered_by,
                  }))
              )
            : [];

        return { ...payment, parsedType, snapshot };
      }),
    [allClientEntries, clientPayments]
  );
  const balance = id ? data.getClientBalance(id) : 0;
  const matched = data.searchProducts(productSearch);

  // ── Agrupamento de pendentes por produto ───────────────────────────────────
  const groupedPending = useMemo(() => {
    const pending = entries.filter(e => e.status === 'pending');
    const groups = new Map<string, typeof pending>();

    for (const e of pending) {
      const key = e.product_name.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      name: items[0].product_name,
      totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: items.reduce((sum, item) => sum + item.total, 0),
      items: items.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()),
    }));
  }, [entries]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePaymentGroup = (key: string) => {
    setOpenPaymentGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const togglePaymentItemGroup = (key: string) => {
    setOpenPaymentItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleHistoryItemGroup = (key: string) => {
    setOpenHistoryItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Histórico de dívidas filtrado (sem pagamentos) ─────────────────────────
  const filteredHistory = useMemo((): HistoryItem[] => {
    const historySource = historyFilter === 'custom' ? allClientEntries : entries;
    const all: HistoryItem[] = historySource
      .map(e => ({ kind: 'debt' as const, date: e.date_added, productName: e.product_name, quantity: e.quantity, total: e.total, registered_by: e.registered_by }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historyFilter === 'daily') return all.filter(i => isToday(utcToLocal(i.date)));
    if (historyFilter === 'weekly') return all.filter(i => isThisWeek(utcToLocal(i.date)));
    if (historyFilter === 'monthly') return all.filter(i => isThisMonth(utcToLocal(i.date)));

    if (historyFilter === 'custom') {
      if (!customDateRange) return [];
      return all.filter(item =>
        isWithinInterval(utcToLocal(item.date), {
          start: startOfDay(new Date(customDateRange.from + 'T00:00:00')),
          end: endOfDay(new Date(customDateRange.to + 'T00:00:00')),
        })
      );
    }

    return all;
  }, [allClientEntries, entries, historyFilter, customDateRange]);

  const groupedPayments = useMemo(
    () =>
      parsedPayments.map(payment => {
        const groups = new Map<string, typeof payment.snapshot>();

        for (const item of payment.snapshot) {
          const key = item.product_name.trim().toLowerCase();
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(item);
        }

        return {
          ...payment,
          groupedItems: Array.from(groups.entries()).map(([key, items]) => ({
            key: `${payment.id}:${key}`,
            name: items[0].product_name,
            totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
            totalValue: items.reduce((sum, item) => sum + item.total, 0),
            items: items.sort((a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()),
          })),
        };
      }),
    [parsedPayments]
  );

  const groupedCustomHistory = useMemo(() => {
    if (historyFilter !== 'custom') return [];

    const groups = new Map<string, HistoryItem[]>();
    for (const item of filteredHistory) {
      const key = item.productName.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      name: items[0].productName,
      totalQty: items.reduce((sum, item) => sum + item.quantity, 0),
      totalValue: items.reduce((sum, item) => sum + item.total, 0),
      items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
  }, [filteredHistory, historyFilter]);

  const emptyHistoryMessage =
    historyFilter === 'custom'
      ? customDateRange
        ? 'Nenhum registro nesse período.'
        : 'Selecione o período e clique em Buscar.'
      : 'Nenhum registro.';

  if (data.loading) return (
    <div className="text-center mt-20 text-muted-foreground text-sm">Carregando...</div>
  );

  if (!client || !id) return (
    <div className="text-center mt-20 text-muted-foreground text-sm">
      Cliente não encontrado. <Button variant="link" onClick={() => navigate('/clientes')}>Voltar</Button>
    </div>
  );

  // ── CART handlers ──────────────────────────────────────────────────────────

  const handleAddToCart = () => {
    if (!selectedProduct) { toast.error('Selecione um produto'); return; }
    const qty = parseInt(quantity) || 1;
    setCart(prev => {
      const existing = prev.find(c => c.id === selectedProduct.id);
      if (existing) return prev.map(c => c.id === selectedProduct.id ? { ...c, quantity: c.quantity + qty } : c);
      return [...prev, { id: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, quantity: qty }];
    });
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity('1');
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.id !== productId));
  };

  const handleSubmitCart = async (sendWhatsApp: boolean = true) => {
    if (cart.length === 0) { toast.error('Adicione pelo menos um produto'); return; }

    const localDate = new Date();
    const utcDate = localToUtc(localDate);
    const dateAdded = utcDate.toISOString();

    try {
      await data.addDebtEntries(
        cart.map(item => ({
          clientId: id,
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          dateAdded,
          registeredBy: username ?? undefined,
        }))
      );
    } catch (error) {
      console.error('Erro ao marcar produtos:', error);
      toast.error('Nao foi possivel marcar os produtos');
      return;
    }

    toast.success(`${cart.length} item(s) adicionado(s)${sendWhatsApp ? ' e notificado!' : ' (sem notificar)!'}`);

    if (sendWhatsApp && client.phone) {
      const cartTotal = cart.reduce((s, c) => s + c.quantity * c.price, 0);
      const newBalance = balance + cartTotal;
      const cartEntries = cart.map(c => ({
        id: '', client_id: id, product_id: c.id, product_name: c.name,
        quantity: c.quantity, unit_price: c.price, total: c.quantity * c.price,
        date_added: dateAdded, status: 'pending', deleted: false,
        date_paid: null, registered_by: username,
      }));
      const url = buildItemWhatsAppUrl(client.phone, client.name, cartEntries, newBalance);
      window.open(url, '_blank');
    }

    setCart([]);
  };

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('Valor inválido'); return; }
    const now = new Date();
    const utcDate = localToUtc(now);

    try {
      if (amount >= balance) {
        await data.closeAllDebt(id, utcDate.toISOString());
        toast.success('🎉 PARABÉNS! Você quitou sua dívida! 🏆 Todas as pendências foram resolvidas! 💯');
      } else {
        await data.addPayment(id, amount, 'partial', utcDate.toISOString());
        toast.success(`Pagamento de R$ ${amount.toFixed(2)} registrado!`);
      }
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      const message = error instanceof Error ? error.message : 'Não foi possível registrar o pagamento';
      toast.error(message);
      return;
    }

    if (client.phone) {
      const isFullPayment = amount >= balance;
      const newBalance = balance - amount;
      const remainingEntries = isFullPayment ? [] : entries.filter(e => e.status === 'pending');
      const url = buildPaymentWhatsAppUrl(client.phone, client.name, amount, remainingEntries, Math.max(0, newBalance));
      window.open(url, '_blank');
    }
    setPayAmount(''); setPayOpen(false);
  };

  const handleWhatsApp = () => {
    if (!client.phone) { toast.error('Cliente sem telefone cadastrado'); return; }
    const allEntries = data.debtEntries.filter(d => d.client_id === id && !d.deleted);
    const url = buildWhatsAppUrl(client.phone, client.name, allEntries, clientPayments, balance);
    window.open(url, '_blank');
  };

  const handleSaveEdit = async (entryId: string) => {
    const updates: Record<string, unknown> = {};
    if (editDateAdded) {
      const localDate = new Date(editDateAdded);
      const utcDate = localToUtc(localDate);
      updates.date_added = utcDate.toISOString();
    }
    if (editDatePaid) {
      const localDate = new Date(editDatePaid);
      const utcDate = localToUtc(localDate);
      updates.date_paid = utcDate.toISOString();
    }
    await data.updateDebtEntry(entryId, updates);
    setEditEntry(null); toast.success('Atualizado!');
  };

  const handleEditClient = async () => {
    await data.updateClient(id, { name: editName, phone: normalizePhone(editPhone) });
    setEditClientOpen(false); toast.success('Cliente atualizado!');
    const updatedSlug = getClientUniqueSlug({ ...client, name: editName }, data.clients);
    if (updatedSlug !== clientRef) navigate(`/cliente/${updatedSlug}`, { replace: true });
  };

  const handleApplyCustomFilter = () => {
    if (!customDateFrom || !customDateTo) {
      toast.error('Selecione a data inicial e final');
      return;
    }
    if (new Date(customDateFrom) > new Date(customDateTo)) {
      toast.error('A data inicial deve ser menor ou igual à data final');
      return;
    }
    setCustomDateRange({ from: customDateFrom, to: customDateTo });
  };

  return (
    <div>
      {/* Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')} className="mb-3">
        <ArrowLeft className="h-4 w-4 mr-1" />Voltar
      </Button>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{client.name}</h1>
          {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditName(client.name); setEditPhone(client.phone); setEditClientOpen(true); }} className="flex-1 sm:flex-none">
              <User className="h-3 w-3 mr-1" />Editar
            </Button>
            <Button variant="outline" size="sm" onClick={handleWhatsApp} className="flex-1 sm:flex-none">
              <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
            </Button>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full sm:w-auto"><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Excluir cliente?</AlertDialogTitle><AlertDialogDescription>O cliente será movido para a lista de excluídos.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { data.softDeleteClient(id); navigate('/clientes'); toast.success('Cliente excluído'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-4 border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Devedor</p>
                <p className={`text-2xl font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>R$ {balance.toFixed(2)}</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setPayOpen(true)} disabled={balance <= 0}>
                  <DollarSign className="h-3 w-3 mr-1" />Pagamento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="debts">
        <TabsList className="mb-3 w-full sm:w-auto">
          <TabsTrigger value="debts" className="flex-1 sm:flex-none">Dívidas</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none">Histórico</TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 sm:flex-none">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="debts">
          {/* Add Debt with Cart */}
          <Card className="mb-4 border-border/50">
            <CardHeader className="px-4 pt-4 pb-2"><CardTitle className="text-sm">Adicionar Dívida</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="relative">
                  <Label className="text-xs">Produto</Label>
                  <Input
                    value={selectedProduct ? selectedProduct.name : productSearch}
                    onChange={e => { setProductSearch(e.target.value); setSelectedProduct(null); setShowSearch(true); }}
                    onFocus={() => setShowSearch(true)}
                    placeholder="Buscar produto pelo nome, código ou barras..."
                    className="text-sm"
                  />
                  {showSearch && productSearch && !selectedProduct && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-popover border border-border rounded-lg mt-1 max-h-40 overflow-auto shadow-lg">
                      {matched.map(p => (
                        <button key={p.id} className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex justify-between text-sm"
                          onClick={() => { setSelectedProduct(p); setProductSearch(''); setShowSearch(false); }}>
                          <span className="truncate mr-2">{p.code ? `#${p.code} ` : ''}{p.name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                        </button>
                      ))}
                      {matched.length === 0 && <p className="px-3 py-2 text-muted-foreground text-xs">Nenhum produto</p>}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <div>
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="text-sm" />
                  </div>
                </div>
                <Button onClick={handleAddToCart} variant="outline" className="w-full sm:w-auto" size="sm">
                  <Plus className="h-3 w-3 mr-1" />Adicionar à lista
                </Button>

                {/* Cart */}
                {cart.length > 0 && (
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground">
                      Lista ({cart.length} item{cart.length > 1 ? 's' : ''}):
                    </p>
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate min-w-0">
                          {item.name} <span className="text-muted-foreground">x{item.quantity}</span>
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium">R$ {(item.quantity * item.price).toFixed(2)}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveFromCart(item.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-bold">
                      <span>Total:</span>
                      <span>R$ {cart.reduce((s, c) => s + c.quantity * c.price, 0).toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSubmitCart(false)} variant="outline" className="flex-1" size="sm">
                        <CheckCircle className="h-3 w-3 mr-1" />Marcar
                      </Button>
                      <Button onClick={() => handleSubmitCart(true)} className="flex-1" size="sm">
                        <MessageCircle className="h-3 w-3 mr-1" />Marcar e Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pending Debts — agrupadas por produto */}
          <div className="space-y-2">
            {groupedPending.map(group => (
              <Card key={group.key} className="border-border/50">
                <Collapsible open={openGroups.has(group.key)} onOpenChange={() => toggleGroup(group.key)}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {openGroups.has(group.key)
                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{group.name}</p>
                            <p className="text-xs text-muted-foreground">{group.totalQty}x — {group.items.length} registro{group.items.length > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <span className="font-bold text-destructive text-sm shrink-0">R$ {group.totalValue.toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-border mx-3">
                      {group.items.map(e => (
                        <div key={e.id} className="py-2 border-b border-border/50 last:border-0">
                          {editEntry === e.id ? (
                            <div className="space-y-2 px-1">
                              <p className="text-sm font-medium">{e.product_name} x{e.quantity}</p>
                              <div className="flex gap-2">
                                <div className="flex-1"><Label className="text-xs">Data/Hora pego</Label><Input type="datetime-local" className="h-8 text-xs" value={editDateAdded} onChange={ev => setEditDateAdded(ev.target.value)} /></div>
                                <div className="flex-1"><Label className="text-xs">Data/Hora pago</Label><Input type="datetime-local" className="h-8 text-xs" value={editDatePaid} onChange={ev => setEditDatePaid(ev.target.value)} /></div>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="flex-1" onClick={() => handleSaveEdit(e.id)}>Salvar</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditEntry(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2 px-1">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">
                                  x{e.quantity} — {formatDateLocal(e.date_added)}
                                  {e.date_paid && ` • Pago: ${formatDateLocal(e.date_paid)}`}
                                </p>
                                {e.registered_by && <p className="text-xs text-muted-foreground">Por: {e.registered_by}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-medium text-destructive text-xs">R$ {e.total.toFixed(2)}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                  setEditEntry(e.id);
                                  const localDateAdded = utcToLocal(e.date_added);
                                  setEditDateAdded(format(localDateAdded, "yyyy-MM-dd'T'HH:mm"));
                                  if (e.date_paid) {
                                    const localDatePaid = utcToLocal(e.date_paid);
                                    setEditDatePaid(format(localDatePaid, "yyyy-MM-dd'T'HH:mm"));
                                  } else {
                                    setEditDatePaid('');
                                  }
                                }}><Edit className="h-3 w-3" /></Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Remover dívida?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { data.deleteDebtEntry(e.id); toast.success('Removido'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
            {groupedPending.length === 0 && (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma dívida pendente.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="flex flex-col gap-3 mb-3">
            <div className="flex gap-1.5 flex-wrap items-center">
              {(['all', 'daily', 'weekly', 'monthly', 'custom'] as const).map(f => (
                <Button key={f} variant={historyFilter === f ? 'default' : 'outline'} size="sm" className="text-xs px-2.5" onClick={() => setHistoryFilter(f)}>
                  {{ all: 'Tudo', daily: 'Hoje', weekly: 'Semana', monthly: 'Mês', custom: 'Personalizado' }[f]}
                </Button>
              ))}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="text-xs"><Trash2 className="h-3 w-3 mr-1" />Limpar Produtos</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Limpar histórico de produtos?</AlertDialogTitle><AlertDialogDescription>Somente o histórico de produtos será removido. Os pagamentos continuarão salvos.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { data.deleteClientHistory(id); toast.success('Histórico de produtos excluído'); }}>Confirmar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Filtro de data personalizado */}
            {historyFilter === 'custom' && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />De</Label>
                    <Input type="date" value={customDateFrom} onChange={e => setCustomDateFrom(e.target.value)} className="text-sm h-9" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Até</Label>
                    <Input type="date" value={customDateTo} onChange={e => setCustomDateTo(e.target.value)} className="text-sm h-9" />
                  </div>
                  <Button className="w-full sm:w-auto self-end" onClick={handleApplyCustomFilter} disabled={!customDateFrom || !customDateTo}>
                    Buscar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Mostra registros dentro do intervalo escolhido.</p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {historyFilter === 'custom'
              ? groupedCustomHistory.map(group => (
                  <Card key={group.key} className="border-border/50">
                    {group.items.length > 1 ? (
                      <Collapsible open={openHistoryItems.has(group.key)} onOpenChange={() => toggleHistoryItemGroup(group.key)}>
                        <CollapsibleTrigger asChild>
                          <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {openHistoryItems.has(group.key)
                                  ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{group.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {group.totalQty}x - {group.items.length} registro{group.items.length > 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {group.totalValue.toFixed(2)}</span>
                            </div>
                          </CardContent>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t border-border mx-3">
                            {group.items.map((item, index) => (
                              <div key={`${group.key}-${index}`} className="py-2 border-b border-border/50 last:border-0">
                                <div className="flex items-start justify-between gap-2 px-1">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{item.productName} x{item.quantity}</p>
                                    <p className="text-xs text-muted-foreground">{formatDateLocal(item.date)}</p>
                                    {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                                  </div>
                                  <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {item.total.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{group.items[0].productName} x{group.items[0].quantity}</p>
                          <p className="text-xs text-muted-foreground">{formatDateLocal(group.items[0].date)}</p>
                          {group.items[0].registered_by && <p className="text-xs text-muted-foreground">Por: {group.items[0].registered_by}</p>}
                        </div>
                        <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {group.items[0].total.toFixed(2)}</span>
                      </CardContent>
                    )}
                  </Card>
                ))
              : filteredHistory.map((item, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName} x{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">{formatDateLocal(item.date)}</p>
                        {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                      </div>
                      <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {item.total.toFixed(2)}</span>
                    </CardContent>
                  </Card>
                ))}
            {filteredHistory.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">{emptyHistoryMessage}</p>}
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="space-y-1.5">
            {groupedPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhum pagamento registrado.</p>
            ) : (
              [...groupedPayments]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((p, i) => (
                  <Card key={i} className="border-border/50">
                    <Collapsible open={openPaymentGroups.has(p.id)} onOpenChange={() => togglePaymentGroup(p.id)}>
                      <CollapsibleTrigger asChild>
                        <CardContent className="p-3 cursor-pointer hover:bg-accent/30 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {openPaymentGroups.has(p.id)
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-success">{getPaymentLabel(p.type)}</p>
                                <p className="text-xs text-muted-foreground">{formatDateLocal(p.date)}</p>
                                {p.groupedItems.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {p.groupedItems.length} produto{p.groupedItems.length > 1 ? 's' : ''} quitado{p.groupedItems.length > 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-success font-medium text-sm whitespace-nowrap">
                              + R$ {p.amount.toFixed(2)}
                            </span>
                          </div>
                        </CardContent>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border mx-3">
                          {p.groupedItems.length > 0 ? (
                            p.groupedItems.map(group => (
                              group.items.length > 1 ? (
                                <Collapsible
                                  key={group.key}
                                  open={openPaymentItems.has(group.key)}
                                  onOpenChange={() => togglePaymentItemGroup(group.key)}
                                >
                                  <CollapsibleTrigger asChild>
                                    <div className="py-2 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/20 transition-colors">
                                      <div className="flex items-center justify-between gap-2 px-1">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                          {openPaymentItems.has(group.key)
                                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{group.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {group.totalQty}x - {group.items.length} registro{group.items.length > 1 ? 's' : ''}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-xs font-medium whitespace-nowrap">R$ {group.totalValue.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="pb-2 px-1 space-y-2">
                                      {group.items.map((item, index) => (
                                        <div key={`${group.key}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                                          <div className="min-w-0">
                                            <p className="font-medium truncate">{item.product_name} x{item.quantity}</p>
                                            <p className="text-xs text-muted-foreground">{formatDateLocal(item.date_added)}</p>
                                            {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                                          </div>
                                          <span className="text-xs font-medium whitespace-nowrap">R$ {item.total.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : (
                                <div key={group.key} className="py-2 border-b border-border/50 last:border-0">
                                  <div className="flex items-start justify-between gap-2 px-1 text-sm">
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{group.items[0].product_name} x{group.items[0].quantity}</p>
                                      <p className="text-xs text-muted-foreground">{formatDateLocal(group.items[0].date_added)}</p>
                                      {group.items[0].registered_by && <p className="text-xs text-muted-foreground">Por: {group.items[0].registered_by}</p>}
                                    </div>
                                    <span className="text-xs font-medium whitespace-nowrap">R$ {group.items[0].total.toFixed(2)}</span>
                                  </div>
                                </div>
                              )
                            ))
                          ) : (
                            <div className="py-3 text-xs text-muted-foreground">Nenhum produto vinculado a este pagamento.</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Saldo: <span className="text-destructive font-bold">R$ {balance.toFixed(2)}</span></p>
            <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" /></div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="flex-1" onClick={handlePayment}>Confirmar</Button>
              <Button variant="outline" className="flex-1" onClick={() => setPayAmount(balance.toFixed(2))}>Pagar Tudo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              <p className="text-xs text-muted-foreground">DDI 55 será adicionado automaticamente</p>
            </div>
          </div>
          <DialogFooter><Button onClick={handleEditClient} className="w-full sm:w-auto">Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
