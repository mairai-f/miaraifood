import { createClient } from 'npm:@supabase/supabase-js@2';

type ManageOperatorRequest =
  | {
      action: 'create';
      username?: string;
      email?: string;
      password?: string;
    }
  | {
      action: 'reset_password';
      operatorUserId?: string;
      password?: string;
    };

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

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getBody = async (request: Request): Promise<ManageOperatorRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
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
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !authorization) {
    return jsonResponse({ error: 'Configuração de autenticação inválida.' }, 500);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
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
  } = await authClient.auth.getUser();

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
    const username = body.username?.trim();
    const email = normalizeEmail(body.email ?? '');
    const password = body.password?.trim();

    if (!username) {
      return jsonResponse({ error: 'Informe o nome do operador.' }, 400);
    }

    if (!email) {
      return jsonResponse({ error: 'Informe o e-mail do operador.' }, 400);
    }

    if (!password || password.length < 6) {
      return jsonResponse({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400);
    }

    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role: 'operator',
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      },
    });

    if (createError || !createdUser.user) {
      return jsonResponse({ error: createError?.message || 'Não foi possível criar o operador.' }, 400);
    }

    const { error: updateProfileError } = await serviceClient
      .from('profiles')
      .update({
        username,
        email,
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
        username,
        email,
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
      .select('user_id, role, owner_user_id, username, email')
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
        email: targetProfile.email,
      },
      temporaryPassword: password,
    });
  }

  return jsonResponse({ error: 'Ação não suportada.' }, 400);
});
