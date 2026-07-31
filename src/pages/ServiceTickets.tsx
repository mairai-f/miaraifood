import { useState } from 'react';
import { ClipboardList, Hash, Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isValidServiceTicketNumber } from '@/lib/serviceTicket';
import { formatCurrency } from '../../shared/locale/format';
import type { ServiceTicket, ServiceTicketItem } from '@/types';


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

const parsePositiveInteger = (value: string) => {
  const parsed = Number.parseInt(value.trim(), 10);
  return isValidServiceTicketNumber(parsed) ? parsed : null;
};

const getTicketTotal = (items: ServiceTicketItem[]) =>
  items.filter(item => item.status === 'active').reduce((sum, item) => sum + Number(item.total || 0), 0);

export default function ServiceTickets() {
  const { role } = useAuth();
  const {
    serviceTickets,
    serviceTicketItems,
    loading,
    createServiceTicket,
    reopenServiceTicket,
  } = useData();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [creatingTickets, setCreatingTickets] = useState(false);
  const [createNumber, setCreateNumber] = useState('1');
  const [ticketToReopen, setTicketToReopen] = useState<string | null>(null);
  const [reopeningTicket, setReopeningTicket] = useState(false);

  const canManageTickets = role === 'admin' || role === 'operator';
  const visibleTickets = [...serviceTickets].sort((left, right) => left.number - right.number);
  const selectedTicket = selectedTicketId
    ? serviceTickets.find(ticket => ticket.id === selectedTicketId) ?? null
    : null;
  const selectedTicketTotal = selectedTicket
    ? getTicketTotal(serviceTicketItems.filter(item => item.ticket_id === selectedTicket.id))
    : 0;

  const handleCreateTicket = async () => {
    if (!canManageTickets) return;

    const number = parsePositiveInteger(createNumber);
    if (!number) {
      toast.error('Informe um numero valido');
      return;
    }

    setCreatingTickets(true);
    try {
      if (serviceTickets.some(ticket => ticket.number === number)) {
        toast.error('Essa comanda ja esta cadastrada');
        return;
      }

      await createServiceTicket(number);
      toast.success(`Comanda ${number} cadastrada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel cadastrar a comanda');
    } finally {
      setCreatingTickets(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!ticketToReopen) return;
    setReopeningTicket(true);
    const ticket = serviceTickets.find(t => t.id === ticketToReopen);
    try {
      await reopenServiceTicket(ticketToReopen);
      toast.success(`Comanda ${ticket?.number ?? ''} reaberta com sucesso`);
      setTicketToReopen(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel reabrir a comanda');
    } finally {
      setReopeningTicket(false);
    }
  };

  const ticketToReopenData = ticketToReopen
    ? serviceTickets.find(t => t.id === ticketToReopen)
    : null;

  return (

    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div data-tour-id="service-ticket-header">
        <h1 className="text-2xl font-bold">Comandas</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro das comandas por numero com codigo gerado automaticamente.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {canManageTickets && (
            <Card className="border-border/50" data-tour-id="service-ticket-create">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className="h-5 w-5" />
                  Cadastrar comanda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Numero da comanda</Label>
                  <Input
                    inputMode="numeric"
                    value={createNumber}
                    onChange={event => setCreateNumber(event.target.value)}
                  />
                </div>
                <Button className="w-full" onClick={() => void handleCreateTicket()} disabled={creatingTickets}>
                  {creatingTickets ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
                  Cadastrar comanda
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50" data-tour-id="service-ticket-open-list">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5" />
                Todas as comandas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : visibleTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma comanda cadastrada.</p>
              ) : (
                visibleTickets.map(ticket => {
                  const total = getTicketTotal(serviceTicketItems.filter(item => item.ticket_id === ticket.id));
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedTicket?.id === ticket.id ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">Comanda {ticket.number}</span>
                        <Badge variant={ticketStatusVariant[ticket.status]}>{ticketStatusLabel[ticket.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">Codigo: {ticket.barcode}</p>
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
                Selecione uma comanda cadastrada para consultar o numero e o codigo dela.
              </div>
            ) : (
              <>
                <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Numero</p>
                    <p className="mt-1 font-semibold">{selectedTicket.number}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Codigo automatico</p>
                    <p className="mt-1 font-semibold">{selectedTicket.barcode}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total atual</p>
                    <p className="mt-1 font-semibold text-primary">{formatCurrency(selectedTicketTotal)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Esta tela serve apenas para cadastro e consulta da comanda. Para abrir a comanda, lancar produtos e finalizar, use o PDV digitando o numero dela ou escaneando o codigo automatico dela.
                </div>

                {canManageTickets && selectedTicket.status === 'closed' && (
                  <Button
                    variant="outline"
                    className="mt-2 gap-2 self-start"
                    onClick={() => setTicketToReopen(selectedTicket.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reabrir comanda para nova rodada
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!ticketToReopen} onOpenChange={open => { if (!open) setTicketToReopen(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir comanda {ticketToReopenData?.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os itens da rodada anterior serão cancelados e a comanda voltará ao status <strong>Livre</strong>, pronta para uma nova rodada. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopeningTicket}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleReopenTicket()} disabled={reopeningTicket}>
              {reopeningTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
