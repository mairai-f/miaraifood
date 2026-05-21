/**
 * Aba de Fidelidade do Painel Admin
 * - CRUD de programas de fidelidade (metas)
 * - Gerenciamento de progresso dos clientes
 * - Barra de progresso visual
 * - Usa clientes cadastrados do banco
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Trophy, Target, Gift, UserPlus, Minus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  goal_count: number;
  reward_description: string;
  service_id: string | null;
  is_active: boolean;
  service?: { name: string } | null;
}

interface LoyaltyProgress {
  id: string;
  program_id: string;
  client_name: string;
  client_phone: string | null;
  current_count: number;
  completed: boolean;
  reward_claimed: boolean;
}

interface Service {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
  phone: string | null;
}

interface LoyaltyTabProps {
  isAdmin: boolean;
  clientName?: string; // For client view: filter by name
}

export function LoyaltyTab({ isAdmin, clientName }: LoyaltyTabProps) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [progress, setProgress] = useState<LoyaltyProgress[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Program dialog
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programGoal, setProgramGoal] = useState('10');
  const [programReward, setProgramReward] = useState('Serviço grátis');
  const [programServiceId, setProgramServiceId] = useState('');

  // Add client dialog
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();

    // Realtime for loyalty_progress changes
    const channel = supabase
      .channel('loyalty-progress-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loyalty_progress' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    const [programsRes, progressRes, servicesRes, clientsRes] = await Promise.all([
      supabase.from('loyalty_programs').select('*, service:services(name)').order('created_at', { ascending: false }),
      supabase.from('loyalty_progress').select('*').order('client_name'),
      supabase.from('services').select('id, name').eq('is_active', true).order('name'),
      supabase.from('clients').select('id, name, phone').order('name'),
    ]);

    if (programsRes.data) {
      setPrograms(programsRes.data.map(p => ({
        ...p,
        service: p.service as unknown as { name: string } | null,
      })));
    }
    if (progressRes.data) setProgress(progressRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  };

  const openProgramDialog = (program?: LoyaltyProgram) => {
    if (program) {
      setEditingProgram(program);
      setProgramName(program.name);
      setProgramDescription(program.description || '');
      setProgramGoal(String(program.goal_count));
      setProgramReward(program.reward_description);
      setProgramServiceId(program.service_id || '');
    } else {
      setEditingProgram(null);
      setProgramName('');
      setProgramDescription('');
      setProgramGoal('10');
      setProgramReward('Serviço grátis');
      setProgramServiceId('');
    }
    setShowProgramDialog(true);
  };

  const saveProgram = async () => {
    if (!programName.trim()) {
      toast({ title: 'Erro', description: 'Nome da meta é obrigatório.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const data = {
      name: programName,
      description: programDescription || null,
      goal_count: parseInt(programGoal) || 10,
      reward_description: programReward,
      service_id: programServiceId || null,
    };

    if (editingProgram) {
      const { error } = await supabase.from('loyalty_programs').update(data).eq('id', editingProgram.id);
      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível atualizar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Meta atualizada.' });
      }
    } else {
      const { error } = await supabase.from('loyalty_programs').insert(data);
      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível criar.', variant: 'destructive' });
      } else {
        toast({ title: 'Sucesso', description: 'Meta criada.' });
      }
    }

    setSubmitting(false);
    setShowProgramDialog(false);
    fetchData();
  };

  const deleteProgram = async (id: string) => {
    const { error } = await supabase.from('loyalty_programs').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Meta removida' });
      fetchData();
    }
  };

  const addClientToProgram = async () => {
    if (!selectedClientId || !selectedProgramId) {
      toast({ title: 'Erro', description: 'Selecione um cliente e uma meta.', variant: 'destructive' });
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    // Check if client is already in this program
    const existing = progress.find(p =>
      p.program_id === selectedProgramId &&
      p.client_name.toLowerCase().trim() === client.name.toLowerCase().trim()
    );
    if (existing) {
      toast({ title: 'Erro', description: 'Este cliente já está inscrito nesta meta.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from('loyalty_progress').insert({
      program_id: selectedProgramId,
      client_name: client.name,
      client_phone: client.phone || null,
      client_id: client.id,
      current_count: 0,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar cliente.', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: `${client.name} adicionado à meta.` });
    }

    setSubmitting(false);
    setShowAddClientDialog(false);
    setSelectedClientId('');
    setClientSearch('');
    fetchData();
  };

  const updateProgress = async (progressId: string, increment: number) => {
    const item = progress.find(p => p.id === progressId);
    if (!item) return;

    const program = programs.find(p => p.id === item.program_id);
    const newCount = Math.max(0, item.current_count + increment);
    const completed = program ? newCount >= program.goal_count : false;

    const { error } = await supabase
      .from('loyalty_progress')
      .update({ current_count: newCount, completed })
      .eq('id', progressId);

    if (!error) {
      if (completed && !item.completed) {
        toast({ title: '🎉 Meta atingida!', description: `${item.client_name} completou a meta!` });
      }
      fetchData();
    }
  };

  const claimReward = async (progressId: string) => {
    const { error } = await supabase
      .from('loyalty_progress')
      .update({ reward_claimed: true })
      .eq('id', progressId);

    if (!error) {
      toast({ title: '🎁 Recompensa resgatada!' });
      fetchData();
    }
  };

  const resetProgress = async (progressId: string) => {
    const { error } = await supabase
      .from('loyalty_progress')
      .update({ current_count: 0, completed: false, reward_claimed: false })
      .eq('id', progressId);

    if (!error) {
      toast({ title: 'Progresso resetado' });
      fetchData();
    }
  };

  const removeClient = async (progressId: string) => {
    const { error } = await supabase.from('loyalty_progress').delete().eq('id', progressId);
    if (!error) {
      toast({ title: 'Cliente removido da meta' });
      fetchData();
    }
  };

  const getProgressForProgram = (programId: string) => {
    let filtered = progress.filter(p => p.program_id === programId);
    // If clientName is provided (client view), filter to only their progress
    if (clientName) {
      filtered = filtered.filter(p => p.client_name.toLowerCase().trim() === clientName.toLowerCase().trim());
    }
    return filtered;
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // For client view: only show programs where the client has progress
  const visiblePrograms = clientName
    ? programs.filter(p => progress.some(pr => pr.program_id === p.id && pr.client_name.toLowerCase().trim() === clientName.toLowerCase().trim()))
    : programs;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openProgramDialog()} size="sm">
            <Plus className="w-4 h-4 mr-1" /> Nova Meta
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setShowAddClientDialog(true);
            setSelectedProgramId(programs[0]?.id || '');
            setSelectedClientId('');
            setClientSearch('');
          }} disabled={programs.length === 0}>
            <UserPlus className="w-4 h-4 mr-1" /> Adicionar Cliente
          </Button>
        </div>
      )}

      {visiblePrograms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-serif text-xl font-semibold mb-2">
              {clientName ? 'Nenhuma meta vinculada a você' : 'Nenhuma meta de fidelidade'}
            </h3>
            <p className="text-muted-foreground">
              {isAdmin ? 'Crie uma meta para fidelizar seus clientes.' :
               clientName ? 'Peça ao administrador para adicioná-lo a uma meta.' :
               'Nenhuma meta disponível no momento.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        visiblePrograms.map(program => {
          const programClients = getProgressForProgram(program.id);

          return (
            <Card key={program.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 sm:p-6">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary shrink-0" />
                    <CardTitle className="text-base sm:text-lg truncate">{program.name}</CardTitle>
                  </div>
                  {program.description && (
                    <p className="text-sm text-muted-foreground">{program.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>🎯 Meta: {program.goal_count} {program.service?.name || 'serviços'}</span>
                    <span>🎁 {program.reward_description}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openProgramDialog(program)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteProgram(program.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
                {programClients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum cliente inscrito nesta meta.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {programClients.map(client => {
                      const pct = Math.min(100, (client.current_count / program.goal_count) * 100);

                      return (
                        <div key={client.id} className="p-3 rounded-lg bg-secondary/30 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{client.client_name}</p>
                              {client.client_phone && (
                                <p className="text-xs text-muted-foreground">{client.client_phone}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-sm font-bold">
                                {client.current_count}/{program.goal_count}
                              </span>
                              {client.completed && !client.reward_claimed && (
                                <Gift className="w-4 h-4 text-primary animate-pulse" />
                              )}
                              {client.reward_claimed && (
                                <span className="text-xs text-primary">✅</span>
                              )}
                            </div>
                          </div>

                          <Progress value={pct} className="h-3" />

                          {isAdmin && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => updateProgress(client.id, 1)}>
                                <Plus className="w-3 h-3 mr-1" /> +1
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => updateProgress(client.id, -1)}
                                disabled={client.current_count <= 0}>
                                <Minus className="w-3 h-3 mr-1" /> -1
                              </Button>
                              {client.completed && !client.reward_claimed && (
                                <Button size="sm" variant="default" className="h-7 text-xs px-2" onClick={() => claimReward(client.id)}>
                                  <Gift className="w-3 h-3 mr-1" /> Resgatar
                                </Button>
                              )}
                              {client.reward_claimed && (
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => resetProgress(client.id)}>
                                  Resetar
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive ml-auto" onClick={() => removeClient(client.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Program Dialog */}
      <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProgram ? 'Editar Meta' : 'Nova Meta de Fidelidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Meta</Label>
              <Input value={programName} onChange={e => setProgramName(e.target.value)}
                placeholder="Ex: 10 cortes, ganhe 1 grátis" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={programDescription} onChange={e => setProgramDescription(e.target.value)}
                placeholder="Descrição da meta" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={programGoal} onChange={e => setProgramGoal(e.target.value)} />
              </div>
              <div>
                <Label>Serviço</Label>
                <Select value={programServiceId} onValueChange={setProgramServiceId}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer serviço</SelectItem>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Recompensa</Label>
              <Input value={programReward} onChange={e => setProgramReward(e.target.value)}
                placeholder="Ex: 1 corte grátis" />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowProgramDialog(false)} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button onClick={saveProgram} disabled={submitting} className="flex-1 sm:flex-none">
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog - Now with registered clients list */}
      <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cliente à Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Meta</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente Cadastrado</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="pl-9"
                />
              </div>
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum cliente cadastrado. Cadastre clientes na aba de Clientes.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  {filteredClients.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors border-b last:border-b-0 ${
                        selectedClientId === client.id ? 'bg-primary/10 text-primary font-medium' : ''
                      }`}
                      onClick={() => setSelectedClientId(client.id)}
                    >
                      <span className="font-medium">{client.name}</span>
                      {client.phone && <span className="text-xs text-muted-foreground ml-2">{client.phone}</span>}
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowAddClientDialog(false)} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button onClick={addClientToProgram} disabled={submitting || !selectedClientId} className="flex-1 sm:flex-none">
              {submitting ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
