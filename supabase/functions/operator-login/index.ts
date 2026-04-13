import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isValidOperatorUsername,
  normalizeOperatorUsername,
} from '../_shared/operatorCredentials.ts';

type OperatorLoginRequest = {
  username?: string;
  password?: string;
};

interface OperatorProfileRow {
  email: string | null;
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

const getBody = async (request: Request): Promise<OperatorLoginRequest | null> => {
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Configuração de autenticação inválida.' }, 500);
  }

  const body = await getBody(request);
  const normalizedUsername = normalizeOperatorUsername(body?.username ?? '');
  const password = body?.password?.trim();

  if (!isValidOperatorUsername(normalizedUsername) || !password) {
    return jsonResponse({ error: 'Usuário ou senha incorretos.' }, 401);
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
    .select('email, username')
    .eq('role', 'operator');

  const matchingProfiles = ((profiles as OperatorProfileRow[] | null) ?? []).filter(
    (profile) => normalizeOperatorUsername(profile.username) === normalizedUsername,
  );

  if (profileError || matchingProfiles.length !== 1 || !matchingProfiles[0].email) {
    return jsonResponse({ error: 'Usuário ou senha incorretos.' }, 401);
  }

  const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
    email: matchingProfiles[0].email,
    password,
  });

  if (loginError || !loginData.session || !loginData.user) {
    return jsonResponse({ error: 'Usuário ou senha incorretos.' }, 401);
  }

  return jsonResponse({
    success: true,
    session: {
      access_token: loginData.session.access_token,
      refresh_token: loginData.session.refresh_token,
    },
  });
});
