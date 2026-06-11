import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Barcode, CheckCircle2, ClipboardList, Hash, Loader2, Plus, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { filterProductsBySearch, isExactProductSearchMatch, toProductUppercase } from '@/lib/productSearch';
import { formatCurrency, formatDateTime } from '../../shared/locale/format';
import type { Product, ServiceTicket, ServiceTicketItem } from '@/types';

const ticketStatusLabel: Record<ServiceTicket['status'], string> = {
  available: 'Livre',
  open: 'Aberta',
  awaiting_payment: 'No caixa',
  closed: 'Fechada',
  cancelled: 'Cancelada',
};

const ticketStatusVariant: Record<ServiceTicket['status'], 'default' | 'secondary' | 'outline' | 'destructive'> = {
  available: 'outline',
  open: 'default',
  awaiting_payment: 'secondary',
  closed: 'outline',
  cancelled: 'destructive',
};

const normalizeTicketLookup = (value: string) => value.trim().toUpperCase();
const parsePositiveInteger = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const getTicketTotal = (items: ServiceTicketItem[]) =>
  items.filter(item => item.status === 'active').reduce((sum, item) => sum + Number(item.total || 0), 0);

export default function ServiceTickets() {
  const navigate = useNavigate();
  const { role, username, user, isAdmin } = useAuth();
  const {
    products,
    serviceTickets,
    serviceTicketItems,
    loading,
    createServiceTicket,
    addServiceTicketItem,
    updateServiceTicketStatus,
    cancelServiceTicketItem,
  } = useData();
  const [lookup, setLookup] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [creatingTickets, setCreatingTickets] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(false);
  const [createStart, setCreateStart] = useState('1');
  const [createEnd, setCreateEnd] = useState('1');
  const [cancelTarget, setCancelTarget] = useState<ServiceTicketItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const operatorName = username || user?.email || 'Operador';
  const canManageTickets = role === 'admin' || role === 'operator';
  const activeProducts = products.filter(product => !product.deleted);
  const visibleTickets = serviceTickets
    .filter(ticket => ticket.status !== 'closed' && ticket.status !== 'cancelled')
    .sort((left, right) => left.number - right.number);
  const openTickets = visibleTickets.filter(ticket => ticket.status === 'open' || ticket.status === 'awaiting_payment');
  const selectedTicket = selectedTicketId
    ? serviceTickets.find(ticket => ticket.id === selectedTicketId) ?? null
    : null;
  const selectedTicketItems = selectedTicket
    ? serviceTicketItems.filter(item => item.ticket_id === selectedTicket.id)
    : [];
  const selectedTicketActiveItems = selectedTicketItems.filter(item => item.status === 'active');
  const selectedTicketTotal = getTicketTotal(selectedTicketItems);
  const productResults = useMemo(() => {
    if (!productSearch.trim()) return activeProducts.slice(0, 8);
    return filterProductsBySearch(activeProducts, productSearch).slice(0, 8);
  }, [activeProducts, productSearch]);

  const findTicket = (value: string) => {
    const normalized = normalizeTicketLookup(value);
    if (!normalized) return null;
    const number = Number.parseInt(normalized, 10);
    return serviceTickets.find(ticket =>
      ticket.barcode.trim().toUpperCase() === normalized
      || (Number.isInteger(number) && ticket.number === number)
    ) ?? null;
  };

  const selectTicket = (ticket: ServiceTicket) => {
    setSelectedTicketId(ticket.id);
    setLookup(String(ticket.number));
  };

  const handleLookup = (event?: FormEvent) => {
    event?.preventDefault();
    const ticket = findTicket(lookup);
    if (!ticket) {
      toast.error('Comanda nao encontrada');
      return;
    }

    selectTicket(ticket);
  };

  const handleCreateTickets = async () => {
    if (!canManageTickets) return;
    const start = parsePositiveInteger(createStart);
    const end = parsePositiveInteger(createEnd || createStart);
    if (!start || !end || end < start) {
      toast.error('Informe um intervalo valido');
      return;
    }

    if (end - start > 200) {
      toast.error('Crie no maximo 200 comandas por vez');
      return;
    }

    setCreatingTickets(true);
    try {
      let created = 0;
      for (let number = start; number <= end; number += 1) {
        if (serviceTickets.some(ticket => ticket.number === number)) continue;
        await createServiceTicket(number);
        created += 1;
      }

      toast.success(created > 0 ? `${created} comanda${created === 1 ? '' : 's'} criada${created === 1 ? '' : 's'}` : 'Comandas ja cadastradas');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel criar as comandas');
    } finally {
      setCreatingTickets(false);
    }
  };

  const resolveProductFromSearch = (): Product | null => {
    const exact = productSearch.trim()
      ? activeProducts.find(product => isExactProductSearchMatch(product, productSearch))
      : null;
    return exact || productResults[0] || null;
  };

  const handleAddItem = async () => {
    if (!selectedTicket) {
      toast.error('Selecione uma comanda');
      return;
    }

    const product = resolveProductFromSearch();
    if (!product) {
      toast.error('Produto nao encontrado');
      return;
    }

    const parsedQuantity = Number.parseFloat(quantity.replace(',', '.'));
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('Informe uma quantidade valida');
      return;
    }

    setAddingItem(true);
    try {
      await addServiceTicketItem(selectedTicket.id, {
        productId: product.id,
        productName: product.name,
        quantity: parsedQuantity,
        unitPrice: product.price,
        notes: notes.trim() || null,
        addedByName: operatorName,
      });
      setProductSearch('');
      setQuantity('1');
      setNotes('');
      toast.success(`${product.name} lancado na comanda ${selectedTicket.number}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel lancar o produto');
    } finally {
      setAddingItem(false);
    }
  };

  const handleTicketStatus = async (status: ServiceTicket['status']) => {
    if (!selectedTicket) return;
    setUpdatingTicket(true);
    try {
      await updateServiceTicketStatus(selectedTicket.id, status, { closedByName: operatorName });
      toast.success('Comanda atualizada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel atualizar a comanda');
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleCancelItem = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error('Informe o motivo do cancelamento');
      return;
    }

    try {
      await cancelServiceTicketItem(cancelTarget.id, cancelReason.trim(), operatorName);
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Item cancelado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel cancelar o item');
    }
  };

  const openSelectedTicketInPdv = () => {
    if (!selectedTicket) return;
    navigate(`/pdv?comanda=${selectedTicket.number}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comandas</h1>
          <p className="text-sm text-muted-foreground">
            {role === 'waiter' ? 'Lancamento de pedidos' : 'Controle de comandas abertas e prontas para o caixa'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageTickets && (
            <Button variant="outline" onClick={() => navigate('/pdv')}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Abrir PDV
            </Button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[22rem_minmax(0,1fr)_24rem]">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-5 w-5" />
                Abrir comanda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form className="space-y-2" onSubmit={handleLookup}>
                <Label>Numero ou codigo de barras</Label>
                <div className="flex gap-2">
                  <Input
                    value={lookup}
                    onChange={event => setLookup(event.target.value.toUpperCase())}
                    placeholder="1 ou HC-CMD-0001"
                  />
                  <Button type="submit" size="icon" aria-label="Buscar comanda">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {canManageTickets && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-5 w-5" />
                  Cadastrar comandas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Inicial</Label>
                    <Input inputMode="numeric" value={createStart} onChange={event => setCreateStart(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Final</Label>
                    <Input inputMode="numeric" value={createEnd} onChange={event => setCreateEnd(event.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => void handleCreateTickets()} disabled={creatingTickets}>
                  {creatingTickets ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
                  Criar numeracao
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5" />
                Abertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : openTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma comanda aberta.</p>
              ) : (
                openTickets.map(ticket => {
                  const total = getTicketTotal(serviceTicketItems.filter(item => item.ticket_id === ticket.id));
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedTicket?.id === ticket.id ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'
                      }`}
                      onClick={() => selectTicket(ticket)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Comanda {ticket.number}</span>
                        <Badge variant={ticketStatusVariant[ticket.status]}>{ticketStatusLabel[ticket.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{ticket.barcode}</p>
                      <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(total)}</p>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-col overflow-hidden border-border/50">
          <CardHeader className="shrink-0 pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              {selectedTicket ? `Comanda ${selectedTicket.number}` : 'Selecione uma comanda'}
              {selectedTicket && <Badge variant={ticketStatusVariant[selectedTicket.status]}>{ticketStatusLabel[selectedTicket.status]}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            {!selectedTicket ? (
              <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Busque pelo numero ou codigo de barras para abrir a comanda.
              </div>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Numero</p>
                    <p className="mt-1 font-semibold">{selectedTicket.number}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Codigo</p>
                    <p className="mt-1 break-all font-semibold">{selectedTicket.barcode}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="mt-1 font-semibold text-primary">{formatCurrency(selectedTicketTotal)}</p>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-border p-3 lg:grid-cols-[minmax(0,1fr)_7rem]">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Input
                      value={productSearch}
                      onChange={event => setProductSearch(toProductUppercase(event.target.value))}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void handleAddItem();
                        }
                      }}
                      placeholder="MARLBORO"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {productResults.map(product => (
                        <Button
                          key={product.id}
                          type="button"
                          variant="outline"
                          className="h-auto justify-between gap-3 px-3 py-2 text-left"
                          onClick={() => setProductSearch(product.name)}
                        >
                          <span className="min-w-0 truncate">{product.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatCurrency(product.price)}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Qtd.</Label>
                    <Input inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} />
                    <Button className="w-full" onClick={() => void handleAddItem()} disabled={addingItem || selectedTicket.status === 'closed' || selectedTicket.status === 'cancelled'}>
                      {addingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Lancar
                    </Button>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Observacao</Label>
                    <Textarea value={notes} onChange={event => setNotes(event.target.value)} className="min-h-[70px] resize-none" />
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                  {selectedTicketItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Nenhum produto lancado.
                    </p>
                  ) : (
                    selectedTicketItems.map(item => (
                      <div key={item.id} className={`rounded-lg border p-3 ${item.status === 'cancelled' ? 'border-destructive/30 bg-destructive/5 opacity-75' : 'border-border bg-background'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight">{item.product_name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.quantity} x {formatCurrency(item.unit_price)} • {formatDateTime(item.created_at)}
                            </p>
                            {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
                            {item.status === 'cancelled' && <Badge variant="destructive" className="mt-2">Cancelado</Badge>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold text-primary">{formatCurrency(item.total)}</p>
                            {isAdmin && item.status === 'active' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-destructive hover:text-destructive"
                                onClick={() => setCancelTarget(item)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row">
                  {role === 'waiter' && (
                    <Button
                      className="flex-1"
                      onClick={() => void handleTicketStatus('awaiting_payment')}
                      disabled={updatingTicket || selectedTicketActiveItems.length === 0}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Enviar para caixa
                    </Button>
                  )}
                  {canManageTickets && (
                    <>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => void handleTicketStatus('open')}
                        disabled={updatingTicket || selectedTicket.status === 'open'}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Manter aberta
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={openSelectedTicketInPdv}
                        disabled={selectedTicketActiveItems.length === 0}
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Abrir no PDV
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Alert className="border-primary/30 bg-primary/5">
            <Barcode className="h-4 w-4" />
            <AlertTitle>Comanda numerada</AlertTitle>
            <AlertDescription>
              O caixa abre pelo numero impresso ou pelo codigo de barras da comanda.
            </AlertDescription>
          </Alert>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comandas abertas</p>
                <p className="mt-1 text-2xl font-bold">{openTickets.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Aguardando caixa</p>
                <p className="mt-1 text-2xl font-bold">
                  {visibleTickets.filter(ticket => ticket.status === 'awaiting_payment').length}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total aberto</p>
                <p className="mt-1 text-2xl font-bold text-primary">
                  {formatCurrency(openTickets.reduce((sum, ticket) =>
                    sum + getTicketTotal(serviceTicketItems.filter(item => item.ticket_id === ticket.id)), 0
                  ))}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(cancelTarget)} onOpenChange={open => { if (!open) setCancelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar item da comanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{cancelTarget?.product_name}</p>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={cancelReason} onChange={event => setCancelReason(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => void handleCancelItem()}>Cancelar item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
