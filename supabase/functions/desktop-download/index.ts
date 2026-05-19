import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { validateDesktopLicense, type SupportedDesktopPlatform } from "../_shared/desktopAccess.ts";
import { fetchLatestDesktopReleaseAsset, type DesktopReleaseContext } from "../_shared/githubRelease.ts";

interface DesktopDownloadRequest {
  platform?: SupportedDesktopPlatform;
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

const supportedPlatforms = new Set<SupportedDesktopPlatform>(["windows", "linux", "linux-deb", "linux-appimage"]);
const contextBucketEnvKeys: Record<DesktopReleaseContext, string> = {
  happycash: "DESKTOP_DOWNLOAD_BUCKET",
  happycashfood: "FOOD_DOWNLOAD_BUCKET",
};
const contextPlatformEnvKeys: Record<DesktopReleaseContext, Record<SupportedDesktopPlatform, string>> = {
  happycash: {
    windows: "DESKTOP_WINDOWS_OBJECT_PATH",
    linux: "DESKTOP_LINUX_DEB_OBJECT_PATH",
    "linux-deb": "DESKTOP_LINUX_DEB_OBJECT_PATH",
    "linux-appimage": "DESKTOP_LINUX_APPIMAGE_OBJECT_PATH",
  },
  happycashfood: {
    windows: "FOOD_WINDOWS_OBJECT_PATH",
    linux: "FOOD_LINUX_DEB_OBJECT_PATH",
    "linux-deb": "FOOD_LINUX_DEB_OBJECT_PATH",
    "linux-appimage": "FOOD_LINUX_APPIMAGE_OBJECT_PATH",
  },
};

const releaseProvider = (context: DesktopReleaseContext) => (
  context === "happycashfood"
    ? (Deno.env.get("FOOD_DESKTOP_RELEASE_PROVIDER") || Deno.env.get("DESKTOP_RELEASE_PROVIDER") || "github").trim().toLowerCase()
    : (Deno.env.get("DESKTOP_RELEASE_PROVIDER") || "github").trim().toLowerCase()
);

const resolveDownloadContext = (planId?: string | null): DesktopReleaseContext =>
  planId === "food_offline" ? "happycashfood" : "happycash";

const resolveDefaultBucketName = (context: DesktopReleaseContext) =>
  context === "happycashfood" ? "happycashfood-downloads" : "desktop-downloads";

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
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

  const license = await validateDesktopLicense(serviceClient, user.id);

  if (!license.ok) {
    return jsonResponse(
      request,
      {
        error: "Nao foi possivel liberar o download desktop para esta conta.",
        code: license.code,
        planId: license.planId,
        validUntil: license.validUntil,
        offlineEnabled: license.offlineEnabled,
      },
      403,
    );
  }

  const downloadContext = resolveDownloadContext(license.planId);
  const bucketEnvKey = contextBucketEnvKeys[downloadContext];
  const objectPathKey = contextPlatformEnvKeys[downloadContext][platform];

  if (releaseProvider(downloadContext) === "github") {
    try {
      const release = await fetchLatestDesktopReleaseAsset(platform, downloadContext);

      return jsonResponse(request, {
        success: true,
        downloadUrl: release.downloadUrl,
        assetName: release.assetName,
        releaseTag: release.tag,
        releaseVersion: release.version,
        publishedAt: release.publishedAt,
        size: release.size,
        offlineEnabled: license.offlineEnabled,
        validUntil: license.validUntil,
      });
    } catch (error) {
      console.error("GitHub desktop release lookup failed:", error);
    }
  }

  const bucketName = Deno.env.get(bucketEnvKey)?.trim() || resolveDefaultBucketName(downloadContext);
  const objectPath = Deno.env.get(objectPathKey)?.trim();
  if (!objectPath) {
    return jsonResponse(
      request,
      {
        error: "O release desta plataforma ainda nao foi configurado.",
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
    offlineEnabled: license.offlineEnabled,
    validUntil: license.validUntil,
  });
});
