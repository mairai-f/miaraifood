import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  checkRedisLoginAttemptLimit,
  checkRedisRateLimit,
  clearRedisLoginValue,
  clearRedisLoginFailures,
  extractClientIp,
  readRedisLoginValue,
  readRateLimitEnv,
  recordRedisLoginFailure,
  sha256,
  writeRedisLoginValue,
} from "../_shared/rateLimit.ts";
import {
  escapeHtml,
  getHappyCashFromEmail,
  renderHappyCashEmail,
  sendHappyCashEmail,
} from "../_shared/happycashEmail.ts";

type AdminLoginRequest = {
  email?: string;
  password?: string;
  captchaToken?: string;
  desktopOwnerUserId?: string | null;
  accessCode?: string | null;
  loginSurface?: string | null;
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
const LOGIN_VERIFICATION_REQUIRED_CODE = "LOGIN_VERIFICATION_REQUIRED";
const LOGIN_VERIFICATION_REQUIRED_MESSAGE = "Por seguranca, enviamos um codigo para seu e-mail. Digite o codigo para reconhecer esta tentativa e entrar.";
const LOGIN_VERIFICATION_INVALID_MESSAGE = "Codigo de autorizacao invalido ou expirado. Solicite um novo codigo e tente novamente.";
const LOGIN_VERIFICATION_SEND_LIMIT_MESSAGE = "Ja enviamos um codigo recentemente. Verifique seu e-mail antes de pedir outro.";
const LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60;
const LOGIN_VERIFICATION_WINDOW_SECONDS = 10 * 60;

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
const normalizeAccessCode = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").slice(0, 8);
const normalizeLoginSurface = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "happycashsite" || normalized === "web" || normalized === "desktop" || normalized === "mobile") {
    return normalized;
  }
  return "unknown";
};
const getIpFallbackIdentifier = (request: Request, email: string) =>
  extractClientIp(request) ? null : email || "anonymous";

const getBody = async (request: Request): Promise<AdminLoginRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const readFailedAttemptLimit = () => readRateLimitEnv("ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_15_MIN", 3);
const readVerificationEmailLimit = () => readRateLimitEnv("ADMIN_LOGIN_VERIFICATION_EMAILS_PER_15_MIN", 3);
const shouldRequireEmailVerification = (loginSurface: string) =>
  loginSurface === "web" || loginSurface === "happycashsite";

const buildVerificationIdentifier = (email: string) => email;
const buildVerificationDigest = (email: string, code: string) =>
  sha256(`admin-login-verification:${email}:${code}`);

const generateVerificationCode = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 100_000_000).padStart(8, "0");
};

