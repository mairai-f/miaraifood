import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit } from '../_shared/rateLimit.ts';

// Conteúdo público da tela de TV. Autoriza pelo código da TV (sem login) e
// devolve só o que o cliente já vê no salão: promoções ativas e os produtos
// escolhidos para aquela TV.
//
// Custo baixo por desenho: uma consulta ao banco por atualização (a TV pede a
// cada 5 minutos) e, se a versão não mudou, a resposta volta quase vazia.
const CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;
const CORS_OPTIONS = { allowedMethods: ['POST', 'OPTIONS'] };

const reply = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, CORS_OPTIONS).headers),
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleCorsPreflight(request, CORS_OPTIONS);
  if (request.method !== 'POST') return reply(request, { error: 'Método não suportado.' }, 405);
  if (!buildCorsHeaders(request, CORS_OPTIONS).allowed) return reply(request, { error: 'Origem não permitida.' }, 403);

  // Freia quem tentar adivinhar códigos: uma TV normal faz 1 pedido a cada 5 minutos.
  const rateLimit = await checkRedisRateLimit(request, { namespace: 'tv-display', limit: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return reply(request, { error: 'Muitas tentativas. Aguarde um minuto.' }, 429);

  let body: { code?: unknown; version?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(request, { error: 'Requisição inválida.' }, 400);
  }

  const code = typeof body.code === 'string' ? body.code.toUpperCase().replace(/[^0-9A-Z]/g, '') : '';
  if (!CODE_PATTERN.test(code)) return reply(request, { error: 'Código de TV inválido.' }, 400);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  const { data, error } = await db.rpc('get_tv_screen_payload', { p_code: code });
  if (error) {
    console.error('[tv-display] falha ao montar o conteúdo:', error.message);
    return reply(request, { error: 'Conteúdo indisponível no momento.' }, 500);
  }
  if (!data) return reply(request, { error: 'TV não encontrada ou desativada.' }, 404);

  const payload = data as Record<string, unknown> & { version?: string };
  if (typeof body.version === 'string' && body.version === payload.version) {
    return reply(request, { unchanged: true, version: payload.version });
  }
  return reply(request, payload);
});
