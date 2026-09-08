import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';

interface ApprovalRequest {
  adminEmail?: string;
  adminPassword?: string;
}

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ['POST', 'OPTIONS'],
      }).headers.entries()),
      'Content-Type': 'application/json',
    },
  });

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Método não suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuração de autenticação inválida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: 'authorize-pricing-manager',
    limit: readRateLimitEnv('AUTHORIZE_PRICING_MANAGER_RATE_LIMIT_PER_MINUTE', 30),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: 'Muitas validacoes de gerente em pouco tempo. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse(request, { error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id, email')
    .eq('user_id', user.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse(request, { error: 'Perfil do usuário não encontrado.' }, 403);
  }

  if (callerProfile.role !== 'admin') {
    return jsonResponse(request, { error: 'Somente administradores podem solicitar aprovação de precificação.' }, 403);
  }

  const { data: hasPricingAccess, error: pricingAccessError } = await authClient.rpc('current_store_has_feature', {
    target_feature: 'pricing.manage',
  });

  if (pricingAccessError || !hasPricingAccess) {
    return jsonResponse(request, { error: 'Seu plano atual não libera o módulo de precificação.' }, 403);
  }

  let body: ApprovalRequest | null = null;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Corpo da requisição inválido.' }, 400);
  }

  const adminEmail = normalizeEmail(body?.adminEmail ?? '');
  const adminPassword = body?.adminPassword?.trim() ?? '';

  if (!adminEmail) {
    return jsonResponse(request, { error: 'Informe o login do gerente.' }, 400);
  }

  if (!adminPassword) {
    return jsonResponse(request, { error: 'Informe a senha do gerente.' }, 400);
  }

  const { data: approvalSession, error: approvalError } = await createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }).auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (approvalError) {
    const approvalMessage = approvalError.message?.toLowerCase() ?? '';
    if (approvalMessage.includes('captcha')) {
      return jsonResponse(
        request,
        { error: 'O login por senha do gerente foi bloqueado pelo CAPTCHA do Supabase. Desative o CAPTCHA ou envie o token no frontend.' },
        503,
      );
    }

    return jsonResponse(
      request,
      { error: 'Login ou senha do gerente inválidos. Use a senha cadastrada na conta do HappyCash.' },
      401,
    );
  }

  if (!approvalSession.user) {
    return jsonResponse(
      request,
      { error: 'Login ou senha do gerente inválidos. Use a senha cadastrada na conta do HappyCash.' },
      401,
    );
  }

  const { data: approvalProfile, error: approvalProfileError } = await serviceClient
    .from('profiles')
    .select('user_id, role, owner_user_id, email, username')
    .eq('user_id', approvalSession.user.id)
    .single();

  if (approvalProfileError || !approvalProfile) {
    return jsonResponse(request, { error: 'Perfil do gerente não encontrado.' }, 403);
  }

  if (approvalProfile.role !== 'admin') {
    return jsonResponse(request, { error: 'A conta informada não possui acesso de gerente/administrador.' }, 403);
  }

  if ((approvalProfile.owner_user_id ?? approvalSession.user.id) !== (callerProfile.owner_user_id ?? user.id)) {
    return jsonResponse(request, { error: 'O gerente informado não pertence à mesma loja.' }, 403);
  }

  return jsonResponse(request, {
    success: true,
    approvedBy: {
      email: approvalProfile.email ?? approvalSession.user.email ?? adminEmail,
      username: approvalProfile.username ?? null,
    },
  });
});
