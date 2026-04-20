import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { findClientByRef, getClientUniqueSlug } from '@/lib/clientSlug';
import {
  formatClientDateTime,
  isClientDateThisMonth,
  isClientDateThisWeek,
  isClientDateToday,
  parseClientDate,
  toClientDateTimeInputValue,
  toUtcIsoString,
} from '@/lib/clientDateTime';
import { getPaymentLabel, groupPaymentSnapshotItems, parsePaymentType } from '@/lib/payment';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { buildWhatsAppUrl, buildItemWhatsAppUrl, buildPaymentWhatsAppUrl } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';

type PendingProtectedDeletion =
  | { kind: 'debt'; debtEntryId: string }
  | { kind: 'history' }
  | null;

const samePaymentMoment = (left?: string | null, right?: string | null) => {
  if (!left || !right) return false;
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) < 1000;
};

type HistoryItem = { kind: 'debt'; date: string; productName: string; quantity: number; total: number; registered_by?: string };
type DeletedHistoryItem = HistoryItem & { deleted_at?: string | null; deleted_reason?: string | null; deleted_by?: string | null };

export default function ClientDetail() {
  const { clientRef } = useParams<{ clientRef: string }>();
  const navigate = useNavigate();
  const data = useData();
  const { username, isAdmin, profileEmail, user } = useAuth();

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
  const [protectedDeletion, setProtectedDeletion] = useState<PendingProtectedDeletion>(null);
  const [deleteAuthOpen, setDeleteAuthOpen] = useState(false);
  const [deleteAuthEmail, setDeleteAuthEmail] = useState('');
  const [deleteAuthPassword, setDeleteAuthPassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingProtectedItem, setDeletingProtectedItem] = useState(false);

  const client = findClientByRef(data.clients.filter(c => !c.deleted), clientRef || '');
  const id = client?.id;

  const allClientEntries = useMemo(() => data.debtEntries.filter(d => d.client_id === id), [data.debtEntries, id]);
  const entries = useMemo(() => allClientEntries.filter(d => !d.deleted), [allClientEntries]);
  const deletedEntries = useMemo(() => allClientEntries.filter(d => d.deleted), [allClientEntries]);
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
    const all: HistoryItem[] = allClientEntries
      .filter(e => !e.deleted)
      .map(e => ({ kind: 'debt' as const, date: e.date_added, productName: e.product_name, quantity: e.quantity, total: e.total, registered_by: e.registered_by }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (historyFilter === 'daily') return all.filter(i => isClientDateToday(i.date));
    if (historyFilter === 'weekly') return all.filter(i => isClientDateThisWeek(i.date));
    if (historyFilter === 'monthly') return all.filter(i => isClientDateThisMonth(i.date));

    if (historyFilter === 'custom') {
      if (!customDateRange) return [];
      return all.filter(item =>
        isWithinInterval(parseClientDate(item.date), {
          start: startOfDay(new Date(customDateRange.from + 'T00:00:00')),
          end: endOfDay(new Date(customDateRange.to + 'T00:00:00')),
        })
      );
    }

    return all;
  }, [allClientEntries, historyFilter, customDateRange]);

  const deletedHistory = useMemo((): DeletedHistoryItem[] => (
    deletedEntries
      .map(e => ({
        kind: 'debt' as const,
        date: e.date_added,
        productName: e.product_name,
        quantity: e.quantity,
        total: e.total,
        registered_by: e.registered_by,
        deleted_at: e.deleted_at,
        deleted_reason: e.deleted_reason,
        deleted_by: e.deleted_by,
      }))
      .sort((a, b) => new Date(b.deleted_at || b.date).getTime() - new Date(a.deleted_at || a.date).getTime())
  ), [deletedEntries]);

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

    const dateAdded = new Date().toISOString();

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
      if (!openExternalUrl(url)) {
        toast.error('Não foi possível abrir o WhatsApp.');
      }
    }

    setCart([]);
  };

  const handlePayment = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('Valor inválido'); return; }
    const paymentDate = new Date().toISOString();

    try {
      if (amount >= balance) {
        await data.closeAllDebt(id, paymentDate);
        toast.success('🎉 PARABÉNS! Você quitou sua dívida! 🏆 Todas as pendências foram resolvidas! 💯');
      } else {
        await data.addPayment(id, amount, 'partial', paymentDate);
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
      if (!openExternalUrl(url)) {
        toast.error('Não foi possível abrir o WhatsApp.');
      }
    }
    setPayAmount(''); setPayOpen(false);
  };

  const handleWhatsApp = () => {
    if (!client.phone) { toast.error('Cliente sem telefone cadastrado'); return; }
    const allEntries = data.debtEntries.filter(d => d.client_id === id && !d.deleted);
    const url = buildWhatsAppUrl(client.phone, client.name, allEntries, clientPayments, balance);
    if (!openExternalUrl(url)) {
      toast.error('Não foi possível abrir o WhatsApp.');
    }
  };

  const handleSaveEdit = async (entryId: string) => {
    const updates: Record<string, unknown> = {};
    if (editDateAdded) {
      updates.date_added = toUtcIsoString(editDateAdded);
    }
    if (editDatePaid) {
      updates.date_paid = toUtcIsoString(editDatePaid);
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

  const openProtectedDeletion = (target: PendingProtectedDeletion) => {
    if (!isAdmin) {
      toast.error('Operador não pode excluir itens da caderneta.');
      return;
    }

    setProtectedDeletion(target);
    setDeleteAuthEmail((profileEmail || user?.email || '').trim());
    setDeleteAuthPassword('');
    setDeleteReason('');
    setDeleteAuthOpen(true);
  };

  const handleProtectedDeletion = async () => {
    if (!protectedDeletion) return;

    const expectedEmail = (profileEmail || user?.email || '').trim().toLowerCase();
    const normalizedEmail = deleteAuthEmail.trim().toLowerCase();

    if (!normalizedEmail || !deleteAuthPassword.trim()) {
      toast.error('Informe email e senha do administrador.');
      return;
    }

    if (protectedDeletion.kind === 'debt' && !deleteReason.trim()) {
      toast.error('Informe o motivo da exclusão do item.');
      return;
    }

    if (expectedEmail && normalizedEmail !== expectedEmail) {
      toast.error('Use o email do administrador logado para confirmar.');
      return;
    }

    setDeletingProtectedItem(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: deleteAuthEmail.trim(),
        password: deleteAuthPassword,
      });

      if (error) {
        toast.error('Email ou senha inválidos.');
        return;
      }

      if (protectedDeletion.kind === 'debt') {
        await data.deleteDebtEntry(protectedDeletion.debtEntryId, deleteReason);
        toast.success('Item removido da caderneta.');
      } else {
        await data.deleteClientHistory(id);
        toast.success('Histórico de produtos excluído.');
      }

      setDeleteAuthOpen(false);
      setProtectedDeletion(null);
      setDeleteAuthPassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a exclusão.');
    } finally {
      setDeletingProtectedItem(false);
    }
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
          <TabsTrigger value="deleted" className="flex-1 sm:flex-none">Itens apagados</TabsTrigger>
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
                                  x{e.quantity} — {formatClientDateTime(e.date_added)}
                                  {e.date_paid && ` • Pago: ${formatClientDateTime(e.date_paid)}`}
                                </p>
                                {e.registered_by && <p className="text-xs text-muted-foreground">Por: {e.registered_by}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-medium text-destructive text-xs">R$ {e.total.toFixed(2)}</span>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                                  setEditEntry(e.id);
                                  setEditDateAdded(toClientDateTimeInputValue(e.date_added));
                                  if (e.date_paid) {
                                    setEditDatePaid(toClientDateTimeInputValue(e.date_paid));
                                  } else {
                                    setEditDatePaid('');
                                  }
                                }}><Edit className="h-3 w-3" /></Button>
                                {isAdmin && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openProtectedDeletion({ kind: 'debt', debtEntryId: e.id })}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
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
              {isAdmin && (
                <Button variant="destructive" size="sm" className="text-xs" onClick={() => openProtectedDeletion({ kind: 'history' })}>
                  <Trash2 className="h-3 w-3 mr-1" />Limpar Produtos
                </Button>
              )}
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
                                    <p className="text-xs text-muted-foreground">{formatClientDateTime(item.date)}</p>
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
                          <p className="text-xs text-muted-foreground">{formatClientDateTime(group.items[0].date)}</p>
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
                        <p className="text-xs text-muted-foreground">{formatClientDateTime(item.date)}</p>
                        {item.registered_by && <p className="text-xs text-muted-foreground">Por: {item.registered_by}</p>}
                      </div>
                      <span className="text-destructive font-medium text-sm whitespace-nowrap">- R$ {item.total.toFixed(2)}</span>
                    </CardContent>
                  </Card>
                ))}
            {filteredHistory.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">{emptyHistoryMessage}</p>}
          </div>
        </TabsContent>

        <TabsContent value="deleted">
          <div className="space-y-1.5">
            {deletedHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">Nenhum item apagado desse cliente.</p>
            ) : deletedHistory.map((item, i) => (
              <Card key={`${item.productName}-${i}`} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.productName} x{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">Lançado em {formatClientDateTime(item.date)}</p>
                      <p className="text-xs text-muted-foreground">Apagado em {item.deleted_at ? formatClientDateTime(item.deleted_at) : '-'}</p>
                    </div>
                    <span className="text-destructive font-medium text-sm whitespace-nowrap">R$ {item.total.toFixed(2)}</span>
                  </div>
                  {item.deleted_by && (
                    <p className="text-xs text-muted-foreground">Apagado por: {item.deleted_by}</p>
                  )}
                  {item.deleted_reason && (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Motivo</p>
                      <p className="text-sm">{item.deleted_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
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
                                <p className="text-xs text-muted-foreground">{formatClientDateTime(p.date)}</p>
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
                                            <p className="text-xs text-muted-foreground">{formatClientDateTime(item.date_added)}</p>
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
                                      <p className="text-xs text-muted-foreground">{formatClientDateTime(group.items[0].date_added)}</p>
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

      <Dialog open={deleteAuthOpen} onOpenChange={setDeleteAuthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão na caderneta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para excluir um item ou limpar o histórico da caderneta, informe o email e a senha do administrador.
            </p>
            <div className="space-y-2">
              <Label>Email do administrador</Label>
              <Input
                type="email"
                value={deleteAuthEmail}
                onChange={event => setDeleteAuthEmail(event.target.value)}
                placeholder="admin@empresa.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={deleteAuthPassword}
                onChange={event => setDeleteAuthPassword(event.target.value)}
                placeholder="••••••••"
              />
            </div>
            {protectedDeletion?.kind === 'debt' && (
              <div className="space-y-2">
                <Label>Motivo da exclusão</Label>
                <Input
                  value={deleteReason}
                  onChange={event => setDeleteReason(event.target.value)}
                  placeholder="Ex: item lançado em duplicidade"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAuthOpen(false)} disabled={deletingProtectedItem}>
              Cancelar
            </Button>
            <Button onClick={() => void handleProtectedDeletion()} disabled={deletingProtectedItem}>
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
