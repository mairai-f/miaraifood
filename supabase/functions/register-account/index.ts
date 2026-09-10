import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  LEGAL_ACCEPTANCE_SOURCES,
  requireLegalAcceptance,
} from "../_shared/legalAcceptance.ts";
import { getPasswordPolicyError } from "../_shared/passwordPolicy.ts";
import { normalizeProductContext, resolveProductContextFromPlanId } from "../_shared/productContext.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

interface RegisterAccountRequest {
  email?: string;
  password?: string;
  nomeCliente?: string;
  telefone?: string;
  cnpj?: string;
  nomeEstabelecimento?: string;
  tipoEstabelecimento?: string;
  cep?: string;
  endereco?: string;
  nomeRua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  redirectTo?: string;
  website?: string;
  captchaToken?: string;
  planId?: string | null;
  termsAccepted?: boolean;
  termsVersion?: string;
  privacyAccepted?: boolean;
  privacyVersion?: string;
  lgpdAccepted?: boolean;
  lgpdVersion?: string;
  legalAcceptanceSource?: string | null;
  setupConfig?: Record<string, unknown>;
}

interface RegisterAccountResponse {
  success: boolean;
  requiresEmailConfirmation?: boolean;
  resumeExistingRegistration?: boolean;
  existingAccountEmailSent?: boolean;
  existingAccountRecoverySent?: boolean;
  email?: string;
  message?: string;
  error?: string;
  retryAfterSeconds?: number | null;
}

interface PendingRegistrationRow {
  owner_user_id: string;
}

interface StoreAccountRow {
  id: string;
}

type AttemptStatus = "blocked" | "config_error" | "created" | "failed" | "honeypot" | "invalid";
type ServiceClient = SupabaseClient;

const registrationCorsOptions = {
  allowedMethods: ["POST", "OPTIONS"],
  allowOriginless: false,
};

const MAX_IP_ATTEMPTS_PER_15_MIN = 5;
const MAX_EMAIL_ATTEMPTS_PER_HOUR = 3;
const DEFAULT_CONFIRM_REDIRECT = "https://www.miaraifood.com.br/auth/callback";
const DEFAULT_RECOVERY_REDIRECT = "https://www.miaraifood.com.br/login?recovery=1";
const DEFAULT_CONFIRM_REDIRECT_ORIGINS = [
  "https://www.miaraifood.com.br",
  "https://miaraifood.com.br",
  "https://app.miaraifood.com.br",
  "https://representante.miaraifood.com.br",
  "https://supergestora.miaraifood.com.br",
  "https://entregador.miaraifood.com.br",
];
const EXISTING_ACCOUNT_EMAIL_MESSAGE =
  "Se esse email ja estiver cadastrado, enviamos instrucoes para recuperar o acesso ou continuar o cadastro.";

const jsonResponse = (request: Request, body: RegisterAccountResponse, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, registrationCorsOptions).headers.entries()),
      "Content-Type": "application/json",
    },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const trimToNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
};

const extractClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    request.headers.get("fly-client-ip") ||
    null
  );
};

const resolveRedirectTo = (value?: string) => {
  const fallback = Deno.env.get("SITE_EMAIL_CONFIRM_REDIRECT_URL")?.trim() || DEFAULT_CONFIRM_REDIRECT;

  if (!value?.trim()) return fallback;

  try {
    const parsed = new URL(value);
    const fallbackUrl = new URL(fallback);
    const allowedOrigins = new Set([...DEFAULT_CONFIRM_REDIRECT_ORIGINS, fallbackUrl.origin]);

    if (allowedOrigins.has(parsed.origin)) {
      return parsed.toString();
    }

    if (parsed.pathname === "/auth/callback") {
      fallbackUrl.pathname = parsed.pathname;
      fallbackUrl.search = parsed.search || fallbackUrl.search;
      fallbackUrl.hash = "";
      return fallbackUrl.toString();
    }

    return fallback;
  } catch {
    return fallback;
  }
};

