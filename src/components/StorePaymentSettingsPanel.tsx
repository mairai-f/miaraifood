import { useEffect, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type Provider = 'pix_manual' | 'mercado_pago' | 'asaas';
type Row = { id?: string; provider: Provider; display_name: string; environment: 'sandbox' | 'production'; enabled: boolean; public_config: Record<string, string>; secret_config: Record<string, string> };

const defaults: Row[] = [
  { provider: 'pix_manual', display_name: 'Pix do estabelecimento', environment: 'production', enabled: false, public_config: { pix_key: '' }, secret_config: { access_token: '' } },
  { provider: 'mercado_pago', display_name: 'Mercado Pago', environment: 'production', enabled: false, public_config: { public_key: '' }, secret_config: { access_token: '' } },
  { provider: 'asaas', display_name: 'Asaas do estabelecimento', environment: 'production', enabled: false, public_config: {}, secret_config: { api_key: '' } },
];

export function StorePaymentSettingsPanel() {
  const [rows, setRows] = useState<Row[]>(defaults);
  const [storeId, setStoreId] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const db = supabase as any;
    const { data: store } = await db.from('store_accounts').select('id').eq('owner_user_id', user.id).limit(1).maybeSingle();
    if (!store) return;
    setStoreId(store.id);
    const { data } = await db.from('store_payment_providers_safe').select('*').eq('store_account_id', store.id);
    setRows(defaults.map((base) => ({ ...base, ...(data?.find((item) => item.provider === base.provider) ?? {}) })));
  })(); }, []);

  const update = (provider: Provider, patch: Partial<Row>) => setRows((current) => current.map((row) => row.provider === provider ? { ...row, ...patch } : row));
  const save = async (row: Row) => {
    if (!storeId) return;
    setSaving(true);
    const { error } = await supabase.functions.invoke('manage-payment-provider', { body: { store_account_id: storeId, provider: row.provider, display_name: row.display_name, environment: row.environment, enabled: row.enabled, public_config: row.public_config, secret_config: row.secret_config } });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`${row.display_name} salvo.`);
  };

  return <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Formas de pagamento do estabelecimento</CardTitle><p className="text-sm text-muted-foreground">As chaves secretas são enviadas diretamente ao backend e nunca retornam para o navegador.</p></CardHeader><CardContent className="grid gap-4 md:grid-cols-3">{rows.map((row) => <div key={row.provider} className="space-y-3 rounded-lg border p-4"><div className="flex items-center justify-between"><Label className="font-semibold">{row.display_name}</Label><Switch checked={row.enabled} onCheckedChange={(enabled) => update(row.provider, { enabled })} /></div>{row.provider === 'pix_manual' && <><Label>Chave Pix</Label><Input value={row.public_config.pix_key ?? ''} onChange={(e) => update(row.provider, { public_config: { ...row.public_config, pix_key: e.target.value } })} placeholder="CPF, CNPJ, e-mail ou chave aleatória" /></>}{row.provider === 'mercado_pago' && <><Label>Public Key</Label><Input value={row.public_config.public_key ?? ''} onChange={(e) => update(row.provider, { public_config: { ...row.public_config, public_key: e.target.value } })} /></>} {row.provider !== 'pix_manual' && <><Label>Chave secreta</Label><Input type="password" value={Object.values(row.secret_config)[0] ?? ''} onChange={(e) => update(row.provider, { secret_config: { [row.provider === 'asaas' ? 'api_key' : 'access_token']: e.target.value } })} /></>}<Button className="w-full" disabled={saving || !storeId} onClick={() => void save(row)}><Save className="mr-2 h-4 w-4" />Salvar</Button></div>)}</CardContent></Card>;
}
