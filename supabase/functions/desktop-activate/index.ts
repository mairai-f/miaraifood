import { createClient } from "npm:@supabase/supabase-js@2";

import { validateDesktopLicense } from "../_shared/desktopAccess.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { normalizeProductContext, type ProductContext } from "../_shared/productContext.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

type DesktopActivateRequest = {
  licenseKey?: string;
  installationId?: string;
  platform?: string | null;
  appVersion?: string | null;
  appContext?: string | null;
};

type StoreAccountRow = {
  id: string;
  owner_user_id: string;
  nome_estabelecimento: string | null;
  nome_cliente: string | null;
  cnpj: string | null;
  product_context: ProductContext;
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

const parseRequest = async (request: Request): Promise<DesktopActivateRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const normalizeLicenseKey = (value: string) => value.trim().toUpperCase();

const normalizeOptionalText = (value: string | null | undefined, maxLength: number) => {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeAppContext = (value: string | null | undefined) =>
  value?.trim().toLowerCase() === "happycashfood" ? "happycashfood" : "happycash";

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
  const licenseKey = normalizeLicenseKey(body?.licenseKey ?? "");
  const installationId = normalizeOptionalText(body?.installationId, 120);
  const platform = normalizeOptionalText(body?.platform, 40);
  const appVersion = normalizeOptionalText(body?.appVersion, 40);
  const appContext = normalizeAppContext(body?.appContext);

  if (!licenseKey) {
    return jsonResponse(request, { error: "Digite a chave da licenca desta empresa." }, 400);
  }

  if (!installationId) {
    return jsonResponse(request, { error: "Nao foi possivel identificar esta instalacao." }, 400);
  }

  const rateLimit = await checkRedisRateLimit(request, {
    namespace: "desktop-activate",
    identifier: appContext,
    limit: readRateLimitEnv("DESKTOP_ACTIVATE_RATE_LIMIT_PER_MINUTE", 8),
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitas tentativas de ativacao em pouco tempo. Aguarde alguns instantes e tente novamente.",
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

  const { data: storeAccount, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("id, owner_user_id, nome_estabelecimento, nome_cliente, cnpj, product_context")
    .eq("desktop_license_key", licenseKey)
    .maybeSingle();

  if (storeAccountError) {
    return jsonResponse(request, { error: "Nao foi possivel localizar a empresa desta chave agora." }, 503);
  }

  if (!storeAccount) {
    return jsonResponse(request, { error: "Chave da licenca nao encontrada para nenhuma empresa." }, 404);
  }

  const account = storeAccount as StoreAccountRow;
  const accountProductContext = normalizeProductContext(account.product_context);

  if (accountProductContext !== appContext) {
    return jsonResponse(
      request,
      {
        error: accountProductContext === "happycashfood"
          ? "Esta chave pertence ao HappyCashFood. Use o aplicativo HappyCashFood para ativar esta empresa."
          : "Esta chave pertence ao HappyCash. Use o aplicativo HappyCash para ativar esta empresa.",
      },
      403,
    );
  }

  const license = await validateDesktopLicense(serviceClient, account.owner_user_id, accountProductContext);

  if (!license.ok) {
    return jsonResponse(
      request,
      {
        error: "A empresa desta chave nao possui licenca desktop ativa.",
        code: license.code,
        planId: license.planId,
        validUntil: license.validUntil,
      },
      403,
    );
  }

  const companyName = account.nome_estabelecimento?.trim()
    || account.nome_cliente?.trim()
    || "Empresa sem nome";
  const now = new Date().toISOString();
  const { error: activationError } = await serviceClient
    .from("desktop_machine_activations")
    .upsert({
      store_account_id: account.id,
      owner_user_id: account.owner_user_id,
      app_context: appContext,
      installation_id: installationId,
      platform,
      app_version: appVersion,
      company_name: companyName,
      activated_at: now,
      last_seen_at: now,
      updated_at: now,
    }, {
      onConflict: "store_account_id,app_context,installation_id",
    });

  if (activationError) {
    return jsonResponse(request, { error: "A empresa foi reconhecida, mas nao foi possivel concluir a ativacao desta maquina." }, 503);
  }

  return jsonResponse(request, {
    success: true,
    ownerUserId: account.owner_user_id,
    storeAccountId: account.id,
    companyName,
    cnpj: account.cnpj ?? null,
    planId: license.planId,
    validUntil: license.validUntil,
    offlineEnabled: license.offlineEnabled,
    appContext,
  });
});
