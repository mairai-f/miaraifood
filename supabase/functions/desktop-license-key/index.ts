import { createClient } from "npm:@supabase/supabase-js@2";

import { validateDesktopLicense } from "../_shared/desktopAccess.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeProductContext, type ProductContext } from "../_shared/productContext.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type DesktopLicenseKeyRequest = {
  productContext?: string | null;
};

type StoreAccountRow = {
  id: string;
  owner_user_id: string;
  nome_estabelecimento: string | null;
  nome_cliente: string | null;
  desktop_license_key: string | null;
  product_context: ProductContext | null;
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

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const parseRequest = async (request: Request): Promise<DesktopLicenseKeyRequest> => {
  try {
    return await request.json();
  } catch {
    return {};
  }
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

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "desktop-license-key",
    limit: readRateLimitEnv("DESKTOP_LICENSE_KEY_RATE_LIMIT_PER_MINUTE", 30),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitas consultas da chave desktop em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const body = await parseRequest(request);
  const requestedProductContext = normalizeProductContext(body.productContext);

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

  const { data: storeAccount, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("id, owner_user_id, nome_estabelecimento, nome_cliente, desktop_license_key, product_context")
    .eq("owner_user_id", user.id)
    .eq("product_context", requestedProductContext)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeAccountError) {
    return jsonResponse(request, { error: "Nao foi possivel validar a empresa desta sessao agora." }, 503);
  }

  if (!storeAccount) {
    return jsonResponse(request, { error: "Nenhuma empresa deste produto foi encontrada para sua sessao." }, 404);
  }

  const account = storeAccount as StoreAccountRow;

  if (account.owner_user_id !== user.id) {
    return jsonResponse(request, { error: "Somente o dono da empresa pode visualizar esta chave." }, 403);
  }

  const accountProductContext = normalizeProductContext(account.product_context);

  if (accountProductContext !== requestedProductContext) {
    return jsonResponse(request, { error: "Esta chave pertence a outro produto MIAR AI/FOOD." }, 403);
  }

  const license = await validateDesktopLicense(serviceClient, user.id, accountProductContext);

  if (!license.ok) {
    return jsonResponse(
      request,
      {
        success: false,
        error: license.message || "O plano atual nao possui licenca desktop ativa.",
        code: license.code,
        planId: license.planId,
        status: license.status,
        validUntil: license.validUntil,
        offlineEnabled: license.offlineEnabled,
      },
      403,
    );
  }

  const licenseKey = account.desktop_license_key?.trim();

  if (!licenseKey) {
    return jsonResponse(request, { error: "A empresa ainda nao possui uma chave desktop gerada." }, 404);
  }

  const companyName = account.nome_estabelecimento?.trim()
    || account.nome_cliente?.trim()
    || "Empresa sem nome";

  return jsonResponse(request, {
    success: true,
    licenseKey,
    storeAccountId: account.id,
    companyName,
    planId: license.planId,
    status: license.status,
    validUntil: license.validUntil,
    offlineEnabled: license.offlineEnabled,
    productContext: accountProductContext,
  });
});
