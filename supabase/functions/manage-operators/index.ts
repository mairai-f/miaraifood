import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildOperatorEmail,
  isValidOperatorUsername,
  normalizeOperatorUsername,
  operatorUsernameHelpText,
} from '../_shared/operatorCredentials.ts';

type ManageOperatorRequest =
  | {
      action: 'create';
      username?: string;
      password?: string;
    }
  | {
      action: 'reset_password';
      operatorUserId?: string;
      password?: string;
    }
  | {
      action: 'delete';
      operatorUserId?: string;
    };

interface OperatorLookupRow {
  user_id: string;
  username: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const getBody = async (request: Request): Promise<ManageOperatorRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;

  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Configuração de autenticação inválida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse({ error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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
    return jsonResponse({ error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const { data: callerProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id')
    .eq('user_id', user.id)
    .single();

  if (profileError || !callerProfile) {
    return jsonResponse({ error: 'Perfil do usuário não encontrado.' }, 403);
  }

  if (callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Somente administradores podem gerenciar operadores.' }, 403);
  }

  const ownerUserId = callerProfile.owner_user_id ?? user.id;
  const body = await getBody(request);

  if (!body?.action) {
    return jsonResponse({ error: 'Ação inválida.' }, 400);
  }

  if (body.action === 'create') {
    const normalizedUsername = normalizeOperatorUsername(body.username ?? '');
    const password = body.password?.trim();

    if (!isValidOperatorUsername(normalizedUsername)) {
      return jsonResponse({ error: operatorUsernameHelpText }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400);
    }

    const { data: existingOperators, error: existingOperatorsError } = await serviceClient
      .from('profiles')
      .select('user_id, username')
      .eq('role', 'operator');

    if (existingOperatorsError) {
      return jsonResponse({ error: 'Não foi possível validar o usuário do operador.' }, 500);
    }

    const usernameAlreadyExists = ((existingOperators as OperatorLookupRow[] | null) ?? []).some(
      (operator) => normalizeOperatorUsername(operator.username) === normalizedUsername,
    );

    if (usernameAlreadyExists) {
      return jsonResponse({ error: 'Esse usuário já está em uso. Escolha outro.' }, 409);
    }

    const generatedEmail = buildOperatorEmail(normalizedUsername);

    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: generatedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        role: 'operator',
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      },
    });

    if (createError || !createdUser.user) {
      const errorMessage = createError?.message?.toLowerCase().includes('already')
        ? 'Esse usuário já está em uso. Escolha outro.'
        : createError?.message || 'Não foi possível criar o operador.';

      return jsonResponse({ error: errorMessage }, 400);
    }

    const { error: updateProfileError } = await serviceClient
      .from('profiles')
      .update({
        username: normalizedUsername,
        email: generatedEmail,
        role: 'operator',
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      })
      .eq('user_id', createdUser.user.id);

    if (updateProfileError) {
      return jsonResponse({ error: 'Operador criado, mas o perfil não foi atualizado corretamente.' }, 500);
    }

    return jsonResponse({
      success: true,
      operator: {
        user_id: createdUser.user.id,
        username: normalizedUsername,
      },
      temporaryPassword: password,
    });
  }

  if (body.action === 'reset_password') {
    const operatorUserId = body.operatorUserId?.trim();
    const password = body.password?.trim();

    if (!operatorUserId) {
      return jsonResponse({ error: 'Operador inválido.' }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse({ error: 'A nova senha deve ter ao menos 6 caracteres.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse({ error: 'Operador não encontrado.' }, 404);
    }

    if (targetProfile.role !== 'operator' || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse({ error: 'Você não pode redefinir a senha deste operador.' }, 403);
    }

    const { error: resetError } = await serviceClient.auth.admin.updateUserById(operatorUserId, {
      password,
    });

    if (resetError) {
      return jsonResponse({ error: resetError.message || 'Não foi possível redefinir a senha.' }, 400);
    }

    return jsonResponse({
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
      },
      temporaryPassword: password,
    });
  }

  if (body.action === 'delete') {
    const operatorUserId = body.operatorUserId?.trim();

    if (!operatorUserId) {
      return jsonResponse({ error: 'Operador inválido.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse({ error: 'Operador não encontrado.' }, 404);
    }

    if (targetProfile.role !== 'operator' || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse({ error: 'Você não pode excluir este operador.' }, 403);
    }

    const { count: openCashSessionCount, error: openCashSessionError } = await serviceClient
      .from('cash_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', ownerUserId)
      .eq('operator_user_id', operatorUserId)
      .eq('status', 'open');

    if (openCashSessionError) {
      return jsonResponse({ error: 'Não foi possível validar o caixa do operador.' }, 500);
    }

    if ((openCashSessionCount ?? 0) > 0) {
      return jsonResponse({ error: 'Feche o caixa desse operador antes de excluí-lo.' }, 409);
    }

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(operatorUserId);

    if (deleteUserError) {
      return jsonResponse({ error: deleteUserError.message || 'Não foi possível excluir o operador.' }, 400);
    }

    return jsonResponse({
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
      },
    });
  }

  return jsonResponse({ error: 'Ação não suportada.' }, 400);
});
