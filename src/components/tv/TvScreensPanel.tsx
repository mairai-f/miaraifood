import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Loader2, MonitorUp, Plus, RefreshCw, Save, Trash2, Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { generateTvCode } from '@/features/tv/tvSlides';
import { TvContentButtons } from './TvContentButtons';

interface TvScreen {
  id: string;
  name: string;
  access_code: string;
  headline: string;
  footer_message: string;
  slide_seconds: number;
  show_prices: boolean;
  product_ids: string[];
  active: boolean;
  last_seen_at: string | null;
}

const SCREEN_COLUMNS = 'id,name,access_code,headline,footer_message,slide_seconds,show_prices,product_ids,active,last_seen_at';
// A TV marca presença no máximo a cada 10 minutos; 15 dá folga para a atualização de 5 em 5.
const ONLINE_WINDOW_MS = 15 * 60 * 1000;

// tv_screens ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tvScreensTable = () => (supabase as any).from('tv_screens');

// No app desktop a página roda em file://, então o link precisa apontar para o endereço público.
const publicAppOrigin = () =>
  window.location.protocol.startsWith('http') ? window.location.origin : 'https://app.miaraifood.com.br';

const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
const isOnline = (lastSeenAt: string | null) =>
  Boolean(lastSeenAt) && Date.now() - Date.parse(lastSeenAt as string) < ONLINE_WINDOW_MS;

