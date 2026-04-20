import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

type SupportedPlatform = "windows" | "linux";

interface DesktopDownloadRequest {
  platform?: SupportedPlatform;
}

interface StoreSubscriptionRow {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
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

const supportedPlatforms = new Set<SupportedPlatform>(["windows", "linux"]);
const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);
const bucketEnvKey = "DESKTOP_DOWNLOAD_BUCKET";
const platformEnvKeys: Record<SupportedPlatform, string> = {
  windows: "DESKTOP_WINDOWS_OBJECT_PATH",
  linux: "DESKTOP_LINUX_OBJECT_PATH",
};

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const getSubscriptionEndAt = (subscription: StoreSubscriptionRow | null | undefined) => {
  if (!subscription) return null;

  if (subscription.status === "trialing") {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }

  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

const isCurrentSubscription = (subscription: StoreSubscriptionRow | null | undefined) => {
  if (!subscription || !activeSubscriptionStatuses.has(subscription.status)) return false;

  const endAt = getSubscriptionEndAt(subscription);
  if (!endAt) return true;

  return new Date(endAt).getTime() > Date.now();
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

  let body: DesktopDownloadRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload inválido." }, 400);
  }

  const platform = body.platform;

  if (!platform || !supportedPlatforms.has(platform)) {
    return jsonResponse(request, { error: "Plataforma inválida." }, 400);
  }

  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from("store_subscriptions")
    .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (subscriptionsError) {
    return jsonResponse(request, { error: "Não foi possível validar seu plano agora." }, 500);
  }

  const currentSubscription =
    ((subscriptions as StoreSubscriptionRow[] | null) ?? []).find(isCurrentSubscription) ||
    ((subscriptions as StoreSubscriptionRow[] | null) ?? [])[0] ||
    null;

  if (!currentSubscription || currentSubscription.plan_id !== "pro" || !isCurrentSubscription(currentSubscription)) {
    return jsonResponse(
      request,
      {
        error: "Download disponível apenas para contas com plano PRO ativo.",
        code: "PRO_REQUIRED",
      },
      403,
    );
  }

  const bucketName = Deno.env.get(bucketEnvKey)?.trim() || "desktop-downloads";
  const objectPathKey = platformEnvKeys[platform];
  const objectPath = Deno.env.get(objectPathKey)?.trim();

  if (!objectPath) {
    return jsonResponse(
      request,
      {
        error: "O arquivo desta plataforma ainda não foi configurado.",
        code: "DOWNLOAD_NOT_CONFIGURED",
        requiredEnv: [bucketEnvKey, objectPathKey],
      },
      503,
    );
  }

  const expiresIn = Math.min(
    Math.max(Number(Deno.env.get("DESKTOP_DOWNLOAD_SIGNED_URL_TTL") || "90"), 30),
    600,
  );

  const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
    .from(bucketName)
    .createSignedUrl(objectPath, expiresIn);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return jsonResponse(
      request,
      {
        error: "O arquivo protegido não foi encontrado no storage.",
        code: "DOWNLOAD_FILE_MISSING",
        requiredEnv: [bucketEnvKey, objectPathKey],
      },
      404,
    );
  }

  return jsonResponse(request, {
    success: true,
    downloadUrl: signedUrlData.signedUrl,
    expiresIn,
  });
});
