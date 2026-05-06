import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildOperatorEmail,
  buildOperatorAuthPasswordCandidates,
  isValidOperatorUsername,
  normalizeOperatorUsername,
} from '../_shared/operatorCredentials.ts';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

type OperatorLoginRequest = {
  username?: string;
  password?: string;
  ownerUserId?: string | null;
};

type OperatorProfileRow = {
  user_id: string;
  email: string | null;
  username: string | null;
  owner_user_id: string | null;
};

type AttemptStatus = 'blocked' | 'config_error' | 'failed' | 'invalid' | 'success';

const MAX_IP_ATTEMPTS_PER_15_MIN = Number(Deno.env.get('OPERATOR_LOGIN_MAX_IP_ATTEMPTS_PER_15_MIN') || '15');
const MAX_USERNAME_ATTEMPTS_PER_15_MIN = Number(Deno.env.get('OPERATOR_LOGIN_MAX_USERNAME_ATTEMPTS_PER_15_MIN') || '8');

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

const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
};

const extractClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-client-ip') ||
    request.headers.get('fly-client-ip') ||
    null
  );
};

const logAttempt = async (
  serviceClient: ReturnType<typeof createClient>,
  details: {
    usernameHash: string | null;
    ipHash: string | null;
    origin: string | null;
    status: AttemptStatus;
    userAgent: string | null;
  },
) => {
  await serviceClient.from('operator_login_attempts').insert({
    username_hash: details.usernameHash,
    ip_hash: details.ipHash,
    origin: details.origin,
    status: details.status,
    user_agent: details.userAgent,
  });
};

const getAttemptCounts = async (
  serviceClient: ReturnType<typeof createClient>,
  details: {
    usernameHash: string | null;
    ipHash: string | null;
  },
) => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const ipCountPromise = details.ipHash
    ? serviceClient
        .from('operator_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', details.ipHash)
        .in('status', ['failed', 'blocked', 'invalid'])
        .gte('created_at', fifteenMinutesAgo)
    : Promise.resolve({ count: 0, error: null });

  const usernameCountPromise = details.usernameHash
    ? serviceClient
        .from('operator_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('username_hash', details.usernameHash)
        .in('status', ['failed', 'blocked', 'invalid'])
        .gte('created_at', fifteenMinutesAgo)
    : Promise.resolve({ count: 0, error: null });

  const [{ count: ipCount, error: ipError }, { count: usernameCount, error: usernameError }] = await Promise.all([
    ipCountPromise,
    usernameCountPromise,
  ]);

  if (ipError || usernameError) {
    throw new Error('Nao foi possivel validar a seguranca do login do operador agora.');
  }

  return {
    ipCount: ipCount ?? 0,
    usernameCount: usernameCount ?? 0,
  };
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
  const ownerUserId = body?.ownerUserId?.trim() || null;
  const origin = request.headers.get('origin');
  const userAgent = request.headers.get('user-agent');
  const clientIp = extractClientIp(request);
  const [usernameHash, ipHash] = await Promise.all([
    normalizedUsername ? sha256(normalizedUsername) : Promise.resolve(null),
    clientIp ? sha256(clientIp) : Promise.resolve(null),
  ]);

  if (!isValidOperatorUsername(normalizedUsername) || !password) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceRoleKey) {
      const earlyServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      await logAttempt(earlyServiceClient, {
        usernameHash,
        ipHash,
        origin,
        status: 'invalid',
        userAgent,
      });
    }

    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    if (supabaseUrl && supabaseServiceRoleKey) {
      const partialServiceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      await logAttempt(partialServiceClient, {
        usernameHash,
        ipHash,
        origin,
        status: 'config_error',
        userAgent,
      });
    }

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

  try {
    const attemptCounts = await getAttemptCounts(serviceClient, { usernameHash, ipHash });

    if (
      attemptCounts.ipCount >= MAX_IP_ATTEMPTS_PER_15_MIN ||
      attemptCounts.usernameCount >= MAX_USERNAME_ATTEMPTS_PER_15_MIN
    ) {
      await logAttempt(serviceClient, {
        usernameHash,
        ipHash,
        origin,
        status: 'blocked',
        userAgent,
      });

      return jsonResponse(
        request,
        { error: 'Muitas tentativas de login do operador. Aguarde alguns minutos e tente novamente.' },
        429,
      );
    }
  } catch {
    return jsonResponse(request, { error: 'Nao foi possivel validar a seguranca do login agora.' }, 503);
  }

  const { data: profiles, error: profileError } = await serviceClient
    .from('profiles')
    .select('user_id, email, username, owner_user_id')
    .eq('role', 'operator');

  if (profileError || !profiles || profiles.length === 0) {
    await logAttempt(serviceClient, {
      usernameHash,
      ipHash,
      origin,
      status: 'failed',
      userAgent,
    });
    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  const matchingProfiles = (profiles as OperatorProfileRow[]).filter(profile =>
    normalizeOperatorUsername(profile.username ?? '') === normalizedUsername
      && (!ownerUserId || profile.owner_user_id === ownerUserId),
  );

  if (matchingProfiles.length === 0) {
    await logAttempt(serviceClient, {
      usernameHash,
      ipHash,
      origin,
      status: 'failed',
      userAgent,
    });
    return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
  }

  for (const profile of matchingProfiles) {
    const operatorEmails = new Set<string>();
    const authPasswords = buildOperatorAuthPasswordCandidates(normalizedUsername, password);
    const profileEmail = profile.email?.trim();
    if (profileEmail) operatorEmails.add(profileEmail);

    const { data: authUserData, error: authUserError } = await serviceClient.auth.admin.getUserById(profile.user_id);
    const authEmail = authUserData.user?.email?.trim();
    if (!authUserError && authEmail) {
      operatorEmails.add(authEmail);

      if (profileEmail !== authEmail) {
        await serviceClient
          .from('profiles')
          .update({ email: authEmail })
          .eq('user_id', profile.user_id);
      }
    }

    operatorEmails.add(buildOperatorEmail(normalizedUsername));

    for (const operatorEmail of operatorEmails) {
      for (const authPassword of authPasswords) {
        const { data: sessionData, error: loginError } = await authClient.auth.signInWithPassword({
          email: operatorEmail,
          password: authPassword,
        });

        if (loginError || !sessionData.session) {
          continue;
        }

        await logAttempt(serviceClient, {
          usernameHash,
          ipHash,
          origin,
          status: 'success',
          userAgent,
        });

        return jsonResponse(request, {
          success: true,
          session: {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
          },
          operator: {
            userId: profile.user_id,
            ownerUserId: profile.owner_user_id,
            username: profile.username ?? normalizedUsername,
            email: authEmail ?? profileEmail ?? operatorEmail,
          },
        });
      }
    }
  }

  await logAttempt(serviceClient, {
    usernameHash,
    ipHash,
    origin,
    status: 'failed',
    userAgent,
  });

  return jsonResponse(request, { error: 'Usuário ou senha incorretos.' }, 401);
});
