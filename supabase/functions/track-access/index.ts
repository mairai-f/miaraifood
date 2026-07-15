import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type AccessEventType = "heartbeat" | "logout";
type AccessSource = "system" | "site";
type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";
type UserRole = "admin" | "operator" | "waiter" | "hr";
const normalizeUserRole = (value: string | null | undefined): UserRole => {
  if (value === "operator" || value === "waiter" || value === "hr") return value;
  return "admin";
};

interface TrackAccessRequest {
  eventType?: AccessEventType;
  source?: AccessSource;
  clientSessionId?: string;
  metadata?: Record<string, unknown> | null;
}

interface AccessProfileRow {
  role: string | null;
  owner_user_id: string | null;
  username: string | null;
  email: string | null;
}

interface AccessSessionRow {
  id: string;
  login_at: string;
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

const normalizeSource = (value?: string | null): AccessSource =>
  value === "site" ? "site" : "system";

const normalizeEventType = (value?: string | null): AccessEventType =>
  value === "logout" ? "logout" : "heartbeat";

const extractIpAddress = (request: Request) => {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const firstIp = candidate.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return null;
};

const detectDeviceType = (userAgent: string): DeviceType => {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod|phone/i.test(ua)) return "mobile";
  if (/windows|macintosh|linux|x11|cros/i.test(ua)) return "desktop";
  return "unknown";
};

const detectBrowser = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (!ua) return "Desconhecido";
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("electron/")) return "Electron";
  return "Desconhecido";
};

const detectOs = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (!ua) return "Desconhecido";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("cros")) return "Chrome OS";
  if (ua.includes("linux")) return "Linux";
  return "Desconhecido";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, {
      allowedMethods: ["POST", "OPTIONS"],
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Método não suportado." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = extractAccessToken(request.headers.get("Authorization"));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: "Configuração do Supabase inválida." }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: "Sessão inválida. Faça login novamente." }, 401);
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
    return jsonResponse(request, { error: "Sessão inválida. Faça login novamente." }, 401);
  }

  let body: TrackAccessRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload inválido." }, 400);
  }

  const clientSessionId = body.clientSessionId?.trim();
  if (!clientSessionId) {
    return jsonResponse(request, { error: "Sessão do cliente não informada." }, 400);
  }

  const eventType = normalizeEventType(body.eventType);
  const source = normalizeSource(body.source);

  const { data: profileData, error: profileError } = await serviceClient
    .from("profiles")
    .select("role, owner_user_id, username, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(request, { error: "Não foi possível identificar o usuário." }, 500);
  }

  const profile = (profileData as AccessProfileRow | null) || null;
  const role = normalizeUserRole(profile?.role);
  const ownerUserId = profile?.owner_user_id ?? user.id;
  const username = profile?.username ?? null;
  const email = profile?.email ?? user.email ?? null;

  const userAgent = request.headers.get("user-agent") || "";
  const deviceType = detectDeviceType(userAgent);
  const browserName = detectBrowser(userAgent);
  const osName = detectOs(userAgent);
  const ipAddress = extractIpAddress(request);
  const countryCode = request.headers.get("cf-ipcountry") || null;
  const now = new Date().toISOString();

  const { data: existingSessionData, error: existingSessionError } = await serviceClient
    .from("access_sessions")
    .select("id, login_at")
    .eq("owner_user_id", ownerUserId)
    .eq("user_id", user.id)
    .eq("source", source)
    .eq("client_session_id", clientSessionId)
    .maybeSingle();

  if (existingSessionError) {
    return jsonResponse(request, { error: "Não foi possível carregar a sessão de acesso." }, 500);
  }

  const existingSession = (existingSessionData as AccessSessionRow | null) || null;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!existingSession && eventType === "logout") {
    return jsonResponse(request, { success: true, ignored: true });
  }

  let accessSessionId = existingSession?.id ?? null;

  if (!existingSession) {
    const { data: insertedSession, error: insertSessionError } = await serviceClient
      .from("access_sessions")
      .insert({
        owner_user_id: ownerUserId,
        user_id: user.id,
        role,
        username,
        email,
        source,
        client_session_id: clientSessionId,
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        ip_address: ipAddress,
        country_code: countryCode,
        user_agent: userAgent || null,
        login_at: now,
        last_seen_at: now,
        ended_at: null,
        metadata,
      })
      .select("id")
      .single();

    if (insertSessionError || !insertedSession) {
      return jsonResponse(request, { error: "Não foi possível criar a sessão de acesso." }, 500);
    }

    accessSessionId = (insertedSession as { id: string }).id;

    const { error: insertLogError } = await serviceClient
      .from("access_logs")
      .insert({
        access_session_id: accessSessionId,
        owner_user_id: ownerUserId,
        user_id: user.id,
        role,
        username,
        email,
        source,
        event_type: "login",
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        ip_address: ipAddress,
        country_code: countryCode,
        user_agent: userAgent || null,
        occurred_at: now,
        metadata,
      });

    if (insertLogError) {
      return jsonResponse(request, { error: "Não foi possível registrar o login." }, 500);
    }

    return jsonResponse(request, { success: true, eventType: "login" });
  }

  const { error: updateSessionError } = await serviceClient
    .from("access_sessions")
    .update({
      role,
      username,
      email,
      device_type: deviceType,
      os_name: osName,
      browser_name: browserName,
      ip_address: ipAddress,
      country_code: countryCode,
      user_agent: userAgent || null,
      last_seen_at: now,
      ended_at: eventType === "logout" ? now : null,
      metadata,
    })
    .eq("id", existingSession.id);

  if (updateSessionError) {
    return jsonResponse(request, { error: "Não foi possível atualizar a sessão de acesso." }, 500);
  }

  if (eventType === "logout") {
    const { error: logoutLogError } = await serviceClient
      .from("access_logs")
      .insert({
        access_session_id: existingSession.id,
        owner_user_id: ownerUserId,
        user_id: user.id,
        role,
        username,
        email,
        source,
        event_type: "logout",
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        ip_address: ipAddress,
        country_code: countryCode,
        user_agent: userAgent || null,
        occurred_at: now,
        metadata,
      });

    if (logoutLogError) {
      return jsonResponse(request, { error: "Não foi possível registrar o logout." }, 500);
    }
  }

  return jsonResponse(request, { success: true, eventType });
});
