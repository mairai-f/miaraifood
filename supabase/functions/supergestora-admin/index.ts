import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

async function audit(service: ReturnType<typeof createClient>, actor: string, action: string, resourceType: string, resourceId: string, afterState: unknown) {
  await service.from('platform_admin_audit').insert({ actor_user_id: actor, action, resource_type: resourceType, resource_id: resourceId, after_state: afterState ?? {} });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não suportado.' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!url || !anon || !serviceKey || !token) return json({ error: 'Sessão inválida.' }, 401);
  const auth = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await auth.auth.getUser(token);
  if (!user) return json({ error: 'Sessão inválida.' }, 401);
  const { data: profile } = await service.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
  const role = String(profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? '');
  if (!['admin', 'supergestora', 'platform_admin'].includes(role)) return json({ error: 'Acesso restrito à Supergestora.' }, 403);
  const { action, payload = {} } = await request.json().catch(() => ({}));
  try {
    if (action === 'companies.list') {
      const { data: accounts, error } = await service.from('store_accounts').select('id,nome_estabelecimento,nome_cliente,email,created_at,store_subscriptions(plan_id,status,trial_ends_at,current_period_ends_at)').order('created_at', { ascending: false }); if (error) throw error;
      const ids = (accounts ?? []).map((x: any) => x.id);
      const { data: controls } = ids.length ? await service.from('platform_company_controls').select('*').in('store_account_id', ids) : { data: [] };
      const controlById = new Map((controls ?? []).map((x: any) => [x.store_account_id, x]));
      return json((accounts ?? []).map((account: any) => { const subscription = Array.isArray(account.store_subscriptions) ? account.store_subscriptions[0] : account.store_subscriptions; const control: any = controlById.get(account.id); return { id: account.id, name: account.nome_estabelecimento, ownerName: account.nome_cliente, email: account.email, createdAt: account.created_at, plan: subscription?.plan_id ?? null, subscriptionStatus: subscription?.status ?? null, trialEndsAt: subscription?.trial_ends_at ?? null, active: !control?.is_suspended && !control?.deleted_at && ['trialing','active'].includes(subscription?.status), suspended: Boolean(control?.is_suspended), deletedAt: control?.deleted_at ?? null }; }));
    }
    if (action === 'representatives.list') {
      const { data, error } = await service.from('platform_representatives').select('*').order('created_at', { ascending: false }); if (error) throw error;
      return json(data ?? []);
    }
    if (action === 'representatives.create') {
      const row = { name: String(payload.name ?? '').trim(), email: String(payload.email ?? '').trim().toLowerCase(), cities: String(payload.cities ?? ''), revenue: Number(payload.revenue ?? 0), managers: Number(payload.managers ?? 0), created_by: user.id };
      if (!row.name || !row.email) return json({ error: 'Nome e e-mail são obrigatórios.' }, 400);
      const { data, error } = await service.from('platform_representatives').insert(row).select().single(); if (error) throw error;
      await audit(service, user.id, 'create', 'representative', data.id, data); return json(data, 201);
    }
    if (action === 'representatives.delete') {
      const { error } = await service.from('platform_representatives').delete().eq('id', payload.id); if (error) throw error;
      await audit(service, user.id, 'delete', 'representative', String(payload.id), {}); return json({ ok: true });
    }
    if (action === 'activation.list') {
      const { data, error } = await service.from('platform_activation_codes').select('*').order('created_at', { ascending: false }); if (error) throw error;
      return json(data ?? []);
    }
    if (action === 'activation.create') {
      const code = `MIAR-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
      const row = { code, establishment_name: String(payload.establishmentName || 'Estabelecimento'), person_name: String(payload.personName || 'Pessoa'), person_email: String(payload.email || '').trim().toLowerCase(), created_by: user.id };
      if (!row.person_email) return json({ error: 'Informe o e-mail do destinatário.' }, 400);
      const { data, error } = await service.from('platform_activation_codes').insert(row).select().single(); if (error) throw error;
      await audit(service, user.id, 'create', 'activation_code', data.id, data); return json(data, 201);
    }
    if (action === 'activation.mark_sent') {
      const { data, error } = await service.from('platform_activation_codes').update({ sent_at: new Date().toISOString() }).eq('id', payload.id).select().single(); if (error) throw error;
      await audit(service, user.id, 'mark_sent', 'activation_code', data.id, data); return json(data);
    }
    if (action === 'ban.list') { const { data, error } = await service.from('platform_banned_emails').select('*').order('banned_at', { ascending: false }); if (error) throw error; return json(data ?? []); }
    if (action === 'ban.create') {
      const row = { email: String(payload.email ?? '').trim().toLowerCase(), reason: String(payload.reason ?? ''), banned_by: user.id }; if (!row.email) return json({ error: 'Informe um e-mail.' }, 400);
      const { data, error } = await service.from('platform_banned_emails').upsert(row).select().single(); if (error) throw error;
      await audit(service, user.id, 'ban', 'email', row.email, data); return json(data);
    }
    if (action === 'ban.delete') { const { error } = await service.from('platform_banned_emails').delete().eq('email', payload.email); if (error) throw error; await audit(service, user.id, 'unban', 'email', String(payload.email), {}); return json({ ok: true }); }
    if (action === 'audit.list') { const { data, error } = await service.from('platform_admin_audit').select('*').order('created_at', { ascending: false }).limit(100); if (error) throw error; return json(data ?? []); }
    if (action === 'company.control') {
      const id = String(payload.id ?? ''); const state = String(payload.state ?? ''); const reason = String(payload.reason ?? '');
      if (!id || !['suspend', 'reactivate', 'delete'].includes(state)) return json({ error: 'Ação de empresa inválida.' }, 400);
      const control = state === 'suspend' ? { store_account_id: id, is_suspended: true, suspended_reason: reason, suspended_at: new Date().toISOString(), deleted_at: null, deleted_reason: null, updated_by: user.id, updated_at: new Date().toISOString() } : state === 'reactivate' ? { store_account_id: id, is_suspended: false, suspended_reason: null, suspended_at: null, deleted_at: null, deleted_reason: null, updated_by: user.id, updated_at: new Date().toISOString() } : { store_account_id: id, is_suspended: true, suspended_reason: reason, suspended_at: new Date().toISOString(), deleted_at: new Date().toISOString(), deleted_reason: reason, updated_by: user.id, updated_at: new Date().toISOString() };
      const { data, error } = await service.from('platform_company_controls').upsert(control).select().single(); if (error) throw error;
      await audit(service, user.id, state, 'store_account', id, data); return json(data);
    }
    if (action === 'company.detail') {
      const id = String(payload.id ?? '');
      const { data: account, error: accountError } = await service.from('store_accounts').select('*,store_subscriptions(plan_id,status,trial_ends_at,provider_subscription_id)').eq('id', id).single(); if (accountError) throw accountError;
      const { data: control } = await service.from('platform_company_controls').select('*').eq('store_account_id', id).maybeSingle();
      const { data: profiles } = await service.from('profiles').select('user_id,username,email,phone,role,created_at').or(`user_id.eq.${account.owner_user_id},owner_user_id.eq.${account.owner_user_id}`);
      const { data: promotions } = await service.from('product_promotions').select('*').eq('owner_user_id', account.owner_user_id).order('created_at', { ascending: false });
      const subscription = Array.isArray(account.store_subscriptions) ? account.store_subscriptions[0] : account.store_subscriptions;
      return json({ detail: { id: account.id, name: account.nome_estabelecimento, owner_name: account.nome_cliente, email: account.email, phone: account.telefone, address: account.endereco, cnpj: account.cnpj, active: !control?.is_suspended && ['trialing','active'].includes(subscription?.status), deleted_at: control?.deleted_at ?? null, suspended_reason: control?.suspended_reason ?? null, plan: subscription?.plan_id ?? null, trial_ends_at: subscription?.trial_ends_at ?? null, asaas_subscription_id: subscription?.provider_subscription_id ?? null, employeeCount: Math.max(0, (profiles ?? []).length - 1), segmento: account.tipo_estabelecimento }, owners: (profiles ?? []).filter((p: any) => p.user_id === account.owner_user_id).map((p: any) => ({ id: p.user_id, name: p.username || account.nome_cliente, email: p.email || account.email, phone: p.phone, blocked: false, created_at: p.created_at })), employees: (profiles ?? []).filter((p: any) => p.user_id !== account.owner_user_id).map((p: any) => ({ id: p.user_id, employee_id: p.user_id, role: p.role, active: true, created_at: p.created_at, name: p.username, phone: p.phone })), promotions: (promotions ?? []).map((p: any) => ({ id: p.id, title: p.title, headline: p.product_name, targetSegment: p.discount_type, generatedAt: p.created_at })) });
    }
    if (action === 'company.update') {
      const id = String(payload.id ?? ''); const changes = payload.changes ?? {};
      const update = { nome_estabelecimento: changes.name, nome_cliente: changes.ownerName, telefone: changes.phone, endereco: changes.address, cnpj: changes.cnpj, tipo_estabelecimento: changes.segmento };
      const { data, error } = await service.from('store_accounts').update(update).eq('id', id).select().single(); if (error) throw error;
      await audit(service, user.id, 'update', 'store_account', id, update); return json(data);
    }
    if (action === 'company.owner_block') {
      const id = String(payload.ownerId ?? ''); const { error } = await service.auth.admin.updateUserById(id, { ban_duration: payload.blocked ? '876000h' : 'none' }); if (error) throw error;
      await audit(service, user.id, payload.blocked ? 'block' : 'unblock', 'auth_user', id, {}); return json({ ok: true });
    }
    if (action === 'promotion.delete') { const { error } = await service.from('product_promotions').delete().eq('id', payload.id); if (error) throw error; await audit(service, user.id, 'delete', 'promotion', String(payload.id), {}); return json({ ok: true }); }
    return json({ error: 'Ação desconhecida.' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Falha administrativa.' }, 400); }
});
