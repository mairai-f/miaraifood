import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json();
    const provider = String(payload.provider ?? payload.type ?? 'outro');
    const providerId = String(payload.provider_transaction_id ?? payload.payment_id ?? payload.id ?? '');
    const status = String(payload.status ?? payload.event ?? 'pending').toLowerCase();
    const mapped = status.includes('paid') || status.includes('approved') || status.includes('received') ? 'paid' : status.includes('fail') || status.includes('declin') ? 'failed' : status.includes('refund') ? 'refunded' : status.includes('cancel') ? 'cancelled' : 'pending';
    if (!providerId) throw new Error('provider_transaction_id ausente');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: tx } = await db.from('store_payment_transactions').select('id').eq('provider_transaction_id', providerId).maybeSingle();
    if (!tx) return new Response(JSON.stringify({ ok: true, ignored: true, provider }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const { error } = await db.rpc('update_store_payment_transaction_status', { p_transaction_id: tx.id, p_status: mapped, p_provider_transaction_id: providerId, p_payload: payload });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, status: mapped }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'webhook inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
