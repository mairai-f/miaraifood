import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CreditCard, Plus, Search, Phone, DollarSign, MessageCircle, AlertTriangle, Clock3, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanyDisplayName } from '@/hooks/use-company-display-name';
import { getClientUniqueSlug } from '@/lib/clientSlug';
import { sortClientsByDebt } from '@/lib/clientSorting';
import { getClientCreditLimit, normalizeCreditLimit } from '@/lib/creditLimit';
import { formatClientDebtDueDate, isClientDebtOverdue } from '@/lib/clientDebtDueDate';
import { buildClientCrmSummary } from '@/lib/managementInsights';
import { INTERNET_REQUIRED_MESSAGE, isInternetUnavailable, openExternalUrl } from '@/lib/openExternalUrl';
import { normalizeProductSearchText, toProductUppercase } from '@/lib/productSearch';
import { buildClientCrmWhatsAppUrl } from '@/lib/whatsapp';
import { getRedactedLogValue } from '../../shared/security/redaction';

type ClientFilter = 'all' | 'debtors' | 'oldDebt' | 'inactive' | 'vip';

export default function Clients() {
  const { clients, debtEntries, payments, sales, addClient, getClientBalance, getClientTotalSpending, loading } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const companyDisplayName = useCompanyDisplayName();
  const normalizedClientSearch = normalizeProductSearchText(search);

  const active = clients.filter(c => !c.deleted);
  const crmByClientId = new Map(active.map(client => [
    client.id,
    buildClientCrmSummary({
      client,
      debtEntries,
      payments,
      sales,
      balance: getClientBalance(client.id),
      totalSpending: getClientTotalSpending(client.id),
    }),
  ]));
  const debtorsCount = active.filter(client => getClientBalance(client.id) > 0).length;
  const oldDebtCount = active.filter(client => crmByClientId.get(client.id)?.hasOldDebt).length;
  const inactiveCount = active.filter(client => crmByClientId.get(client.id)?.isInactive).length;
  const vipCount = active.filter(client => crmByClientId.get(client.id)?.tags.includes('VIP')).length;
  const filtered = sortClientsByDebt(
    active.filter(c => {
      const summary = crmByClientId.get(c.id);
      const matchesSearch = !normalizedClientSearch
        || normalizeProductSearchText(c.name).includes(normalizedClientSearch)
        || c.phone.includes(search.replace(/\D/g, ''));
      const matchesFilter =
        filter === 'all'
        || (filter === 'debtors' && getClientBalance(c.id) > 0)
        || (filter === 'oldDebt' && summary?.hasOldDebt)
        || (filter === 'inactive' && summary?.isInactive)
        || (filter === 'vip' && summary?.tags.includes('VIP'));

      return matchesSearch && matchesFilter;
    }),
    getClientBalance,
    getClientTotalSpending,
  );

  const normalizeWhatsappPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const formatPhoneMask = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    const limited = local.slice(0, 11);
    if (limited.length <= 2) return limited;
    if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    if (limited.length <= 10) return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  };

  const handleAdd = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    const normalizedPhone = normalizeWhatsappPhone(phone.trim());
    const normalizedCreditLimit = normalizeCreditLimit(creditLimit);
    try {
      await addClient(name.trim(), normalizedPhone, normalizedCreditLimit, debtDueDate || null);
      setName(''); setPhone(''); setCreditLimit(''); setDebtDueDate(''); setOpen(false);
      toast.success('Cliente cadastrado!');
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', getRedactedLogValue(error));
      toast.error('Não foi possível cadastrar o cliente');
    }
  };

  const handleCrmWhatsApp = (event: MouseEvent, clientId: string) => {
    event.stopPropagation();
    const client = active.find(item => item.id === clientId);
    if (!client?.phone) {
      toast.error('Cliente sem WhatsApp cadastrado.');
      return;
    }

    if (isInternetUnavailable()) {
      toast.error(INTERNET_REQUIRED_MESSAGE);
      return;
    }

    const url = buildClientCrmWhatsAppUrl(client.phone, client.name, getClientBalance(client.id), companyDisplayName);
    if (!openExternalUrl(url)) {
      toast.error('Não foi possível abrir o WhatsApp.');
    }
  };

  const filterCards = [
    { key: 'all' as const, label: 'Todos', value: active.length, icon: Search },
    { key: 'debtors' as const, label: 'Devedores', value: debtorsCount, icon: DollarSign },
    { key: 'oldDebt' as const, label: 'Fiado antigo', value: oldDebtCount, icon: AlertTriangle },
    { key: 'inactive' as const, label: 'Inativos', value: inactiveCount, icon: Clock3 },
    { key: 'vip' as const, label: 'VIP', value: vipCount, icon: Star },
  ];

  if (loading) {
    return <DataRouteLoader label="Carregando clientes..." />;
  }

  return (
    <div>
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" data-tour-id="clients-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Consulte saldos e acesse rapidamente cada cliente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="mobile-full-btn" data-tour-id="clients-new"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(toProductUppercase(e.target.value))} placeholder="Nome do cliente" /></div>
              <div className="space-y-2"><Label>Telefone (WhatsApp)</Label><Input value={formatPhoneMask(phone)} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="(11) 99999-9999" /></div>
              <div className="space-y-2">
                <Label>Limite de crédito (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  placeholder="Sem limite"
                />
              </div>
              <div className="space-y-2">
                <Label>Data prevista para pagamento do fiado</Label>
                <Input type="date" value={debtDueDate} onChange={e => setDebtDueDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">Opcional. Pode ser alterada depois no cadastro do cliente.</p>
              </div>
            </div>
            <DialogFooter><Button onClick={handleAdd}>Cadastrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {filterCards.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${filter === item.key ? 'border-primary bg-primary/10' : 'border-border/50'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <item.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-1 text-xl font-bold">{item.value}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-6" data-tour-id="clients-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(toProductUppercase(e.target.value))} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour-id="clients-list">
        {filtered.map(c => {
          const balance = getClientBalance(c.id);
          const debtOverdue = isClientDebtOverdue(c.debt_due_date, balance);
          const clientCreditLimit = getClientCreditLimit(c);
          const crm = crmByClientId.get(c.id);
          return (
            <div
              key={c.id}
              className="cursor-pointer transition-colors hover:[&_.client-card]:border-primary/40 hover:[&_.client-card]:bg-accent/30"
              onClick={() => navigate(`/cliente/${encodeURIComponent(getClientUniqueSlug(c, active))}`)}
            >
              <Card className="border-border/50 h-full">
                <CardContent className="client-card card-tight h-full rounded-lg border border-transparent transition-colors">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="break-words text-lg font-semibold leading-tight">{c.name}</h3>
                    {c.phone && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        title="Chamar no WhatsApp"
                        onClick={(event) => handleCrmWhatsApp(event, c.id)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {c.phone && <p className="meta-text flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" /><span className="truncate">{c.phone}</span></p>}
                  <div className="mt-3 flex items-center gap-1">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    <span className={`money-value font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>R$ {balance.toFixed(2)}</span>
                  </div>
                  {clientCreditLimit !== null && (
                    <p className="meta-text mt-2 flex items-center gap-1">
                      <CreditCard className="h-3 w-3 shrink-0" />
                      <span>Limite: R$ {clientCreditLimit.toFixed(2)}</span>
                    </p>
                  )}
                  {balance > 0 && c.debt_due_date && (
                    <p className={`meta-text mt-2 flex items-center gap-1 ${debtOverdue ? 'font-medium text-destructive' : ''}`}>
                      <Clock3 className="h-3 w-3 shrink-0" />
                      <span>
                        {debtOverdue ? 'Atrasado: ' : 'Pagamento: '}
                        {formatClientDebtDueDate(c.debt_due_date)}
                      </span>
                    </p>
                  )}
                  {crm && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {crm.tags.slice(0, 4).map(tag => (
                        <Badge
                          key={tag}
                          variant={tag === 'Fiado antigo' || tag === 'Devedor' ? 'destructive' : tag === 'VIP' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {crm?.lastActivityAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ultimo movimento: {crm.daysInactive === 0 ? 'hoje' : `${crm.daysInactive}d atrás`}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground mt-8">Nenhum cliente encontrado.</p>}
    </div>
  );
}
