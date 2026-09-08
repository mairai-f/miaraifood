import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { usePermissions } from '@/contexts/usePermissions';
import { listFoodTableBoard, getFoodTableQrToken, createFoodTable } from '@/lib/food';

export default function SettingsTables() {
  const { scope } = useOperationalScope(); const { hasPermission } = usePermissions();
  const [tables, setTables] = useState<any[]>([]); const [qr, setQr] = useState<Record<string,string>>({}); const [quantity, setQuantity] = useState('1'); const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<any>(null); const [description, setDescription] = useState('');
  useEffect(() => { if (scope?.location.id) void listFoodTableBoard(scope.location.id).then(setTables); }, [scope?.location.id]);
  if (!hasPermission('food.tables.manage')) return <Card><CardContent className="p-6">Acesso restrito ao administrador.</CardContent></Card>;
  const prepare = async (table: any) => { const token = await getFoodTableQrToken(table.id); const url = `${window.location.origin}/qrmenu/${token}`; const data = await QRCode.toDataURL(url, { width: 360, margin: 2 }); setQr((current) => ({ ...current, [table.id]: data })); };
  const openTable = async (table: any) => { setSelected(table); setDescription(table.name ?? ''); await prepare(table); };
  const saveDescription = async () => { if (!selected) return; await (supabase as any).from('food_tables').update({ name: description.trim() }).eq('id', selected.id); setTables((items) => items.map((item) => item.id === selected.id ? { ...item, name: description.trim() } : item)); setSelected((item: any) => ({ ...item, name: description.trim() })); };
  const createBulk = async () => { const count = Math.max(1, Math.min(100, Number(quantity))); if (!scope?.location.id) return; setCreating(true); for (let i=1;i<=count;i++) await createFoodTable({ location_id: scope.location.id, code: `MESA ${String((tables.length+i)).padStart(2,'0')}`, seats: 4 }); setTables(await listFoodTableBoard(scope.location.id)); setCreating(false); };
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold">Mesas e QR Codes</h2><p className="text-sm text-muted-foreground">Gerencie e imprima os QR Codes das mesas. Pedidos não são exibidos nesta área.</p></div><Card><CardHeader><CardTitle className="text-base">Adicionar mesas</CardTitle></CardHeader><CardContent className="flex gap-3"><input className="w-24 rounded border bg-background px-3" type="number" min="1" max="100" value={quantity} onChange={e=>setQuantity(e.target.value)} /><Button disabled={creating} onClick={() => void createBulk()}>Criar mesas</Button></CardContent></Card><div className="grid gap-4 md:grid-cols-3">{tables.map((table) => <Card key={table.id} className="cursor-pointer" onClick={() => void openTable(table)}><CardHeader><CardTitle>{table.code}</CardTitle><p className="text-sm text-muted-foreground">{table.name || 'Sem localização'}</p></CardHeader></Card>)}</div><Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.code}</DialogTitle></DialogHeader><div className="space-y-4"><Input placeholder="Ex.: Deck externo, salão principal" value={description} onChange={e=>setDescription(e.target.value)} onBlur={() => void saveDescription()} />{selected && qr[selected.id] && <img src={qr[selected.id]} alt="QR Code" className="mx-auto h-56 w-56" />}<div className="flex justify-center gap-2"><Button variant="outline" onClick={() => { const a=document.createElement('a'); a.href=qr[selected.id]; a.download=`${selected.code}-qr.png`; a.click(); }}><Download className="mr-1 h-4 w-4"/>Baixar</Button><Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4"/>Imprimir</Button></div></div></DialogContent></Dialog></div>;
}
