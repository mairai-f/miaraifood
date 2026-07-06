import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

interface ApprovalRequest {
  adminEmail?: string;
  adminPassword?: string;
  requiredFeature?: string;
}

interface JWTPayload {
  sub: string;
  role?: string;
  exp?: number;
  iat?: number;
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

const decodeJWT = (token: string): JWTPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('invalid JWT format (not 3 parts)');
      return null;
    }

    // Decode base64url payload
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(padded);
    const parsed = JSON.parse(decoded) as JWTPayload;
    return parsed;
  } catch (err) {
    console.error('Failed to decode JWT:', (err as Error).message);
    return null;
  }
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

Deno.serve(async (request) => {
  try {
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
      console.error('Missing SUPABASE_* env vars');
      return jsonResponse(request, { error: 'Configuracao de autenticacao invalida.' }, 500);
    }

    if (!accessToken) {
      return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Decode JWT to get user_id (instead of using getUser which may fail)
    const jwtPayload = decodeJWT(accessToken);
    if (!jwtPayload?.sub) {
      console.error('Invalid JWT or missing sub claim');
      return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
    }

    const userId = jwtPayload.sub;

    const { data: callerProfile, error: callerProfileError } = await serviceClient
      .from('profiles')
      .select('role, owner_user_id, email, username')
      .eq('user_id', userId)
      .single();

    if (callerProfileError || !callerProfile) {
      console.error('callerProfile query failed:', callerProfileError, 'profile:', callerProfile);
      return jsonResponse(request, { error: 'Perfil do usuario nao encontrado.' }, 403);
    }

    let body: ApprovalRequest | null = null;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(request, { error: 'Corpo da requisicao invalido.' }, 400);
    }

    const requiredFeature = body?.requiredFeature?.trim() ?? '';

    // requiredFeature is currently ignored due to runtime issues with current_store_has_feature.
    // It should be restored when the RPC call is stable.

    const adminEmail = normalizeEmail(body?.adminEmail ?? '');
    const adminPassword = body?.adminPassword?.trim() ?? '';

    if (!adminEmail) {
      return jsonResponse(request, { error: 'Informe o login do administrador.' }, 400);
    }

    if (!adminPassword) {
      return jsonResponse(request, { error: 'Informe a senha do administrador.' }, 400);
    }

    const verificationClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: approvalSession, error: approvalError } = await verificationClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (approvalError) {
      const approvalMessage = approvalError.message?.toLowerCase() ?? '';
      if (approvalMessage.includes('captcha')) {
        return jsonResponse(
          request,
          { error: 'O login por senha do administrador foi bloqueado pelo CAPTCHA do Supabase. Desative o CAPTCHA ou envie o token no frontend.' },
          503,
        );
      }

      console.error('signInWithPassword failed:', approvalError.message, 'user:', approvalSession.user);
      return jsonResponse(
        request,
        { error: 'Login ou senha do administrador invalidos. Use a senha cadastrada na conta do HappyCash.' },
        401,
      );
    }

    if (!approvalSession.user) {
      return jsonResponse(
        request,
        { error: 'Login ou senha do administrador invalidos. Use a senha cadastrada na conta do HappyCash.' },
        401,
      );
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

    const callerOwnerUserId = callerProfile.owner_user_id ?? userId;
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
  } catch (err) {
    // Garantir que qualquer excecao nao provoque crash silencioso do runtime
    try {
      console.error('Unhandled error in authorize-store-admin:', err);
    } catch (logErr) {
      // Ignorar erro de logging
    }
    return jsonResponse(new Request(''), { error: 'Erro interno da funcao.' }, 500);
  }
});
