import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { validateDesktopLicense } from "../_shared/desktopAccess.ts";
import { fetchLatestMobileReleaseAsset, type DesktopReleaseContext } from "../_shared/githubRelease.ts";

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
const contextBucketEnvKeys: Record<DesktopReleaseContext, string> = {
  happycash: "MOBILE_DOWNLOAD_BUCKET",
  happycashfood: "FOOD_MOBILE_DOWNLOAD_BUCKET",
};
const contextPlatformEnvKeys: Record<DesktopReleaseContext, Record<SupportedMobilePlatform, string>> = {
  happycash: {
    android: "ANDROID_APK_OBJECT_PATH",
    ios: "IOS_TESTFLIGHT_URL",
  },
  happycashfood: {
    android: "FOOD_ANDROID_APK_OBJECT_PATH",
    ios: "FOOD_IOS_TESTFLIGHT_URL",
  },
};
const contextDirectUrlEnvKeys: Record<DesktopReleaseContext, Record<SupportedMobilePlatform, string>> = {
  happycash: {
    android: "ANDROID_APK_URL",
    ios: "IOS_TESTFLIGHT_URL",
  },
  happycashfood: {
    android: "FOOD_ANDROID_APK_URL",
    ios: "FOOD_IOS_TESTFLIGHT_URL",
  },
};

const releaseProvider = (context: DesktopReleaseContext) => (
  context === "happycashfood"
    ? (Deno.env.get("FOOD_MOBILE_RELEASE_PROVIDER") || Deno.env.get("MOBILE_RELEASE_PROVIDER") || "storage").trim().toLowerCase()
    : (Deno.env.get("MOBILE_RELEASE_PROVIDER") || "storage").trim().toLowerCase()
);

const resolveDownloadContext = (planId?: string | null): DesktopReleaseContext =>
  planId === "food_offline" ? "happycashfood" : "happycash";

const resolveDefaultBucketName = (context: DesktopReleaseContext) =>
  context === "happycashfood" ? "happycashfood-mobile-downloads" : "mobile-downloads";

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

const isDirectDownloadUrlAvailable = async (url: string) => {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });

    if (response.ok) return true;

    if (response.status !== 405) {
      return false;
    }
  } catch {
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-0",
      },
      redirect: "follow",
    });

    return response.ok || response.status === 206;
  } catch {
    return false;
  }
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
        error: "Nao foi possivel liberar o download mobile para esta conta.",
        code: license.code,
        planId: license.planId,
        status: license.status,
        validUntil: license.validUntil,
      },
      403,
    );
  }

  const downloadContext = resolveDownloadContext(license.planId);
  const directUrlKey = contextDirectUrlEnvKeys[downloadContext][platform];
  const storagePathKey = contextPlatformEnvKeys[downloadContext][platform];
  const bucketEnvKey = contextBucketEnvKeys[downloadContext];

  if (platform === "ios") {
    const testFlightUrl = Deno.env.get(directUrlKey)?.trim() || Deno.env.get("IOS_TESTFLIGHT_URL")?.trim();

    if (!testFlightUrl) {
      return jsonResponse(
        request,
        {
          error: "O link do TestFlight iOS não foi configurado.",
          code: "DOWNLOAD_NOT_CONFIGURED",
          requiredEnv: [directUrlKey],
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

  if (releaseProvider(downloadContext) === "github") {
    try {
      const release = await fetchLatestMobileReleaseAsset(downloadContext);

      return jsonResponse(request, {
        success: true,
        downloadUrl: release.downloadUrl,
        assetName: release.assetName,
        releaseTag: release.tag,
        releaseVersion: release.version,
        publishedAt: release.publishedAt,
        validUntil: license.validUntil,
      });
    } catch (error) {
      console.error("GitHub mobile release lookup failed:", error);
    }
  }

  const apkUrl = Deno.env.get(directUrlKey)?.trim() || Deno.env.get("ANDROID_APK_URL")?.trim();
  if (apkUrl) {
    const directUrlAvailable = await isDirectDownloadUrlAvailable(apkUrl);

    if (!directUrlAvailable) {
      return jsonResponse(
        request,
        {
          error: "O link direto do APK esta configurado, mas o arquivo nao foi encontrado. Gere um novo APK e atualize a URL ou use um arquivo no Supabase Storage.",
          code: "DOWNLOAD_DIRECT_URL_INVALID",
          requiredEnv: [directUrlKey, storagePathKey],
        },
        404,
      );
    }

    return jsonResponse(request, {
      success: true,
      downloadUrl: apkUrl,
      assetName: downloadContext === "happycashfood" ? "HappyCashFood-Mobile.apk" : "HappyCash-Mobile.apk",
      validUntil: license.validUntil,
    });
  }

  const bucketName =
    Deno.env.get(bucketEnvKey)?.trim()
    || (downloadContext === "happycashfood" ? Deno.env.get("FOOD_DOWNLOAD_BUCKET")?.trim() : null)
    || Deno.env.get("MOBILE_DOWNLOAD_BUCKET")?.trim()
    || Deno.env.get("DESKTOP_DOWNLOAD_BUCKET")?.trim()
    || resolveDefaultBucketName(downloadContext);
  const objectPath = Deno.env.get(storagePathKey)?.trim();

  if (!objectPath) {
    return jsonResponse(
      request,
      {
        error: "O release desta plataforma ainda não foi configurado.",
        code: "DOWNLOAD_NOT_CONFIGURED",
        requiredEnv: [bucketEnvKey, storagePathKey, directUrlKey],
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
        requiredEnv: [bucketEnvKey, storagePathKey],
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
