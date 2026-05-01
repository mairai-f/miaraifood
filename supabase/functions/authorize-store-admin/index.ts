import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

interface ApprovalRequest {
  adminEmail?: string;
  adminPassword?: string;
  requiredFeature?: string;
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
    return jsonResponse(request, { error: 'Metodo nao suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuracao de autenticacao invalida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
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
    return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id, email, username')
    .eq('user_id', user.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse(request, { error: 'Perfil do usuario nao encontrado.' }, 403);
  }

  let body: ApprovalRequest | null = null;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Corpo da requisicao invalido.' }, 400);
  }

  const requiredFeature = body?.requiredFeature?.trim() ?? '';

  if (requiredFeature) {
    const { data: hasRequiredFeature, error: featureError } = await authClient.rpc('current_store_has_feature', {
      target_feature: requiredFeature,
    });

    if (featureError || !hasRequiredFeature) {
      return jsonResponse(request, { error: 'Seu plano atual nao libera esta operacao.' }, 403);
    }
  }

  const adminEmail = normalizeEmail(body?.adminEmail ?? '');
  const adminPassword = body?.adminPassword?.trim() ?? '';

  if (!adminEmail) {
    return jsonResponse(request, { error: 'Informe o login do administrador.' }, 400);
  }

  if (!adminPassword) {
    return jsonResponse(request, { error: 'Informe a senha do administrador.' }, 400);
  }

  const verificationClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: approvalSession, error: approvalError } = await verificationClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });

  if (approvalError || !approvalSession.user) {
    return jsonResponse(request, { error: 'Login ou senha do administrador invalidos.' }, 401);
  }

  const { data: approvalProfile, error: approvalProfileError } = await serviceClient
    .from('profiles')
    .select('user_id, role, owner_user_id, email, username')
    .eq('user_id', approvalSession.user.id)
    .single();

  if (approvalProfileError || !approvalProfile) {
    return jsonResponse(request, { error: 'Perfil do administrador nao encontrado.' }, 403);
  }

  if (approvalProfile.role !== 'admin') {
    return jsonResponse(request, { error: 'A conta informada nao possui acesso de administrador.' }, 403);
  }

  const callerOwnerUserId = callerProfile.owner_user_id ?? user.id;
  const approvalOwnerUserId = approvalProfile.owner_user_id ?? approvalSession.user.id;

  if (approvalOwnerUserId !== callerOwnerUserId) {
    return jsonResponse(request, { error: 'O administrador informado nao pertence a mesma loja.' }, 403);
  }

  return jsonResponse(request, {
    success: true,
    approvedBy: {
      email: approvalProfile.email ?? approvalSession.user.email ?? adminEmail,
      username: approvalProfile.username ?? null,
    },
  });
});
