import { createClient } from "npm:@supabase/supabase-js@2";

import { validateDesktopLicense } from "../_shared/desktopAccess.ts";
import { upsertDesktopLicenseKey } from "../_shared/desktopLicenseKey.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

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

  const license = await validateDesktopLicense(serviceClient, user.id);

  if (!license.ok || !license.subscriptionId || !license.ownerUserId) {
    return jsonResponse(
      request,
      {
        success: false,
        error: license.message || "A chave fica disponivel apenas apos pagamento do Plano PRO.",
        code: license.code || "PRO_REQUIRED",
        planId: license.planId,
        status: license.status,
        validUntil: license.validUntil,
      },
      403,
    );
  }

  const generated = await upsertDesktopLicenseKey(serviceClient, {
    id: license.subscriptionId,
    owner_user_id: license.ownerUserId,
    plan_id: license.planId || "pro",
    status: license.status || "active",
    current_period_ends_at: license.validUntil,
  });

  return jsonResponse(request, {
    success: true,
    licenseKey: generated.licenseKey,
    keyPrefix: generated.keyPrefix,
    keySuffix: generated.keySuffix,
    planId: license.planId,
    validUntil: license.validUntil,
    offlineGraceUntil: license.offlineGraceUntil,
    offlineGraceDays: license.offlineGraceDays,
  });
});
