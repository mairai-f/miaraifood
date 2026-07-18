import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type AccessEventType = "heartbeat" | "logout";
type UserRole = "admin" | "operator" | "waiter" | "hr";

interface TrackAccessRequest {
  eventType?: AccessEventType;
  source?: "system" | "site";
  clientSessionId?: string;
  desktopInstallationId?: string | null;
  desktopAppContext?: string | null;
  desktopStoreAccountId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface AccessProfileRow {
  role: string | null;
  owner_user_id: string | null;
  username: string | null;
  email: string | null;
}

interface DesktopActivationPresenceRow {
  id: string;
  store_account_id: string;
  current_user_id: string | null;
  current_session_started_at: string | null;
}

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

const normalizeUserRole = (value: string | null | undefined): UserRole => {
  if (value === "operator" || value === "waiter" || value === "hr") return value;
  return "admin";
};

const normalizeEventType = (value?: string | null): AccessEventType =>
  value === "logout" ? "logout" : "heartbeat";

const normalizeOptionalText = (value: unknown, maxLength = 120) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

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

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "track-access",
    limit: readRateLimitEnv("TRACK_ACCESS_RATE_LIMIT_PER_MINUTE", 300),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitos eventos de acesso em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  let body: TrackAccessRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload invalido." }, 400);
  }

  const desktopInstallationId = normalizeOptionalText(body.desktopInstallationId, 160);
  const desktopAppContext = normalizeOptionalText(body.desktopAppContext, 40);

  if (!desktopInstallationId || desktopAppContext !== "happycash" || body.source === "site") {
    return jsonResponse(request, {
      success: true,
      ignored: true,
      reason: "access_history_disabled",
    });
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
    .select("role, owner_user_id, username, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(request, { error: "Nao foi possivel identificar o usuario." }, 500);
  }

  const profile = (profileData as AccessProfileRow | null) || null;
  const role = normalizeUserRole(profile?.role);
  const ownerUserId = profile?.owner_user_id ?? user.id;
  const username = profile?.username ?? null;
  const email = profile?.email ?? user.email ?? null;
  const desktopStoreAccountId = normalizeOptionalText(body.desktopStoreAccountId, 80);

  let activationQuery = serviceClient
    .from("desktop_machine_activations")
    .select("id, store_account_id, current_user_id, current_session_started_at")
    .eq("owner_user_id", ownerUserId)
    .eq("installation_id", desktopInstallationId)
    .eq("app_context", "happycash");

  if (desktopStoreAccountId) {
    activationQuery = activationQuery.eq("store_account_id", desktopStoreAccountId);
  }

  const { data: activationData, error: activationError } = await activationQuery.maybeSingle();

  if (activationError) {
    return jsonResponse(request, { error: "Nao foi possivel carregar a maquina ativada." }, 500);
  }

  const activation = (activationData as DesktopActivationPresenceRow | null) || null;
  if (!activation) {
    return jsonResponse(request, {
      success: true,
      ignored: true,
      reason: "desktop_not_activated",
    });
  }

  const eventType = normalizeEventType(body.eventType);
  if (eventType === "logout" && activation.current_user_id && activation.current_user_id !== user.id) {
    return jsonResponse(request, {
      success: true,
      ignored: true,
      reason: "another_user_active_on_machine",
    });
  }

  const metadata = normalizeMetadata(body.metadata);
  const now = new Date().toISOString();
  const platform = normalizeOptionalText(metadata.platform, 40);
  const appVersion = normalizeOptionalText(metadata.appVersion, 40);
  const currentSessionStartedAt = activation.current_user_id === user.id && activation.current_session_started_at
    ? activation.current_session_started_at
    : now;

  const updatePayload: Record<string, unknown> = {
    last_seen_at: now,
    updated_at: now,
  };

  if (platform) updatePayload.platform = platform;
  if (appVersion) updatePayload.app_version = appVersion;

  if (eventType === "logout") {
    updatePayload.current_user_id = null;
    updatePayload.current_username = null;
    updatePayload.current_email = null;
    updatePayload.current_user_role = null;
    updatePayload.current_session_started_at = null;
    updatePayload.current_session_seen_at = null;
  } else {
    updatePayload.current_user_id = user.id;
    updatePayload.current_username = username;
    updatePayload.current_email = email;
    updatePayload.current_user_role = role;
    updatePayload.current_session_started_at = currentSessionStartedAt;
    updatePayload.current_session_seen_at = now;
  }

  const { error: updateActivationError } = await serviceClient
    .from("desktop_machine_activations")
    .update(updatePayload)
    .eq("id", activation.id);

  if (updateActivationError) {
    return jsonResponse(request, { error: "Nao foi possivel atualizar a presenca da maquina." }, 500);
  }

  return jsonResponse(request, {
    success: true,
    eventType,
    tracked: "desktop_machine",
  });
});
