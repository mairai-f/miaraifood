import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isValidOperatorUsername,
  normalizeOperatorUsername,
} from '../_shared/operatorCredentials.ts';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

type OperatorLoginRequest = {
  username?: string;
  password?: string;
};

type OperatorProfileRow = {
  user_id: string;
  email: string | null;
  username: string | null;
};

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

const getBody = async (request: Request): Promise<OperatorLoginRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Método não suportado.' }, 405);
  }

  const body = await getBody(request);
  const normalizedUsername = normalizeOperatorUsername(body?.username ?? '');
  const password = body?.password?.trim();

  if (!isValidOperatorUsername(normalizedUsername) || !password) {
    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuração de autenticação inválida.' }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profiles, error: profileError } = await serviceClient
    .from('profiles')
    .select('user_id, email, username')
    .eq('role', 'operator')
    .eq('username', normalizedUsername);

  if (profileError || !profiles || profiles.length === 0) {
    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  const matchingProfiles = (profiles as OperatorProfileRow[]).filter(profile =>
    normalizeOperatorUsername(profile.username ?? '') === normalizedUsername,
  );

  if (matchingProfiles.length === 0) {
    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  for (const profile of matchingProfiles) {
    let operatorEmail = profile.email;

    if (!operatorEmail) {
      const { data: authUserData, error: authUserError } = await serviceClient.auth.admin.getUserById(profile.user_id);

      if (!authUserError && authUserData.user?.email) {
        operatorEmail = authUserData.user.email;

        await serviceClient
          .from('profiles')
          .update({ email: operatorEmail })
          .eq('user_id', profile.user_id);
      }
    }

    if (!operatorEmail) {
      continue;
    }

    const { data: sessionData, error: loginError } = await authClient.auth.signInWithPassword({
      email: operatorEmail,
      password,
    });

    if (loginError || !sessionData.session) {
      continue;
    }

    return jsonResponse(request, {
      success: true,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      },
    });
  }

  return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
});
