import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { supabase } from '@/integrations/supabase/client';
import { notifyWaiterCall, playWaiterCallAlert } from '@/lib/waiterAlerts';

type WaiterCall = { id: string; kind: 'waiter_call' | 'bill_request'; status: string; created_at: string; food_table_sessions: { table_id: string; food_tables: { code: string } | null } | null };

export default function WaiterCalls() {
  const { scope } = useOperationalScope();
  const [calls, setCalls] = useState<WaiterCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [handling, setHandling] = useState<string | null>(null);

  const read = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('food_waiter_calls')
      .select('id,kind,status,created_at,food_table_sessions(table_id,food_tables(code))')
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) toast.error('Não foi possível carregar os chamados.');
    else setCalls((data ?? []) as WaiterCall[]);
    setLoading(false);
  }, []);

  useEffect(() => { void read(); }, [read, scope?.location.id]);
  useEffect(() => {
    const channel = supabase.channel('waiter-calls-screen')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'food_waiter_calls' }, () => {
        playWaiterCallAlert();
        notifyWaiterCall('Uma mesa');
        void read();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'food_waiter_calls' }, () => void read())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [read]);

  const accept = async (call: WaiterCall) => {
    setHandling(call.id);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('food_waiter_calls').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString(), handled_by_user_id: auth.user?.id }).eq('id', call.id).eq('status', 'open');
    if (error) toast.error('Não foi possível assumir este chamado.');
    else { toast.success('Chamado assumido.'); await read(); }
    setHandling(null);
  };

  return <main className="space-y-4 p-4">
    <div><p className="text-sm font-medium text-primary">Operação do salão</p><h1 className="text-2xl font-bold">Chamados</h1><p className="text-sm text-muted-foreground">Solicitações reais enviadas pelo QR Menu.</p></div>
    {loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      : calls.length === 0 ? <Card><CardContent className="py-14 text-center text-sm text-muted-foreground"><BellRing className="mx-auto mb-3 h-8 w-8 text-primary/60" />Nenhum chamado aguardando atendimento.</CardContent></Card>
        : calls.map((call) => { const code = call.food_table_sessions?.food_tables?.code || 'Mesa'; return <Card key={call.id} className="border-primary/30"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-full bg-primary/10 p-2 text-primary"><BellRing className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-bold">{code}</p><p className="text-sm text-muted-foreground">{call.kind === 'bill_request' ? 'Solicitou a conta' : 'Chamou o garçom'} · {new Date(call.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p></div><Button size="sm" onClick={() => void accept(call)} disabled={handling === call.id}>{handling === call.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-1 h-4 w-4" />Assumir</>}</Button></CardContent></Card>; })}
  </main>;
}
