import { useState } from 'react';
import { motion } from 'framer-motion';
import { useData } from '@/contexts/DataContext';
import type { Reward } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Gift, Percent, Coins, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { getRedactedLogValue } from '../../shared/security/redaction';

type RewardType = NonNullable<Reward['reward_type']>;

const rewardTypeLabels: Record<RewardType, string> = {
  gift: 'Brinde',
  discount_amount: 'Desconto em R$',
  discount_percent: 'Desconto em %',
  cashback_amount: 'Cashback em R$',
  cashback_percent: 'Cashback em %',
  points: 'Pontos',
};

const rewardTypeDescriptions: Record<RewardType, string> = {
  gift: 'Entrega um brinde ou benefício manual.',
  discount_amount: 'Abate um valor fixo no PDV.',
  discount_percent: 'Abate uma porcentagem no PDV.',
  cashback_amount: 'Registra retorno fixo para o cliente.',
  cashback_percent: 'Registra retorno percentual para o cliente.',
  points: 'Converte a meta em pontos.',
};

const rewardTypesWithValue = new Set<RewardType>([
  'discount_amount',
  'discount_percent',
  'cashback_amount',
  'cashback_percent',
  'points',
]);

const getRewardIcon = (type: RewardType) => {
  if (type.includes('percent')) return Percent;
  if (type === 'points') return Coins;
  if (type.includes('discount')) return Ticket;
  return Gift;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatRewardValue = (reward: Reward) => {
  const type = reward.reward_type ?? 'gift';
  const value = Number(reward.reward_value || 0);

  if (type === 'gift') return 'Benefício manual';
  if (type === 'discount_percent' || type === 'cashback_percent') return `${value.toFixed(2)}%`;
  if (type === 'points') return `${value.toFixed(0)} pontos`;
  return formatMoney(value);
};

export default function Rewards() {
  const { rewards, addReward, updateReward, deleteReward } = useData();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minimumSpending, setMinimumSpending] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [rewardType, setRewardType] = useState<RewardType>('gift');
  const [rewardValue, setRewardValue] = useState('');
  const [pointsCost, setPointsCost] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [allowPdvRedemption, setAllowPdvRedemption] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!name.trim() || minimumSpending === '') {
      toast.error('Preencha o nome e a meta de consumo');
      return;
    }
    
    const spending = parseFloat(minimumSpending);
    if (isNaN(spending) || spending < 0) {
      toast.error('Digite um valor válido para a meta');
      return;
    }

    const parsedRewardValue = parseFloat(rewardValue) || 0;
    const parsedPointsCost = parseInt(pointsCost, 10) || 0;
    const parsedValidityDays = parseInt(validityDays, 10) || 30;

    if (rewardTypesWithValue.has(rewardType) && parsedRewardValue <= 0) {
      toast.error('Digite o valor da recompensa');
      return;
    }

    if ((rewardType === 'discount_percent' || rewardType === 'cashback_percent') && parsedRewardValue > 100) {
      toast.error('Percentual não pode passar de 100%');
      return;
    }

    if (parsedValidityDays <= 0) {
      toast.error('Validade precisa ser maior que zero');
      return;
    }

    const payload: Partial<Reward> = {
      name: name.trim(),
      description: description.trim(),
      minimum_spending: spending,
      enabled,
      reward_type: rewardType,
      reward_value: parsedRewardValue,
      points_cost: parsedPointsCost,
      validity_days: parsedValidityDays,
      allow_pdv_redemption: allowPdvRedemption,
      auto_apply: autoApply,
      notes: notes.trim(),
    };

    try {
      if (editId) {
        await updateReward(editId, payload);
        toast.success('Recompensa atualizada!');
      } else {
        await addReward(name.trim(), description.trim(), spending, payload);
        toast.success('Recompensa cadastrada!');
      }
      resetForm();
    } catch (error) {
      toast.error('Erro ao salvar recompensa');
      console.error(getRedactedLogValue(error));
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setMinimumSpending('');
    setEnabled(true);
    setRewardType('gift');
    setRewardValue('');
    setPointsCost('');
    setValidityDays('30');
    setAllowPdvRedemption(true);
    setAutoApply(false);
    setNotes('');
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (reward: Reward) => {
    setEditId(reward.id);
    setName(reward.name);
    setDescription(reward.description);
    setMinimumSpending(reward.minimum_spending.toString());
    setEnabled(reward.enabled !== false);
    setRewardType(reward.reward_type ?? 'gift');
    setRewardValue(Number(reward.reward_value || 0) > 0 ? String(reward.reward_value) : '');
    setPointsCost(Number(reward.points_cost || 0) > 0 ? String(reward.points_cost) : '');
    setValidityDays(String(reward.validity_days ?? 30));
    setAllowPdvRedemption(reward.allow_pdv_redemption !== false);
    setAutoApply(reward.auto_apply === true);
    setNotes(reward.notes ?? '');
    setOpen(true);
  };

  const showRewardValue = rewardTypesWithValue.has(rewardType);

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
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editId ? 'Editar Recompensa' : 'Cadastrar Recompensa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <Label>Recompensa ativa</Label>
                  <p className="text-xs text-muted-foreground">Quando desligada, não aparece para uso.</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

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
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ex: Uma cerveja 600ml grátis"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de recompensa</Label>
                  <Select value={rewardType} onValueChange={value => setRewardType(value as RewardType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(rewardTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{rewardTypeDescriptions[rewardType]}</p>
                </div>

                {showRewardValue && (
                  <div className="space-y-2">
                    <Label>
                      {rewardType === 'points'
                        ? 'Quantidade de pontos'
                        : rewardType.includes('percent')
                          ? 'Percentual'
                          : 'Valor da recompensa'}
                    </Label>
                    <Input
                      type="number"
                      step={rewardType === 'points' ? '1' : '0.01'}
                      value={rewardValue}
                      onChange={e => setRewardValue(e.target.value)}
                      placeholder={rewardType.includes('percent') ? '10' : '25.00'}
                    />
                  </div>
                )}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Custo em pontos</Label>
                  <Input
                    type="number"
                    step="1"
                    value={pointsCost}
                    onChange={e => setPointsCost(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Use 0 quando não houver troca por pontos.</p>
                </div>

                <div className="space-y-2">
                  <Label>Validade em dias</Label>
                  <Input
                    type="number"
                    step="1"
                    value={validityDays}
                    onChange={e => setValidityDays(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Label>Permitir no PDV</Label>
                    <p className="text-xs text-muted-foreground">Libera a seleção no checkout.</p>
                  </div>
                  <Switch checked={allowPdvRedemption} onCheckedChange={setAllowPdvRedemption} />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div>
                    <Label>Aplicação automática</Label>
                    <p className="text-xs text-muted-foreground">Marca a regra para uso automático.</p>
                  </div>
                  <Switch checked={autoApply} onCheckedChange={setAutoApply} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações internas</Label>
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Regras, exceções ou instruções para a equipe"
                  rows={3}
                />
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
                  <CardTitle className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      {(() => {
                        const Icon = getRewardIcon(reward.reward_type ?? 'gift');
                        return <Icon className="h-5 w-5 shrink-0 text-primary" />;
                      })()}
                      <span className="truncate">{reward.name}</span>
                    </span>
                    <Badge variant={reward.enabled === false ? 'secondary' : 'default'}>
                      {reward.enabled === false ? 'Inativa' : 'Ativa'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{reward.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{rewardTypeLabels[reward.reward_type ?? 'gift']}</Badge>
                    {reward.allow_pdv_redemption === false ? (
                      <Badge variant="secondary">Bloqueada no PDV</Badge>
                    ) : (
                      <Badge variant="outline">PDV liberado</Badge>
                    )}
                    {reward.auto_apply && <Badge variant="outline">Auto</Badge>}
                  </div>
                  <div className="bg-primary/10 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Meta de Consumo</p>
                    <p className="text-lg font-bold text-primary">{formatMoney(reward.minimum_spending)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Benefício</p>
                      <p className="font-medium">{formatRewardValue(reward)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-xs text-muted-foreground">Validade</p>
                      <p className="font-medium">{reward.validity_days ?? 30} dias</p>
                    </div>
                  </div>
                  {reward.notes && <p className="text-xs text-muted-foreground">Obs.: {reward.notes}</p>}
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
