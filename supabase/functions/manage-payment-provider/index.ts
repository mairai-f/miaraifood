import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = await req.json();
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: store } = await db.from('store_accounts').select('id').eq('id', body.store_account_id).eq('owner_user_id', user.id).maybeSingle();
    if (!store) return new Response(JSON.stringify({ error: 'Estabelecimento não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const secret = body.secret_config ?? {};
    const encryptionKey = Deno.env.get('PAYMENT_PROVIDER_ENCRYPTION_KEY');
    if (!encryptionKey) throw new Error('PAYMENT_PROVIDER_ENCRYPTION_KEY não configurada');
    const { data, error } = await userClient.rpc('upsert_store_payment_provider_secret', { p_store_account_id: store.id, p_provider: body.provider, p_display_name: body.display_name ?? '', p_environment: body.environment ?? 'production', p_enabled: body.enabled !== false, p_public_config: body.public_config ?? {}, p_secret_config: JSON.stringify(secret), p_encryption_key: encryptionKey });
    if (error) throw error;
    return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao salvar provedor' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