const resolveRecoveryRedirectTo = (email: string) => {
  const fallback = Deno.env.get("SITE_PASSWORD_RECOVERY_REDIRECT_URL")?.trim() || DEFAULT_RECOVERY_REDIRECT;

  try {
    const parsed = new URL(fallback);
    const allowedOrigins = new Set(DEFAULT_CONFIRM_REDIRECT_ORIGINS);
    const recoveryUrl = allowedOrigins.has(parsed.origin) ? parsed : new URL(DEFAULT_RECOVERY_REDIRECT);

    if (!recoveryUrl.pathname || recoveryUrl.pathname === "/") {
      recoveryUrl.pathname = "/login";
    }
    recoveryUrl.searchParams.set("recovery", "1");
    recoveryUrl.searchParams.set("email", email);
    recoveryUrl.hash = "";
    return recoveryUrl.toString();
  } catch {
    const recoveryUrl = new URL(DEFAULT_RECOVERY_REDIRECT);
    recoveryUrl.searchParams.set("email", email);
    return recoveryUrl.toString();
  }
};

const validatePayload = (payload: RegisterAccountRequest) => {
  const email = normalizeEmail(payload.email || "");
  const password = payload.password?.trim() || "";
  const nomeCliente = payload.nomeCliente?.trim() || "";
  const telefone = digitsOnly(payload.telefone || "");
  const cpfCnpj = digitsOnly(payload.cnpj || "");
  const nomeEstabelecimento = payload.nomeEstabelecimento?.trim() || "";
  const tipoEstabelecimento = payload.tipoEstabelecimento?.trim() || "";
  const cep = digitsOnly(payload.cep || "");
  const endereco = payload.endereco?.trim() || "";
  const nomeRua = payload.nomeRua?.trim() || "";
  const numero = trimToNull(payload.numero);
  const complemento = trimToNull(payload.complemento);
  const bairro = trimToNull(payload.bairro);
  const cidade = payload.cidade?.trim() || "";
  const estado = payload.estado?.trim().toUpperCase() || "";
  const redirectTo = resolveRedirectTo(payload.redirectTo);
  const captchaToken = payload.captchaToken?.trim() || undefined;
  const productContext = normalizeProductContext(
    payload.planId ? resolveProductContextFromPlanId(payload.planId) : "happycash",
  );
  const passwordError = getPasswordPolicyError(password);
  const legalAcceptance = requireLegalAcceptance(payload, LEGAL_ACCEPTANCE_SOURCES.siteSignup);

  if (!email || !email.includes("@")) throw new Error("Informe um email valido.");
  if (passwordError) throw new Error(passwordError);
  if (!nomeCliente) throw new Error("Informe o nome completo.");
  if (telefone.length < 10) throw new Error("Informe um telefone valido.");
  if (![11, 14].includes(cpfCnpj.length)) throw new Error("Informe um CPF ou CNPJ valido.");
  if (!nomeEstabelecimento) throw new Error("Informe o nome do estabelecimento.");
  if (!tipoEstabelecimento) throw new Error("Selecione o tipo de estabelecimento.");
  if (cep.length !== 8) throw new Error("Informe um CEP valido.");
  if (!nomeRua) throw new Error("Informe a rua.");
  if (!cidade) throw new Error("Informe a cidade.");
  if (estado.length !== 2) throw new Error("Selecione o estado.");

  return {
    email,
    password,
    nomeCliente,
    telefone,
    cpfCnpj,
    nomeEstabelecimento,
    tipoEstabelecimento,
    cep,
    endereco: endereco || `${nomeRua}, ${bairro || ""}, ${cidade} - ${estado}`.replace(/\s+,/g, ",").trim(),
    nomeRua,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
    redirectTo,
    captchaToken,
    productContext,
    legalAcceptance,
  };
};

const logAttempt = async (
  serviceClient: ServiceClient,
  details: {
    emailHash: string | null;
    ipHash: string | null;
    origin: string | null;
    status: AttemptStatus;
    userAgent: string | null;
  },
) => {
  await serviceClient.from("site_registration_attempts").insert({
    email_hash: details.emailHash,
    ip_hash: details.ipHash,
    origin: details.origin,
    status: details.status,
    user_agent: details.userAgent,
  });
};