export function TvScreensPanel() {
  const [screens, setScreens] = useState<TvScreen[]>([]);
  const [drafts, setDrafts] = useState<Record<string, TvScreen>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [screenPendingDeletion, setScreenPendingDeletion] = useState<TvScreen | null>(null);
  const canOpenOnDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI?.tv?.openWindow);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await tvScreensTable().select(SCREEN_COLUMNS).order('created_at', { ascending: true });
    setLoading(false);
    if (error) {
      toast.error('Não foi possível carregar as TVs.');
      return;
    }
    const rows = (data ?? []) as TvScreen[];
    setScreens(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, row])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchDraft = (id: string, changes: Partial<TvScreen>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));

  const createScreen = async () => {
    setCreating(true);
    const { error } = await tvScreensTable().insert({ name: `TV ${screens.length + 1}` });
    setCreating(false);
    if (error) {
      toast.error(error.message || 'Não foi possível criar a TV.');
      return;
    }
    toast.success('TV criada. Abra o link ou digite o código na TV.');
    await load();
  };

  const saveScreen = async (id: string, extra: Partial<TvScreen> = {}) => {
    const draft = { ...drafts[id], ...extra };
    setBusyId(id);
    const { error } = await tvScreensTable()
      .update({
        name: draft.name.trim().slice(0, 60) || 'TV',
        headline: draft.headline.trim().slice(0, 80),
        footer_message: draft.footer_message.trim().slice(0, 140),
        slide_seconds: Math.min(Math.max(Math.round(Number(draft.slide_seconds) || 10), 4), 60),
        show_prices: draft.show_prices,
        product_ids: draft.product_ids ?? [],
        active: draft.active,
        ...(extra.access_code ? { access_code: extra.access_code } : {}),
      })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error(error.message || 'Não foi possível salvar a TV.');
      return;
    }
    toast.success(extra.access_code ? 'Código trocado. A TV antiga para de exibir.' : 'TV salva. A tela atualiza em até 5 minutos.');
    await load();
  };

  const changeCode = async (screen: TvScreen) => {
    if (!window.confirm(`Trocar o código de "${screen.name}"? Quem estiver com o código atual deixa de ver as promoções.`)) return;
    await saveScreen(screen.id, { access_code: generateTvCode() });
  };

  const removeScreen = async (screen: TvScreen) => {
    setBusyId(screen.id);
    const { error } = await tvScreensTable().delete().eq('id', screen.id);
    setBusyId(null);
    if (error) {
      toast.error('Não foi possível excluir a TV.');
      return;
    }
    await load();
  };

  const confirmRemoveScreen = async () => {
    if (!screenPendingDeletion) return;
    const screen = screenPendingDeletion;
    setScreenPendingDeletion(null);
    await removeScreen(screen);
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${publicAppOrigin()}/tv/${code}`);
      toast.success('Link copiado.');
    } catch {
      toast.error('Não foi possível copiar. Selecione o link e copie manualmente.');
    }
  };

  const openOnDesktop = async (code: string) => {
    const result = await window.electronAPI?.tv?.openWindow(code);
    if (!result?.success) {
      toast.error(result?.error || 'Não foi possível abrir a tela da TV.');
      return;
    }
    toast.success(result.externalDisplay
      ? 'Promoções abertas na TV. Pressione Esc na TV para fechar.'
      : 'Nenhuma segunda tela encontrada: abriu neste monitor. Pressione Esc para fechar.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tv className="h-4 w-4 text-emerald-500" /> Promoções na TV
        </CardTitle>
        <CardDescription className="space-y-1">
          <span className="block">
            A TV mostra as promoções ativas e os produtos escolhidos para aquela tela.
          </span>
          <span className="block">
            Para ligar: abra <strong>{publicAppOrigin().replace(/^https?:\/\//, '')}/tv</strong> no navegador da Smart TV
            ou TV box e digite o código, ou ligue a TV no computador por HDMI e use "Abrir na TV" no app desktop.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando TVs...
          </p>
        ) : screens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma TV cadastrada ainda.</p>
        ) : (
          screens.map((screen) => {
            const draft = drafts[screen.id] ?? screen;
            const busy = busyId === screen.id;
            return (
              <div key={screen.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    value={draft.name}
                    maxLength={60}
                    onChange={(event) => patchDraft(screen.id, { name: event.target.value })}
                    className="h-9 max-w-xs font-semibold"
                  />
                  <Badge variant={isOnline(screen.last_seen_at) && screen.active ? 'default' : 'secondary'}>
                    {!screen.active ? 'Desativada' : isOnline(screen.last_seen_at) ? 'Exibindo agora' : 'Sem sinal'}
                  </Badge>
                  <span className="ml-auto font-mono text-2xl font-black tracking-widest">{formatCode(screen.access_code)}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <TvContentButtons screenId={screen.id} productIds={screen.product_ids ?? []} onSaved={load} />
                  <Button size="sm" variant="outline" onClick={() => void copyLink(screen.access_code)}>
                    <Copy className="h-4 w-4" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`${publicAppOrigin()}/tv/${screen.access_code}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Pré-visualizar
                    </a>
                  </Button>
                  {canOpenOnDesktop && (
                    <Button size="sm" onClick={() => void openOnDesktop(screen.access_code)}>
                      <MonitorUp className="h-4 w-4" /> Abrir na TV
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void changeCode(screen)}>
                    <RefreshCw className="h-4 w-4" /> Trocar código
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => setScreenPendingDeletion(screen)}>
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Chamada no topo
                    <Input
                      value={draft.headline}
                      maxLength={80}
                      placeholder="Ex.: Happy hour até as 20h"
                      onChange={(event) => patchDraft(screen.id, { headline: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Faixa no rodapé
                    <Input
                      value={draft.footer_message}
                      maxLength={140}
                      placeholder="Ex.: Peça pelo QR Code da mesa"
                      onChange={(event) => patchDraft(screen.id, { footer_message: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-xs text-muted-foreground">
                    Segundos por slide (4 a 60)
                    <Input
                      type="number"
                      min={4}
                      max={60}
                      value={draft.slide_seconds}
                      onChange={(event) => patchDraft(screen.id, { slide_seconds: Number(event.target.value) })}
                    />
                  </label>
                  <div className="flex flex-col justify-end gap-2 text-sm">
                    <label className="flex items-center justify-between gap-2">
                      Mostrar preços
                      <Switch checked={draft.show_prices} onCheckedChange={(checked) => patchDraft(screen.id, { show_prices: checked })} />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      TV ativa
                      <Switch checked={draft.active} onCheckedChange={(checked) => patchDraft(screen.id, { active: checked })} />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" disabled={busy} onClick={() => void saveScreen(screen.id)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <Button variant="outline" disabled={creating || loading} onClick={() => void createScreen()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar TV
        </Button>

        <AlertDialog open={Boolean(screenPendingDeletion)} onOpenChange={(open) => { if (!open) setScreenPendingDeletion(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta TV?</AlertDialogTitle>
              <AlertDialogDescription>
                A tela “{screenPendingDeletion?.name}” será removida e o código atual deixará de funcionar. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void confirmRemoveScreen()}>
                Excluir TV
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
