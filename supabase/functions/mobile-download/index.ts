import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { validateDesktopLicense } from "../_shared/desktopAccess.ts";

interface MobileDownloadRequest {
  platform?: SupportedMobilePlatform;
}

interface MobileDownloadResponse {
  success?: boolean;
  downloadUrl?: string;
  expiresIn?: number;
  assetName?: string;
  error?: string;
  code?: string;
  requiredEnv?: string[];
  validUntil?: string | null;
}

type SupportedMobilePlatform = "android" | "ios";

const supportedPlatforms = new Set<SupportedMobilePlatform>(["android", "ios"]);
const bucketEnvKey = "MOBILE_DOWNLOAD_BUCKET";
const platformEnvKeys: Record<SupportedMobilePlatform, string> = {
  android: "ANDROID_APK_OBJECT_PATH",
  ios: "IOS_TESTFLIGHT_URL",
};

const releaseProvider = () => (Deno.env.get("MOBILE_RELEASE_PROVIDER") || "storage").trim().toLowerCase();

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

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

  let body: MobileDownloadRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload inválido." }, 400);
  }

  const platform = body.platform;

  if (!platform || !supportedPlatforms.has(platform)) {
    return jsonResponse(request, { error: "Plataforma inválida." }, 400);
  }

  const license = await validateDesktopLicense(serviceClient, user.id);

  if (!license.ok) {
    return jsonResponse(
      request,
      {
        error: license.message,
        code: license.code,
        planId: license.planId,
        status: license.status,
        validUntil: license.validUntil,
      },
      403,
    );
  }

  if (platform === "ios") {
    const testFlightUrl = Deno.env.get("IOS_TESTFLIGHT_URL")?.trim();

    if (!testFlightUrl) {
      return jsonResponse(
        request,
        {
          error: "O link do TestFlight iOS não foi configurado.",
          code: "DOWNLOAD_NOT_CONFIGURED",
          requiredEnv: [platformEnvKeys.ios],
        },
        503,
      );
    }

    return jsonResponse(request, {
      success: true,
      downloadUrl: testFlightUrl,
      validUntil: license.validUntil,
    });
  }

  const bucketName = Deno.env.get(bucketEnvKey)?.trim() || "mobile-downloads";
  const objectPathKey = platformEnvKeys[platform];
  const objectPath = Deno.env.get(objectPathKey)?.trim();

  if (!objectPath) {
    return jsonResponse(
      request,
      {
        error: "O release desta plataforma ainda não foi configurado.",
        code: "DOWNLOAD_NOT_CONFIGURED",
        requiredEnv: [bucketEnvKey, objectPathKey],
      },
      503,
    );
  }

  const expiresIn = Math.min(
    Math.max(Number(Deno.env.get("MOBILE_DOWNLOAD_SIGNED_URL_TTL") || "90"), 30),
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
    validUntil: license.validUntil,
  });
});