const getAttemptCounts = async (
  serviceClient: ServiceClient,
  details: {
    emailHash: string | null;
    ipHash: string | null;
  },
) => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const ipCountPromise = details.ipHash
    ? serviceClient
        .from("site_registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", details.ipHash)
        .gte("created_at", fifteenMinutesAgo)
    : Promise.resolve({ count: 0, error: null });

  const emailCountPromise = details.emailHash
    ? serviceClient
        .from("site_registration_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email_hash", details.emailHash)
        .gte("created_at", oneHourAgo)
    : Promise.resolve({ count: 0, error: null });

  const [{ count: ipCount, error: ipError }, { count: emailCount, error: emailError }] = await Promise.all([
    ipCountPromise,
    emailCountPromise,
  ]);

  if (ipError || emailError) {
    throw new Error("Nao foi possivel validar a seguranca do cadastro agora.");
  }

  return {
    emailCount: emailCount ?? 0,
    ipCount: ipCount ?? 0,
  };
};

const sendExistingAccountRecoveryEmail = async (
  anonClient: ServiceClient,
  details: {
    email: string;
    redirectTo: string;
    captchaToken?: string;
  },
) => {
  const { error } = await anonClient.auth.resetPasswordForEmail(details.email, {
    redirectTo: details.redirectTo,
    captchaToken: details.captchaToken,
  });

  if (error) {
    console.warn("Existing account recovery email failed", { message: error.message });
  }
};

const resendPendingSignupEmail = async (
  anonClient: ServiceClient,
  details: {
    email: string;
    redirectTo: string;
    captchaToken?: string;
  },
) => {
  const { error } = await anonClient.auth.resend({
    type: "signup",
    email: details.email,
    options: {
      emailRedirectTo: details.redirectTo,
      captchaToken: details.captchaToken,
    },
  });

  if (error) {
    console.warn("Pending signup confirmation resend failed", { message: error.message });
  }
};

