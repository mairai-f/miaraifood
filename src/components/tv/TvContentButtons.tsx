import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { TvPayload } from '@/features/tv/tvSlides';

// As tabelas de TV ainda não fazem parte dos tipos gerados.
const db = supabase as any;
type Art = NonNullable<TvPayload['artworks']>[number];
const empty = { title: '', image_url: '', format: 'tv', starts_at: null, ends_at: null, seconds: 10, sort_order: 0, active: true };
const localDate = (value: string | null) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0,16) : '';

export function TvContentButtons({ screenId, productIds, onSaved }: { screenId: string; productIds: string[]; onSaved: () => Promise<void> }) {
  const { ownerUserId } = useAuth();
  const [mode, setMode] = useState<'arts' | 'products' | null>(null);
  const [arts, setArts] = useState<Art[]>([]);
  const [products, setProducts] = useState<{id: string; name: string}[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Omit<Art,'id'> & { id?: string }>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const open = async (next: 'arts' | 'products') => {
    setBusy(true);
    try {
      const result = next === 'arts'
        ? await db.from('tv_artworks').select('*').eq('screen_id',screenId).order('sort_order')
        : await db.from('products').select('id,name').eq('user_id',ownerUserId).eq('deleted',false).order('name');
      if (result.error) throw result.error;
      if (next === 'arts') setArts(result.data); else { setProducts(result.data); setSelected(productIds); }
      setMode(next);
    } catch { toast.error('Não foi possível carregar o conteúdo. Tente novamente.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'products') {
        const {error} = await db.from('tv_screens').update({product_ids: selected}).eq('id',screenId);
        if (error) throw error;
        await onSaved(); setMode(null);
      } else {
        if (!draft.title.trim() || (!file && !draft.image_url)) throw new Error('Informe o título e a imagem.');
        if (draft.starts_at && draft.ends_at && Date.parse(draft.ends_at) <= Date.parse(draft.starts_at)) throw new Error('O fim deve ser posterior ao início.');
        let url = draft.image_url;
        if (file) {
          if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Use PNG, JPEG ou WebP de até 10 MB.');
          const path = `${ownerUserId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
          const {error} = await supabase.storage.from('tv-artworks').upload(path,file);
          if (error) throw error;
          url = supabase.storage.from('tv-artworks').getPublicUrl(path).data.publicUrl;
        }
        const {id, ...fields} = draft;
        const row = {...fields, title: draft.title.trim(), image_url: url, screen_id: screenId};
        const {error} = id ? await db.from('tv_artworks').update(row).eq('id',id) : await db.from('tv_artworks').insert(row);
        if (error) throw error;
        setDraft(empty); setFile(null); await open('arts');
      }
      toast.success('Conteúdo salvo. A TV atualiza em até 5 minutos.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void open('arts')}>Artes promocionais</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void open('products')}>Escolher produtos</Button>
    <Dialog open={!!mode} onOpenChange={value => { if (!value && !busy) setMode(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{mode === 'arts' ? 'Artes promocionais' : 'Produtos desta TV'}</DialogTitle><DialogDescription>{mode === 'arts' ? 'TV e painel entram na programação. Stories e impressão ficam disponíveis para abrir e baixar a arte. A imagem é exibida inteira, sem cortes.' : 'Selecione até 30 produtos. A ordem de seleção define a sequência.'}</DialogDescription></DialogHeader>
        {mode === 'products' ? <>
          <Input aria-label="Buscar produto" placeholder="Buscar produto" value={search} onChange={e => setSearch(e.target.value)} />
          <p>{selected.length}/30 selecionados</p>
          <div className="max-h-80 overflow-auto space-y-2">{products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <label key={p.id} className="flex gap-2"><input type="checkbox" checked={selected.includes(p.id)} disabled={!selected.includes(p.id) && selected.length >= 30} onChange={e => setSelected(s => e.target.checked ? [...s,p.id] : s.filter(id => id !== p.id))} />{p.name}</label>)}</div>
        </> : <>
          <Button variant="outline" onClick={() => {setDraft(empty);setFile(null);}}>Nova arte</Button>
          {arts.map(a => <div key={a.id} className="flex items-center gap-3 rounded border p-2"><img src={a.image_url} alt={a.title} className="h-16 w-24 object-contain" /><span className="flex-1">{a.title} · {a.format} · {a.active ? 'Ativa' : 'Inativa'}</span><Button variant="outline" onClick={() => {setDraft(a);setFile(null);}}>Editar</Button><a href={a.image_url} target="_blank" rel="noreferrer" className="underline">Abrir / baixar</a></div>)}
          <label>Título<Input maxLength={120} value={draft.title} onChange={e => setDraft({...draft,title:e.target.value})} /></label>
          <label>Imagem (até 10 MB)<Input key={draft.id ?? arts.length} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
          <label>Formato<select className="block w-full rounded border bg-background p-2" value={draft.format} onChange={e => setDraft({...draft,format:e.target.value})}><option value="tv">TV horizontal (16:9)</option><option value="panel">Painel vertical (9:16)</option><option value="stories">Stories (9:16)</option><option value="print">Impressão (arte pronta)</option></select></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Início (horário local)<Input type="datetime-local" value={localDate(draft.starts_at)} onChange={e => setDraft({...draft,starts_at:e.target.value ? new Date(e.target.value).toISOString() : null})} /></label>
            <label>Fim (horário local)<Input type="datetime-local" value={localDate(draft.ends_at)} onChange={e => setDraft({...draft,ends_at:e.target.value ? new Date(e.target.value).toISOString() : null})} /></label>
            <label>Segundos por slide<Input type="number" min={4} max={60} value={draft.seconds} onChange={e => setDraft({...draft,seconds:Math.max(4,Math.min(60,Number(e.target.value)))})} /></label>
            <label>Ordem<Input type="number" value={draft.sort_order} onChange={e => setDraft({...draft,sort_order:Math.trunc(Number(e.target.value))})} /></label>
          </div>
          <label className="flex gap-2"><input type="checkbox" checked={draft.active} onChange={e => setDraft({...draft,active:e.target.checked})} />Ativa</label>
        </>}
        <Button disabled={busy} onClick={() => void save()}>{busy ? 'Salvando...' : 'Salvar'}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
