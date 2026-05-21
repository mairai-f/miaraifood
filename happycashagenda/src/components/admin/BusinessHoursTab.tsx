/**
 * Aba de Horários de Funcionamento do Painel Admin
 * - Edição dos horários por dia da semana
 * - Toggle para aberto/fechado
 */

import { useState, useEffect } from 'react';
import { Clock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BusinessHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface BusinessHoursTabProps {
  isAdmin: boolean;
  onUpdate?: () => void;
}

export function BusinessHoursTab({ isAdmin, onUpdate }: BusinessHoursTabProps) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchHours();
  }, []);

  const fetchHours = async () => {
    const { data } = await supabase.from('business_hours').select('*').order('day_of_week');
    if (data) setHours(data);
    setLoading(false);
  };

  const updateHour = (id: string, field: keyof BusinessHour, value: any) => {
    setHours(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  const saveAll = async () => {
    setSaving(true);

    for (const hour of hours) {
      const { error } = await supabase
        .from('business_hours')
        .update({
          open_time: hour.open_time,
          close_time: hour.close_time,
          is_open: hour.is_open,
        })
        .eq('id', hour.id);

      if (error) {
        toast({ title: 'Erro', description: `Não foi possível salvar ${DAY_NAMES[hour.day_of_week]}.`, variant: 'destructive' });
        setSaving(false);
        return;
      }
    }

    toast({ title: 'Horários salvos com sucesso!' });
    setSaving(false);
    onUpdate?.();
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" /> Horários de Funcionamento
        </CardTitle>
        {isAdmin && (
          <Button onClick={saveAll} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hours.map(hour => (
            <div key={hour.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center justify-between sm:w-32">
                <span className="font-medium text-sm">{DAY_NAMES[hour.day_of_week]}</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={hour.is_open}
                  onCheckedChange={(checked) => updateHour(hour.id, 'is_open', checked)}
                  disabled={!isAdmin}
                />
                <span className={`text-xs ${hour.is_open ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {hour.is_open ? 'Aberto' : 'Fechado'}
                </span>
              </div>

              {hour.is_open && (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type="time"
                    value={hour.open_time?.slice(0, 5)}
                    onChange={e => updateHour(hour.id, 'open_time', e.target.value)}
                    className="w-28"
                    disabled={!isAdmin}
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={hour.close_time?.slice(0, 5)}
                    onChange={e => updateHour(hour.id, 'close_time', e.target.value)}
                    className="w-28"
                    disabled={!isAdmin}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
