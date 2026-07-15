import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  checkRedisLoginAttemptLimit,
  checkRedisRateLimit,
  clearRedisLoginFailures,
  readRateLimitEnv,
  recordRedisLoginFailure,
} from "../_shared/rateLimit.ts";

type AdminLoginRequest = {
  email?: string;
  password?: string;
  captchaToken?: string;
  desktopOwnerUserId?: string | null;
};

type AdminProfileRow = {
  user_id: string;
  email: string | null;
  role: string | null;
  owner_user_id: string | null;
};

type StoreAccountRow = {
  product_context: string | null;
};

const LOGIN_LOCK_MESSAGE = "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";
const INVALID_LOGIN_MESSAGE = "Email ou senha incorretos.";
const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ["POST", "OPTIONS"],
      }).headers.entries()),
      "Content-Type": "application/json",
    },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getBody = async (request: Request): Promise<AdminLoginRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const readFailedAttemptLimit = () => readRateLimitEnv("ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_15_MIN", 3);

const checkEmailFailedAttemptLimit = (request: Request, email: string) =>
  checkRedisLoginAttemptLimit(request, {
    namespace: "admin-login-email-failure",
    identifier: email,
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const checkIpFailedAttemptLimit = (request: Request) =>
  checkRedisLoginAttemptLimit(request, {
    namespace: "admin-login-ip-failure",
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const checkFailedAttemptLimits = async (request: Request, email: string) => {
  const [emailLimit, ipLimit] = await Promise.all([
    checkEmailFailedAttemptLimit(request, email),
    checkIpFailedAttemptLimit(request),
  ]);

  return !emailLimit.allowed ? emailLimit : ipLimit;
};

const recordEmailFailedAttempt = (request: Request, email: string) =>
  recordRedisLoginFailure(request, {
    namespace: "admin-login-email-failure",
    identifier: email,
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const recordIpFailedAttempt = (request: Request) =>
  recordRedisLoginFailure(request, {
    namespace: "admin-login-ip-failure",
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const recordFailedAttempts = async (request: Request, email: string) => {
  const [emailFailure, ipFailure] = await Promise.all([
    recordEmailFailedAttempt(request, email),
    recordIpFailedAttempt(request),
  ]);

  return !emailFailure.allowed ? emailFailure : ipFailure;
};

const clearFailedAttempts = async (request: Request, email: string) => {
  await clearRedisLoginFailures(request, {
    namespace: "admin-login-email-failure",
    identifier: email,
  });
  await clearRedisLoginFailures(request, {
    namespace: "admin-login-ip-failure",
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, {
      allowedMethods: ["POST", "OPTIONS"],
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Metodo nao suportado." }, 405);
  }

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "admin-login",
    limit: readRateLimitEnv("ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE", 30),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitas tentativas de login em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const body = await getBody(request);
  const email = normalizeEmail(body?.email ?? "");
  const password = body?.password?.trim() || "";
  const captchaToken = body?.captchaToken?.trim() || undefined;
  const desktopOwnerUserId = body?.desktopOwnerUserId?.trim() || null;

  if (!email || !email.includes("@") || !password) {
    if (email) {
      await recordFailedAttempts(request, email);
    } else {
      await recordIpFailedAttempt(request);
    }
    return jsonResponse(request, { error: INVALID_LOGIN_MESSAGE }, 401);
  }

  const failedAttemptLimit = await checkFailedAttemptLimits(request, email);
  if (!failedAttemptLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: LOGIN_LOCK_MESSAGE,
        retryAfterSeconds: failedAttemptLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: "Configuracao de autenticacao invalida." }, 500);
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

  const { data: sessionData, error: loginError } = await authClient.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });

  if (loginError || !sessionData.session || !sessionData.user) {
    const failure = await recordFailedAttempts(request, email);
    return jsonResponse(
      request,
      {
        error: failure.allowed ? INVALID_LOGIN_MESSAGE : LOGIN_LOCK_MESSAGE,
        retryAfterSeconds: failure.allowed ? null : failure.retryAfterSeconds,
      },
      failure.allowed ? 401 : 429,
    );
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("user_id, email, role, owner_user_id")
    .eq("user_id", sessionData.user.id)
    .limit(1)
    .maybeSingle();

  const typedProfile = profile as AdminProfileRow | null;
  const ownerUserId = typedProfile?.owner_user_id || sessionData.user.id;

  if (profileError || typedProfile?.role !== "admin") {
    const failure = await recordFailedAttempts(request, email);
    return jsonResponse(
      request,
      {
        error: failure.allowed ? INVALID_LOGIN_MESSAGE : LOGIN_LOCK_MESSAGE,
        retryAfterSeconds: failure.allowed ? null : failure.retryAfterSeconds,
      },
      failure.allowed ? 401 : 429,
    );
  }

  if (desktopOwnerUserId && ownerUserId !== desktopOwnerUserId) {
    const failure = await recordFailedAttempts(request, email);
    return jsonResponse(
      request,
      {
        error: failure.allowed ? INVALID_LOGIN_MESSAGE : LOGIN_LOCK_MESSAGE,
        retryAfterSeconds: failure.allowed ? null : failure.retryAfterSeconds,
      },
      failure.allowed ? 401 : 429,
    );
  }

  const { data: storeAccount, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("product_context")
    .eq("owner_user_id", ownerUserId)
    .limit(1)
    .maybeSingle();

  const typedStoreAccount = storeAccount as StoreAccountRow | null;

  if (storeAccountError || (typedStoreAccount?.product_context && typedStoreAccount.product_context !== "happycash")) {
    const failure = await recordFailedAttempts(request, email);
    return jsonResponse(
      request,
      {
        error: failure.allowed ? INVALID_LOGIN_MESSAGE : LOGIN_LOCK_MESSAGE,
        retryAfterSeconds: failure.allowed ? null : failure.retryAfterSeconds,
      },
      failure.allowed ? 401 : 429,
    );
  }

  await clearFailedAttempts(request, email);

  return jsonResponse(request, {
    success: true,
    session: {
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    },
    user: {
      id: sessionData.user.id,
      email: typedProfile.email || sessionData.user.email || email,
      ownerUserId,
      role: "admin",
    },
  });
});