const existingAccountEmailResponse = (request: Request, email: string, recoverySent = false) =>
  jsonResponse(request, {
    success: true,
    existingAccountEmailSent: true,
    existingAccountRecoverySent: recoverySent,
    requiresEmailConfirmation: !recoverySent,
    email,
    message: EXISTING_ACCOUNT_EMAIL_MESSAGE,
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, registrationCorsOptions);
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Metodo nao suportado." }, 405);
  }

  const corsState = buildCorsHeaders(request, registrationCorsOptions);
  if (!corsState.allowed) {
    return jsonResponse(request, { success: false, error: "Origem nao permitida." }, 403);
  }

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "register-account",
    limit: readRateLimitEnv("REGISTER_ACCOUNT_RATE_LIMIT_PER_MINUTE", 12),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        success: false,
        error: "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { success: false, error: "Configuracao do Supabase invalida." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let payload: RegisterAccountRequest;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { success: false, error: "Payload invalido." }, 400);
  }

  const origin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent");
  const normalizedEmail = payload.email ? normalizeEmail(payload.email) : "";
  const clientIp = extractClientIp(request);
  const [emailHash, ipHash] = await Promise.all([
    normalizedEmail ? sha256(normalizedEmail) : Promise.resolve(null),
    clientIp ? sha256(clientIp) : Promise.resolve(null),
  ]);

  if (payload.website?.trim()) {
    await logAttempt(serviceClient, {
      emailHash,
      ipHash,
      origin,
      status: "honeypot",
      userAgent,
    });

    return jsonResponse(request, { success: false, error: "Nao foi possivel concluir o cadastro." }, 400);
  }

  try {
    const data = validatePayload(payload);
    const attemptCounts = await getAttemptCounts(serviceClient, { emailHash, ipHash });

    if (attemptCounts.ipCount >= MAX_IP_ATTEMPTS_PER_15_MIN || attemptCounts.emailCount >= MAX_EMAIL_ATTEMPTS_PER_HOUR) {
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "blocked",
        userAgent,
      });

      return jsonResponse(
        request,
        {
          success: false,
          error: "Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.",
        },
        429,
      );
    }

    const { data: existingProfile, error: existingProfileError } = await serviceClient
      .from("profiles")
      .select("user_id")
      .ilike("email", data.email)
      .limit(1)
      .maybeSingle();

    if (existingProfileError) {
      throw new Error("Nao foi possivel verificar se esse email ja esta em uso.");
    }

    if (existingProfile?.user_id) {
      // Versões anteriores do site criavam somente o login. Se a pessoa
      // autenticou com a própria senha e ainda não possui loja nem cadastro
      // pendente, retomamos o mesmo cadastro em vez de deixar um auth.uid()
      // órfão ou criar outra identidade.
      const [existingStoreByOwnerResult, existingPendingByOwnerResult] = await Promise.all([
        serviceClient
          .from("store_accounts")
          .select("id")
          .eq("owner_user_id", existingProfile.user_id)
          .limit(1)
          .maybeSingle(),
        serviceClient
          .from("site_pending_registrations")
          .select("owner_user_id")
          .eq("owner_user_id", existingProfile.user_id)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle(),
      ]);

      if (existingStoreByOwnerResult.error || existingPendingByOwnerResult.error) {
        throw new Error("Nao foi possivel verificar o cadastro existente.");
      }

      if (!existingStoreByOwnerResult.data && !existingPendingByOwnerResult.data) {
        const { data: verifiedLogin, error: verifiedLoginError } = await anonClient.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (!verifiedLogin.user || verifiedLoginError) {
          await sendExistingAccountRecoveryEmail(anonClient, {
            email: data.email,
            redirectTo: resolveRecoveryRedirectTo(data.email),
            captchaToken: data.captchaToken,
          });
          await logAttempt(serviceClient, {
            emailHash,
            ipHash,
            origin,
            status: "invalid",
            userAgent,
          });
          return existingAccountEmailResponse(request, data.email, true);
        }

        const { error: resumeRegistrationError } = await serviceClient
          .from("site_pending_registrations")
          .upsert(
            {
              owner_user_id: existingProfile.user_id,
              email: data.email,
              nome_cliente: data.nomeCliente,
              telefone: data.telefone,
              cpf_cnpj: data.cpfCnpj,
              nome_estabelecimento: data.nomeEstabelecimento,
              tipo_estabelecimento: data.tipoEstabelecimento,
              cep: data.cep,
              endereco: data.endereco,
              nome_rua: data.nomeRua,
              numero: data.numero,
              complemento: data.complemento,
              bairro: data.bairro,
              cidade: data.cidade,
              estado: data.estado,
              failure_reason: null,
              status: "pending",
              completed_at: null,
              store_account_id: null,
              trial_ends_at: null,
              product_context: data.productContext,
              ...data.legalAcceptance,
            },
            { onConflict: "owner_user_id" },
          );

        if (resumeRegistrationError) {
          throw new Error("Nao foi possivel retomar seu cadastro agora.");
        }

        await logAttempt(serviceClient, {
          emailHash,
          ipHash,
          origin,
          status: "created",
          userAgent,
        });

        return jsonResponse(request, {
          success: true,
          requiresEmailConfirmation: false,
          resumeExistingRegistration: true,
          email: data.email,
        });
      }

      await sendExistingAccountRecoveryEmail(anonClient, {
        email: data.email,
        redirectTo: resolveRecoveryRedirectTo(data.email),
        captchaToken: data.captchaToken,
      });
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "invalid",
        userAgent,
      });

      return existingAccountEmailResponse(request, data.email, true);
    }

    const { data: existingStoreAccountByEmail, error: existingStoreAccountEmailError } = await serviceClient
      .from("store_accounts")
      .select("id")
      .ilike("email", data.email)
      .limit(1)
      .maybeSingle();

    if (existingStoreAccountEmailError) {
      throw new Error("Nao foi possivel verificar se esse email ja esta em uso.");
    }

    if ((existingStoreAccountByEmail as StoreAccountRow | null)?.id) {
      await sendExistingAccountRecoveryEmail(anonClient, {
        email: data.email,
        redirectTo: resolveRecoveryRedirectTo(data.email),
        captchaToken: data.captchaToken,
      });
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "invalid",
        userAgent,
      });

      return existingAccountEmailResponse(request, data.email, true);
    }

    const { data: existingStoreAccountByDocument, error: existingStoreAccountDocumentError } = await serviceClient
      .from("store_accounts")
      .select("id")
      .eq("cnpj", data.cpfCnpj)
      .eq("product_context", data.productContext)
      .limit(1)
      .maybeSingle();

    if (existingStoreAccountDocumentError) {
      throw new Error("Nao foi possivel verificar se esse CPF ou CNPJ ja esta em uso.");
    }

    if ((existingStoreAccountByDocument as StoreAccountRow | null)?.id) {
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "invalid",
        userAgent,
      });

      return jsonResponse(request, { success: false, error: "Ja existe uma conta com esse CPF ou CNPJ." }, 409);
    }

    const { data: existingPending, error: existingPendingError } = await serviceClient
      .from("site_pending_registrations")
      .select("owner_user_id")
      .ilike("email", data.email)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingPendingError) {
      throw new Error("Nao foi possivel verificar se esse email ja esta em uso.");
    }

    if ((existingPending as PendingRegistrationRow | null)?.owner_user_id) {
      await resendPendingSignupEmail(anonClient, {
        email: data.email,
        redirectTo: data.redirectTo,
        captchaToken: data.captchaToken,
      });
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "invalid",
        userAgent,
      });

      return existingAccountEmailResponse(request, data.email);
    }

    const { data: existingPendingDocument, error: existingPendingDocumentError } = await serviceClient
      .from("site_pending_registrations")
      .select("owner_user_id")
      .eq("cpf_cnpj", data.cpfCnpj)
      .eq("product_context", data.productContext)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingPendingDocumentError) {
      throw new Error("Nao foi possivel verificar se esse CPF ou CNPJ ja esta em uso.");
    }

    if ((existingPendingDocument as PendingRegistrationRow | null)?.owner_user_id) {
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "invalid",
        userAgent,
      });

      return jsonResponse(
        request,
        {
          success: false,
          error: "Ja existe um cadastro pendente para esse CPF ou CNPJ.",
        },
        409,
      );
    }

    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: "admin",
          username: data.email,
        },
        emailRedirectTo: data.redirectTo,
        captchaToken: data.captchaToken,
      },
    });

    if (signUpError || !signUpData.user?.id) {
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "failed",
        userAgent,
      });

      return jsonResponse(request, { success: false, error: "Nao foi possivel criar sua conta agora." }, 400);
    }

    const createdUserId = signUpData.user.id;

    if (signUpData.session?.access_token) {
      await serviceClient.auth.admin.deleteUser(createdUserId);
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "config_error",
        userAgent,
      });

      return jsonResponse(
        request,
        {
          success: false,
          error: "A confirmacao de email precisa estar habilitada no Supabase antes de liberar novos cadastros.",
        },
        503,
      );
    }

    const { error: pendingRegistrationError } = await serviceClient
      .from("site_pending_registrations")
      .upsert(
        {
          owner_user_id: createdUserId,
          email: data.email,
          nome_cliente: data.nomeCliente,
          telefone: data.telefone,
          cpf_cnpj: data.cpfCnpj,
          nome_estabelecimento: data.nomeEstabelecimento,
          tipo_estabelecimento: data.tipoEstabelecimento,
          cep: data.cep,
          endereco: data.endereco,
          nome_rua: data.nomeRua,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
          failure_reason: null,
          status: "pending",
          completed_at: null,
          store_account_id: null,
          trial_ends_at: null,
          product_context: data.productContext,
          ...data.legalAcceptance,
          setup_config: payload.setupConfig || {},
        },
        { onConflict: "owner_user_id" },
      );

    if (pendingRegistrationError) {
      await serviceClient.auth.admin.deleteUser(createdUserId);
      await logAttempt(serviceClient, {
        emailHash,
        ipHash,
        origin,
        status: "failed",
        userAgent,
      });

      return jsonResponse(
        request,
        {
          success: false,
          error: "Nao foi possivel preparar seu cadastro agora.",
        },
        500,
      );
    }

    await logAttempt(serviceClient, {
      emailHash,
      ipHash,
      origin,
      status: "created",
      userAgent,
    });

    return jsonResponse(request, {
      success: true,
      requiresEmailConfirmation: true,
      email: data.email,
    });
  } catch (error) {
    await logAttempt(serviceClient, {
      emailHash,
      ipHash,
      origin,
      status: "invalid",
      userAgent,
    });

    return jsonResponse(request, { success: false, error: "Nao foi possivel concluir o cadastro." }, 400);
  }
});
