import { createClient } from "npm:@supabase/supabase-js@2";

import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type DesktopActivationStatusRequest = {
  ownerUserId?: string | null;
  storeAccountId?: string | null;
  installationId?: string | null;
  appContext?: string | null;
  installerToken?: string | null;
};

type DesktopActivationRow = {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  installation_id: string;
  terminal_id: string | null;
};

type PosTerminalRow = {
  id: string;
  location_id: string;
  active: boolean;
  installation_id: string | null;
};

type StoreLocationRow = {
  id: string;
  active: boolean;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const parseRequest = async (request: Request): Promise<DesktopActivationStatusRequest | null> => {
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

const normalizeUuid = (value: string | null | undefined) => {
  const normalized = normalizeOptionalText(value, 80);
  return normalized && uuidPattern.test(normalized) ? normalized : null;
};

const revokedResponse = (request: Request, code: string) => jsonResponse(request, {
  active: false,
  revoked: true,
  code,
});

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
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: "Configuracao do Supabase invalida." }, 500);
  }

  const body = await parseRequest(request);
  const ownerUserId = normalizeUuid(body?.ownerUserId);
  const storeAccountId = normalizeUuid(body?.storeAccountId);
  const installationId = normalizeOptionalText(body?.installationId, 120);
  const appContext = normalizeOptionalText(body?.appContext, 40) ?? "happycash";

  if (appContext !== "happycash") {
    return revokedResponse(request, "INVALID_APP_CONTEXT");
  }

  if (!ownerUserId || !storeAccountId || !installationId) {
    return revokedResponse(request, "INVALID_ACTIVATION_PAYLOAD");
  }

  const rateLimit = await checkRedisRateLimit(request, {
    namespace: "desktop-activation-status",
    identifier: `${storeAccountId}:${installationId}`,
    limit: readRateLimitEnv("DESKTOP_ACTIVATION_STATUS_RATE_LIMIT_PER_MINUTE", 60),
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      request,
      {
        active: false,
        revoked: false,
        error: "Muitas validacoes desta maquina em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: activationData, error: activationError } = await serviceClient
    .from("desktop_machine_activations")
    .select("id, store_account_id, owner_user_id, installation_id, terminal_id")
    .eq("owner_user_id", ownerUserId)
    .eq("store_account_id", storeAccountId)
    .eq("installation_id", installationId)
    .eq("app_context", "happycash")
    .maybeSingle();

  if (activationError) {
    return jsonResponse(request, {
      active: false,
      revoked: false,
      code: "ACTIVATION_LOOKUP_FAILED",
      error: "Nao foi possivel validar a ativacao desta maquina agora.",
    }, 503);
  }

  const activation = (activationData as DesktopActivationRow | null) ?? null;
  if (!activation) {
    return revokedResponse(request, "DESKTOP_ACTIVATION_NOT_FOUND");
  }

  let terminalQuery = serviceClient
    .from("pos_terminals")
    .select("id, location_id, active, installation_id")
    .eq("owner_user_id", ownerUserId)
    .eq("store_account_id", storeAccountId);

  terminalQuery = activation.terminal_id
    ? terminalQuery.eq("id", activation.terminal_id)
    : terminalQuery.eq("installation_id", installationId);

  const { data: terminalData, error: terminalError } = await terminalQuery.maybeSingle();

  if (terminalError) {
    return jsonResponse(request, {
      active: false,
      revoked: false,
      code: "TERMINAL_LOOKUP_FAILED",
      error: "Nao foi possivel validar o terminal desta maquina agora.",
    }, 503);
  }

  const terminal = (terminalData as PosTerminalRow | null) ?? null;
  if (!terminal || !terminal.active || terminal.installation_id !== installationId) {
    return revokedResponse(request, "DESKTOP_TERMINAL_REVOKED");
  }

  const { data: locationData, error: locationError } = await serviceClient
    .from("store_locations")
    .select("id, active")
    .eq("owner_user_id", ownerUserId)
    .eq("store_account_id", storeAccountId)
    .eq("id", terminal.location_id)
    .maybeSingle();

  if (locationError) {
    return jsonResponse(request, {
      active: false,
      revoked: false,
      code: "LOCATION_LOOKUP_FAILED",
      error: "Nao foi possivel validar a filial desta maquina agora.",
    }, 503);
  }

  const location = (locationData as StoreLocationRow | null) ?? null;
  if (!location?.active) {
    return revokedResponse(request, "DESKTOP_LOCATION_REVOKED");
  }

  return jsonResponse(request, {
    active: true,
    revoked: false,
    code: "OK",
  });
});
