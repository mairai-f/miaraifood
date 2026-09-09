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

const activationRevokedResponse = (request: Request, license: {
  planId?: string | null;
  status?: string | null;
  validUntil?: string | null;
  features?: string[];
  offlineEnabled?: boolean;
}) => jsonResponse(
  request,
  {
    licensed: false,
    error: "Esta maquina foi desvinculada pelo administrador. Ative novamente com a license key.",
    code: "DESKTOP_ACTIVATION_REVOKED",
    planId: license.planId ?? null,
    status: license.status ?? null,
    validUntil: license.validUntil ?? null,
    features: license.features ?? [],
    offlineEnabled: Boolean(license.offlineEnabled),
  },
  403,
);

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

  const desktopInstallationId = normalizeOptionalText(body?.desktopInstallationId, 120);
  const desktopStoreAccountId = normalizeOptionalText(body?.desktopStoreAccountId, 80);

  if (desktopAppContext === "happycash" && desktopInstallationId) {
    let activationQuery = serviceClient
      .from("desktop_machine_activations")
      .select("id, store_account_id, terminal_id")
      .eq("owner_user_id", ownerUserId)
      .eq("installation_id", desktopInstallationId)
      .eq("app_context", "happycash");

    if (desktopStoreAccountId) {
      activationQuery = activationQuery.eq("store_account_id", desktopStoreAccountId);
    }

    const { data: activationData, error: activationError } = await activationQuery.maybeSingle();
    if (activationError) {
      return jsonResponse(request, { error: "Nao foi possivel validar a ativacao desta maquina agora." }, 503);
    }

    const activation = (activationData as DesktopActivationRow | null) ?? null;
    if (!activation) {
      return activationRevokedResponse(request, license);
    }

    let terminalQuery = serviceClient
      .from("pos_terminals")
      .select("id, active, installation_id")
      .eq("owner_user_id", ownerUserId)
      .eq("store_account_id", activation.store_account_id);

    terminalQuery = activation.terminal_id
      ? terminalQuery.eq("id", activation.terminal_id)
      : terminalQuery.eq("installation_id", desktopInstallationId);

    const { data: terminalData, error: terminalError } = await terminalQuery.maybeSingle();
    if (terminalError) {
      return jsonResponse(request, { error: "Nao foi possivel validar o terminal desta maquina agora." }, 503);
    }

    const terminal = (terminalData as PosTerminalActivationRow | null) ?? null;
    if (!terminal || !terminal.active || terminal.installation_id !== desktopInstallationId) {
      return activationRevokedResponse(request, license);
    }
  }

  return jsonResponse(request, {
    licensed: true,
    planId: license.planId,
    status: license.status,
    validUntil: license.validUntil,
    features: license.features,
    offlineEnabled: license.offlineEnabled,
  });
});