const checkEmailFailedAttemptLimit = (request: Request, email: string) =>
  checkRedisLoginAttemptLimit(request, {
    namespace: "admin-login-email-failure",
    identifier: email,
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const checkIpFailedAttemptLimit = (request: Request, email: string) =>
  checkRedisLoginAttemptLimit(request, {
    namespace: "admin-login-ip-failure",
    identifier: getIpFallbackIdentifier(request, email),
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const checkFailedAttemptLimits = async (request: Request, email: string) => {
  const [emailLimit, ipLimit] = await Promise.all([
    checkEmailFailedAttemptLimit(request, email),
    checkIpFailedAttemptLimit(request, email),
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

const recordIpFailedAttempt = (request: Request, email: string) =>
  recordRedisLoginFailure(request, {
    namespace: "admin-login-ip-failure",
    identifier: getIpFallbackIdentifier(request, email),
    limit: readFailedAttemptLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

const recordFailedAttempts = async (request: Request, email: string) => {
  const [emailFailure, ipFailure] = await Promise.all([
    recordEmailFailedAttempt(request, email),
    recordIpFailedAttempt(request, email),
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
    identifier: getIpFallbackIdentifier(request, email),
  });
};

const getSurfaceLabel = (loginSurface: string) =>
  loginSurface === "happycashsite" ? "HappyCash Site" : "HappyCash Web";

const sendLoginVerificationCode = async (
  request: Request,
  email: string,
  loginSurface: string,
) => {
  const emailLimit = await checkRedisRateLimit(request, {
    namespace: "admin-login-verification-email",
    identifier: email,
    limit: readVerificationEmailLimit(),
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
  });

  if (!emailLimit.allowed) {
    return {
      sent: false,
      retryAfterSeconds: emailLimit.retryAfterSeconds,
      error: LOGIN_VERIFICATION_SEND_LIMIT_MESSAGE,
    };
  }

  const code = generateVerificationCode();
  const digest = await buildVerificationDigest(email, code);
  const stored = await writeRedisLoginValue(request, {
    namespace: "admin-login-verification-code",
    identifier: buildVerificationIdentifier(email),
    value: digest,
    windowSeconds: LOGIN_VERIFICATION_WINDOW_SECONDS,
  });

  if (!stored) {
    return {
      sent: false,
      retryAfterSeconds: null,
      error: "Nao foi possivel preparar o codigo de autorizacao agora.",
    };
  }

  try {
    const surfaceLabel = getSurfaceLabel(loginSurface);
    const html = renderHappyCashEmail({
      eyebrow: "Acesso protegido",
      title: "Reconheca esta tentativa de entrada",
      preview: "Use o codigo de autorizacao para liberar seu acesso HappyCash.",
      intro: `Detectamos 3 tentativas incorretas de login para ${email} no ${surfaceLabel}. Se foi voce, use o codigo abaixo para autorizar a entrada.`,
      contentHtml: `
        <div style="margin:28px 0;border:1px solid #d8e2ef;border-radius:14px;background:#f8fbff;padding:18px;text-align:center;">
          <p style="margin:0 0 8px;color:#5b6b83;font-size:12px;line-height:18px;">Codigo de autorizacao</p>
          <p style="margin:0;color:#14213d;font-size:34px;line-height:40px;font-weight:900;letter-spacing:7px;">${escapeHtml(code)}</p>
        </div>
        <p style="margin:18px 0 0;color:#42526a;font-size:14px;line-height:22px;">Este codigo expira em 10 minutos. Se voce nao reconhece esta tentativa, troque sua senha e fale com o suporte.</p>
      `,
      footerNote: "HappyCash nunca pede sua senha por e-mail. Use este codigo somente na tela oficial de login.",
    });
    const text = [
      "Reconheca esta tentativa de entrada HappyCash.",
      `Detectamos 3 tentativas incorretas de login para ${email} no ${surfaceLabel}.`,
      `Codigo de autorizacao: ${code}`,
      "Este codigo expira em 10 minutos.",
      "Se voce nao reconhece esta tentativa, troque sua senha e fale com o suporte.",
    ].join("\n");

    await sendHappyCashEmail({
      from: getHappyCashFromEmail("LOGIN_VERIFICATION_FROM_EMAIL"),
      to: [email],
      subject: "Codigo de autorizacao HappyCash",
      html,
      text,
    });

    return { sent: true, retryAfterSeconds: null, error: null };
  } catch (error) {
    await clearRedisLoginValue(request, {
      namespace: "admin-login-verification-code",
      identifier: buildVerificationIdentifier(email),
    });
    console.warn("Nao foi possivel enviar o codigo de autorizacao.", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      sent: false,
      retryAfterSeconds: null,
      error: "Nao foi possivel enviar o codigo de autorizacao agora.",
    };
  }
};

const verifyLoginAccessCode = async (request: Request, email: string, accessCode: string) => {
  const normalizedCode = normalizeAccessCode(accessCode);
  if (normalizedCode.length !== 8) return false;

  const expectedDigest = await readRedisLoginValue(request, {
    namespace: "admin-login-verification-code",
    identifier: buildVerificationIdentifier(email),
  });

  if (!expectedDigest) return false;

  const receivedDigest = await buildVerificationDigest(email, normalizedCode);
  const valid = receivedDigest === expectedDigest;

  if (valid) {
    await clearRedisLoginValue(request, {
      namespace: "admin-login-verification-code",
      identifier: buildVerificationIdentifier(email),
    });
  }

  return valid;
};

const verificationRequiredResponse = async (
  request: Request,
  email: string,
  loginSurface: string,
  options?: { sendCode?: boolean; message?: string; status?: number; retryAfterSeconds?: number | null },
) => {
  let message = options?.message ?? LOGIN_VERIFICATION_REQUIRED_MESSAGE;
  let retryAfterSeconds = options?.retryAfterSeconds ?? null;

  if (options?.sendCode !== false) {
    const sendResult = await sendLoginVerificationCode(request, email, loginSurface);
    message = sendResult.sent ? LOGIN_VERIFICATION_REQUIRED_MESSAGE : (sendResult.error ?? LOGIN_VERIFICATION_REQUIRED_MESSAGE);
    retryAfterSeconds = sendResult.retryAfterSeconds;
  }

  return jsonResponse(
    request,
    {
      success: false,
      verificationRequired: true,
      code: LOGIN_VERIFICATION_REQUIRED_CODE,
      error: message,
      retryAfterSeconds,
      maxFailedAttempts: readFailedAttemptLimit(),
      remainingAttempts: 0,
    },
    options?.status ?? 200,
  );
};

const failedLoginResponse = async (
  request: Request,
  email: string,
  failure: Awaited<ReturnType<typeof recordFailedAttempts>>,
  loginSurface: string,
) => {
  if (shouldRequireEmailVerification(loginSurface) && !failure.allowed) {
    return verificationRequiredResponse(request, email, loginSurface, { sendCode: true });
  }

  return jsonResponse(
    request,
    {
      error: failure.allowed ? INVALID_LOGIN_MESSAGE : LOGIN_LOCK_MESSAGE,
      retryAfterSeconds: failure.allowed ? null : failure.retryAfterSeconds,
      maxFailedAttempts: readFailedAttemptLimit(),
      remainingAttempts: failure.remaining,
    },
    failure.allowed ? 401 : 429,
  );
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

  const body = await getBody(request);
  const email = normalizeEmail(body?.email ?? "");
  const password = body?.password?.trim() || "";
  const captchaToken = body?.captchaToken?.trim() || undefined;
  const desktopOwnerUserId = body?.desktopOwnerUserId?.trim() || null;
  const accessCode = normalizeAccessCode(body?.accessCode);
  const loginSurface = normalizeLoginSurface(body?.loginSurface);

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "admin-login",
    identifier: getIpFallbackIdentifier(request, email),
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

  if (!email || !email.includes("@") || !password) {
    if (email) {
      await recordFailedAttempts(request, email);
    } else {
      await recordIpFailedAttempt(request, email);
    }
    return jsonResponse(request, { error: INVALID_LOGIN_MESSAGE }, 401);
  }

  const failedAttemptLimit = await checkFailedAttemptLimits(request, email);
  if (!failedAttemptLimit.allowed) {
    if (!shouldRequireEmailVerification(loginSurface)) {
      return jsonResponse(
        request,
        {
          error: LOGIN_LOCK_MESSAGE,
          retryAfterSeconds: failedAttemptLimit.retryAfterSeconds,
          maxFailedAttempts: readFailedAttemptLimit(),
          remainingAttempts: 0,
        },
        429,
      );
    }

    if (!accessCode) {
      return verificationRequiredResponse(request, email, loginSurface, {
        sendCode: true,
        retryAfterSeconds: failedAttemptLimit.retryAfterSeconds,
      });
    }

    const accessCodeValid = await verifyLoginAccessCode(request, email, accessCode);
    if (!accessCodeValid) {
      return verificationRequiredResponse(request, email, loginSurface, {
        sendCode: false,
        message: LOGIN_VERIFICATION_INVALID_MESSAGE,
        status: 401,
        retryAfterSeconds: failedAttemptLimit.retryAfterSeconds,
      });
    }

    await clearFailedAttempts(request, email);
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
    return failedLoginResponse(request, email, failure, loginSurface);
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
    return failedLoginResponse(request, email, failure, loginSurface);
  }

  if (desktopOwnerUserId && ownerUserId !== desktopOwnerUserId) {
    const failure = await recordFailedAttempts(request, email);
    return failedLoginResponse(request, email, failure, loginSurface);
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
    return failedLoginResponse(request, email, failure, loginSurface);
  }

  await clearFailedAttempts(request, email);
  await clearRedisLoginValue(request, {
    namespace: "admin-login-verification-code",
    identifier: buildVerificationIdentifier(email),
  });

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
