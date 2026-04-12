import { useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Gift } from 'lucide-react';
import { toast } from 'sonner';

interface Reward { id: string; name: string; description: string; minimum_spending: number; created_at: string; }

export default function Rewards() {
  const { rewards, addReward, updateReward, deleteReward } = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minimumSpending, setMinimumSpending] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !description.trim() || !minimumSpending) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    const spending = parseFloat(minimumSpending);
    if (isNaN(spending) || spending <= 0) {
      toast.error('Digite um valor válido para a meta');
      return;
    }

    try {
      if (editId) {
        await updateReward(editId, { name: name.trim(), description: description.trim(), minimum_spending: spending });
        toast.success('Recompensa atualizada!');
      } else {
        await addReward(name.trim(), description.trim(), spending);
        toast.success('Recompensa cadastrada!');
      }
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar recompensa');
      console.error(error);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setMinimumSpending('');
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (reward: Reward) => {
    setEditId(reward.id);
    setName(reward.name);
    setDescription(reward.description);
    setMinimumSpending(reward.minimum_spending.toString());
    setOpen(true);
  };

  return (
    <div>
      <div className="page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Recompensas</h1>
          <p className="page-subtitle">Configure metas de consumo e ganhos para seus clientes.</p>
        </div>
        <Dialog open={open} onOpenChange={v => {
          if (!v) resetForm();
          setOpen(v);
        }}>
          <DialogTrigger asChild>
            <Button className="mobile-full-btn"><Plus className="h-4 w-4 mr-2" />Nova Recompensa</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar Recompensa' : 'Cadastrar Recompensa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Recompensa</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Cerveja Grátis, Desconto 10%"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Uma cerveja 600ml grátis"
                />
              </div>
              <div className="space-y-2">
                <Label>Meta de Consumo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={minimumSpending}
                  onChange={e => setMinimumSpending(e.target.value)}
                  placeholder="300.00"
                />
                <p className="text-xs text-muted-foreground">
                  Cliente ganha essa recompensa após consumir este valor
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>{editId ? 'Salvar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.length === 0 ? (
          <p className="text-center text-muted-foreground mt-8 col-span-full">
            Nenhuma recompensa cadastrada. Crie uma para começar!
          </p>
        ) : (
          rewards.map(reward => (
            <motion.div
              key={reward.id}
              whileHover={{ scale: 1.02, boxShadow: '0 0 25px hsl(217 91% 60% / 0.15)' }}
            >
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-primary" />
                    {reward.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                  <div className="bg-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Meta de Consumo</p>
                    <p className="text-lg font-bold text-primary">R$ {reward.minimum_spending.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(reward)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="flex-1">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir recompensa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A recompensa "{reward.name}" será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              deleteReward(reward.id);
                              toast.success('Recompensa excluída');
                            }}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
