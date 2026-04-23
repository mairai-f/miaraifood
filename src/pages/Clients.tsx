import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Phone, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { getClientUniqueSlug } from '@/lib/clientSlug';
import { sortClientsByDebt } from '@/lib/clientSorting';

export default function Clients() {
  const { clients, addClient, getClientBalance, getClientTotalSpending } = useData();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const active = clients.filter(c => !c.deleted);
  const filtered = sortClientsByDebt(
    active.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
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
    try {
      await addClient(name.trim(), normalizedPhone);
      setName(''); setPhone(''); setOpen(false);
      toast.success('Cliente cadastrado!');
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);
      toast.error('Não foi possível cadastrar o cliente');
    }
  };

  return (
    <div>
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Consulte saldos e acesse rapidamente cada cliente.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="mobile-full-btn"><Plus className="h-4 w-4 mr-2" />Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do cliente" /></div>
              <div className="space-y-2"><Label>Telefone (WhatsApp)</Label><Input value={formatPhoneMask(phone)} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="(11) 99999-9999" /></div>
            </div>
            <DialogFooter><Button onClick={handleAdd}>Cadastrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(c => {
          const balance = getClientBalance(c.id);
          return (
            <motion.div key={c.id} whileHover={{ scale: 1.02, boxShadow: '0 0 25px hsl(217 91% 60% / 0.15)' }} className="cursor-pointer" onClick={() => navigate(`/cliente/${encodeURIComponent(getClientUniqueSlug(c, active))}`)}>
              <Card className="border-border/50 h-full">
                <CardContent className="card-tight">
                  <h3 className="mb-2 break-words text-lg font-semibold leading-tight">{c.name}</h3>
                  {c.phone && <p className="meta-text flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" /><span className="truncate">{c.phone}</span></p>}
                  <div className="mt-3 flex items-center gap-1">
                    <DollarSign className="h-4 w-4 shrink-0" />
                    <span className={`money-value font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>R$ {balance.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground mt-8">Nenhum cliente encontrado.</p>}
    </div>
  );
}
