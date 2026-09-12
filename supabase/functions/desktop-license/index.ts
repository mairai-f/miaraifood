import { createClient } from "npm:@supabase/supabase-js@2";

import { validateDesktopLicense } from "../_shared/desktopAccess.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type DesktopLicenseRequest = {
  desktopInstallationId?: string | null;
  desktopStoreAccountId?: string | null;
  desktopAppContext?: string | null;
};

type ProfileOwnershipRow = {
  role: string | null;
  owner_user_id: string | null;
};

type DesktopActivationRow = {
  id: string;
  store_account_id: string;
  terminal_id: string | null;
};

type PosTerminalActivationRow = {
  id: string;
  active: boolean;
  installation_id: string | null;
};

const staffRoles = new Set(["operator", "waiter", "hr"]);

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

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const parseRequest = async (request: Request): Promise<DesktopLicenseRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const normalizeOptionalText = (value: string | null | undefined, maxLength: number) => {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = extractAccessToken(request.headers.get("Authorization"));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: "Configuracao do Supabase invalida." }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: "Sessao invalida. Faca login novamente." }, 401);
  }

  const body = await parseRequest(request);

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "desktop-license",
    limit: readRateLimitEnv("DESKTOP_LICENSE_RATE_LIMIT_PER_MINUTE", 120),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitas validacoes de licenca em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
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
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse(request, { error: "Sessao invalida. Faca login novamente." }, 401);
  }

  const { data: profileData, error: profileError } = await serviceClient
    .from("profiles")
    .select("role, owner_user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(request, { error: "Nao foi possivel identificar o usuario desta sessao." }, 500);
  }

  const profile = (profileData as ProfileOwnershipRow | null) ?? null;
  const ownerUserId = profile?.role && staffRoles.has(profile.role) && profile.owner_user_id
    ? profile.owner_user_id
    : user.id;
  const desktopAppContext = normalizeOptionalText(body?.desktopAppContext, 40) ?? "happycash";
  const runtimeLabel = desktopAppContext === "mobile" ? "app Android" : "desktop";

  const license = await validateDesktopLicense(serviceClient, user.id);

  if (!license.ok) {
    const runtimeLicenseError = license.code === "PRO_ACTIVE_REQUIRED"
      ? `O ${runtimeLabel} do MIAR AI/FOOD libera somente apos a confirmacao do pagamento do plano PRO.`
      : `Nao foi possivel validar sua licenca do ${runtimeLabel} agora.`;

    return jsonResponse(
      request,
      {
        licensed: false,
        error: runtimeLicenseError,
        code: license.code,
        planId: license.planId,
        status: license.status,
        validUntil: license.validUntil,
        features: license.features,
        offlineEnabled: license.offlineEnabled,
      },
      403,
    );
  }

  // A licenca segue o login e o plano do estabelecimento. Nao exigimos mais
  // ativar cada maquina com chave: desktopInstallationId ainda chega no corpo
  // por compatibilidade, mas nao bloqueia mais o uso do aplicativo.

  return jsonResponse(request, {
    licensed: true,
    planId: license.planId,
    status: license.status,
    validUntil: license.validUntil,
    features: license.features,
    offlineEnabled: license.offlineEnabled,
  });
});
