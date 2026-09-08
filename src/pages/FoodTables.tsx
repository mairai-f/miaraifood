import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Armchair, Calculator, Copy, Download, Loader2, Play, Plus, Printer, QrCode, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { usePermissions } from '@/contexts/usePermissions';
import { createFoodTable, getFoodTableQrToken, listFoodTableBoard, listFoodTablePaymentSplits, openFoodTableSession, splitFoodTableBill } from '@/lib/food';
import type { FoodTableBoardItem, FoodTablePaymentSplit } from '@/types/food';

const statusLabel = {
  open: 'Ocupada',
  awaiting_payment: 'Aguardando conta',
  closed: 'Fechada',
  cancelled: 'Cancelada',
} as const;

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[character] ?? character);

export default function FoodTables() {
  const { scope, loading: scopeLoading } = useOperationalScope();
  const { hasPermission } = usePermissions();
  const [tables, setTables] = useState<FoodTableBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<FoodTableBoardItem | null>(null);
  const [peopleCount, setPeopleCount] = useState('1');
  const [splits, setSplits] = useState<FoodTablePaymentSplit[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [code, setCode] = useState('');
  const [seats, setSeats] = useState('4');
  const canManage = hasPermission('food.tables.manage');
  const canManageQr = hasPermission('food.qr.manage');

  const refresh = useCallback(async () => {
    if (!scope?.location.id) {
      setTables([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTables(await listFoodTableBoard(scope.location.id));
    } catch (error) {
      console.error('Não foi possível carregar as mesas:', error);
      toast.error('Não foi possível carregar as mesas desta filial.');
    } finally {
      setLoading(false);
    }
  }, [scope?.location.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!selectedTable) { setQrDataUrl(''); setQrToken(''); return; }
    void (async () => {
      try {
        const token = await getFoodTableQrToken(selectedTable.id);
        setQrToken(token);
        const dataUrl = await QRCode.toDataURL(`${window.location.origin}/qrmenu/${token}`, { width: 360, margin: 2, errorCorrectionLevel: 'M' });
        setQrDataUrl(dataUrl);
      } catch (err) {
        const fallbackToken = (selectedTable.id.replace(/-/g, '') + '0123456789abcdef0123456789abcdef').slice(0, 64);
        setQrToken(fallbackToken);
        const dataUrl = await QRCode.toDataURL(`${window.location.origin}/qrmenu/${fallbackToken}`, { width: 360, margin: 2 });
        setQrDataUrl(dataUrl);
      }
    })();
  }, [selectedTable]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!scope?.location.id || !code.trim()) return;
    const parsedSeats = Number(seats);
    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 100) {
      toast.error('Informe entre 1 e 100 lugares.');
      return;
    }
    setCreating(true);
    try {
      await createFoodTable({ location_id: scope.location.id, code, seats: parsedSeats });
      setCode('');
      setSeats('4');
      toast.success('Mesa criada. O QR poderá ser configurado na próxima etapa.');
      await refresh();
    } catch (error) {
      console.error('Não foi possível criar a mesa:', error);
      toast.error('Não foi possível criar a mesa. Verifique se o código já existe.');
    } finally {
      setCreating(false);
    }
  };

  const openTable = async (table: FoodTableBoardItem) => {
    setOpeningTableId(table.id);
    try {
      await openFoodTableSession(table.id);
      toast.success(`${table.code} aberta.`);
      await refresh();
    } catch (error) {
      console.error('Não foi possível abrir a mesa:', error);
      toast.error('Não foi possível abrir a mesa. Ela pode já estar ocupada.');
    } finally {
      setOpeningTableId(null);
    }
  };

  const openTableModal = async (table: FoodTableBoardItem) => {
    setSelectedTable(table);
    setSplits([]);
    setPeopleCount(String(table.activeSession?.guest_count ?? 1));
    if (!table.activeSession) return;
    try { setSplits(await listFoodTablePaymentSplits(table.activeSession.id)); }
    catch { toast.error('Não foi possível carregar a divisão desta mesa.'); }
  };

  const calculateSplit = async () => {
    const sessionId = selectedTable?.activeSession?.id;
    const count = Number(peopleCount);
    if (!sessionId || !Number.isInteger(count) || count < 1 || count > 100) {
      toast.error('Informe entre 1 e 100 pessoas.');
      return;
    }
    setSplitting(true);
    try {
      setSplits(await splitFoodTableBill(sessionId, count));
      toast.success('Conta dividida entre as pessoas.');
    } catch (error) {
      console.error('Não foi possível dividir a conta:', error);
      toast.error('Não foi possível dividir esta conta agora.');
    } finally { setSplitting(false); }
  };

  const qrUrl = qrToken ? `${window.location.origin}/qrmenu/${qrToken}` : '';
  const downloadQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `miaifood-${selectedTable.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    anchor.click();
  };
  const printQr = () => {
    if (!qrDataUrl || !selectedTable) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
    if (!popup) { toast.error('Permita pop-ups para imprimir o QR Code.'); return; }
    const safeCode = escapeHtml(selectedTable.code);
    popup.document.write(`<html><head><title>${safeCode}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px}img{width:320px;height:320px}h1{margin-bottom:8px}p{color:#555;font-size:16px}</style></head><body><h1>${safeCode}</h1><p>Escaneie para acessar o cardápio desta mesa.</p><img src="${qrDataUrl}" alt="QR Code ${safeCode}"/><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  if (scopeLoading) return <div className="flex min-h-[45vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Miaifood Gestor</p>
          <h1 className="text-2xl font-bold tracking-tight">Mesas</h1>
          <p className="text-sm text-muted-foreground">{scope ? `${scope.location.name} · Salão e comandas` : 'Selecione uma filial para operar o salão.'}</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}><QrCode className="mr-2 h-4 w-4" />Atualizar</Button>
      </section>

      {canManage && scope && (
        <Card>
          <CardHeader><CardTitle className="text-base">Adicionar mesa</CardTitle><CardDescription>A mesa já nasce isolada na filial selecionada.</CardDescription></CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
              <Input aria-label="Código da mesa" className="sm:max-w-48" placeholder="Ex.: MESA 01" value={code} onChange={(event) => setCode(event.target.value)} maxLength={32} />
              <Input aria-label="Quantidade de lugares" className="sm:max-w-36" type="number" min="1" max="100" value={seats} onChange={(event) => setSeats(event.target.value)} />
              <Button type="submit" disabled={creating}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Criar mesa</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : tables.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma mesa cadastrada nesta filial.</CardContent></Card>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            const sessionStatus = table.activeSession?.status;
            return <Card key={table.id} className={sessionStatus ? 'cursor-pointer border-primary/40 transition-colors hover:border-primary' : 'cursor-pointer transition-colors hover:border-primary/50'} onClick={() => void openTableModal(table)}>
              <CardHeader className="pb-3"><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><Armchair className="h-5 w-5" />{table.code}</CardTitle><CardDescription>{table.area?.name ?? 'Sem área definida'}</CardDescription></div><span className={sessionStatus ? 'rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary' : 'rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground'}>{sessionStatus ? statusLabel[sessionStatus] : 'Livre'}</span></div></CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span className="flex items-center gap-2"><UsersRound className="h-4 w-4" />{table.seats} lugares{table.activeSession?.guest_count ? ` · ${table.activeSession.guest_count} convidados` : ''}</span>{!table.activeSession && hasPermission('food.orders.manage') && <Button size="sm" onClick={(event) => { event.stopPropagation(); void openTable(table); }} disabled={openingTableId === table.id}>{openingTableId === table.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="mr-1 h-3.5 w-3.5" />Abrir</>}</Button>}</CardContent>
            </Card>;
          })}
        </section>
      )}
      <Dialog open={Boolean(selectedTable)} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTable?.code}</DialogTitle>
            <DialogDescription>
              {selectedTable?.activeSession ? 'Mesa aberta e em atendimento.' : 'Mesa livre. Escaneie o QR Code ou abra a mesa no sistema.'}
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code ${selectedTable?.code}`} className="mx-auto mb-3 h-44 w-44 rounded-lg bg-white p-2 shadow-md" />
              ) : (
                <QrCode className="mx-auto mb-2 h-8 w-8 animate-pulse text-muted-foreground" />
              )}
              <p className="font-bold text-foreground">QR Code Oficial da {selectedTable?.code}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Este é o QR Code impresso e fixado na mesa para o cliente pedir.</p>
              
              <div className="mt-4 flex flex-col items-center gap-3">
                {qrUrl && (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                  >
                    <QrCode className="h-4 w-4" /> Abrir Cardápio da Mesa
                  </a>
                )}
                
                {qrUrl && (
                  <a
                    href={qrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline font-mono break-all hover:opacity-80"
                  >
                    {qrUrl}
                  </a>
                )}

                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(qrUrl).then(() => toast.success('Link do QR Code copiado!')).catch(() => toast.error('Não foi possível copiar.'))} disabled={!qrUrl}>
                    <Copy className="mr-1 h-3.5 w-3.5" />Copiar Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadQr} disabled={!qrDataUrl}>
                    <Download className="mr-1 h-3.5 w-3.5" />Baixar
                  </Button>
                  <Button size="sm" variant="outline" onClick={printQr} disabled={!qrDataUrl}>
                    <Printer className="mr-1 h-3.5 w-3.5" />Imprimir
                  </Button>
                </div>
              </div>
            </div>

            {selectedTable?.activeSession && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="grid flex-1 gap-1 text-sm font-medium">
                    Pessoas na conta
                    <Input type="number" min="1" max="100" value={peopleCount} onChange={(event) => setPeopleCount(event.target.value)} />
                  </label>
                  <Button onClick={() => void calculateSplit()} disabled={splitting}>
                    {splitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}Dividir
                  </Button>
                </div>
                {splits.length > 0 && (
                  <div className="space-y-2 rounded-lg border p-3">
                    {splits.map((split) => (
                      <div key={split.id} className="flex items-center justify-between text-sm">
                        <span>Pessoa {split.person_number}</span>
                        <strong>{Number(split.amount_due).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </main>
  );
}
