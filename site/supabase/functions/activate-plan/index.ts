import { createClient } from "npm:@supabase/supabase-js@2";

type SupportedPaidPlan = "fiado" | "completo" | "pro";

interface ActivatePlanRequest {
  planId?: SupportedPaidPlan;
}

interface PlanRow {
  id: SupportedPaidPlan;
  name: string;
  price: number;
  currency: string;
  duration_days: number;
}

interface StoreAccountRow {
  id: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const supportedPlans = new Set<SupportedPaidPlan>(["fiado", "completo", "pro"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não suportado." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = extractAccessToken(request.headers.get("Authorization"));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Configuração do Supabase inválida." }, 500);
  }

  if (!accessToken) {
    return jsonResponse({ error: "Sessão inválida. Faça login novamente." }, 401);
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
    return jsonResponse({ error: "Sessão inválida. Faça login novamente." }, 401);
  }

  let body: ActivatePlanRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Payload inválido." }, 400);
  }

  const planId = body.planId;

  if (!planId || !supportedPlans.has(planId)) {
    return jsonResponse({ error: "Plano inválido." }, 400);
  }

  const { data: plan, error: planError } = await serviceClient
    .from("subscription_plans")
    .select("id, name, price, currency, duration_days")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return jsonResponse({ error: "Plano não encontrado." }, 404);
  }

  const { data: storeAccount, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (storeAccountError || !storeAccount) {
    return jsonResponse({ error: "Conta da loja não encontrada." }, 404);
  }

  const now = new Date();
  const durationDays = Math.max(1, Number((plan as PlanRow).duration_days || 30));
  const periodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const { error: closeCurrentError } = await serviceClient
    .from("store_subscriptions")
    .update({
      status: "expired",
      current_period_ends_at: now.toISOString(),
      trial_ends_at: now.toISOString(),
      metadata: {
        replaced_at: now.toISOString(),
        replaced_by_plan: planId,
      },
    })
    .eq("owner_user_id", user.id)
    .in("status", ["trialing", "active", "past_due"]);

  if (closeCurrentError) {
    return jsonResponse({ error: "Não foi possível encerrar o plano atual." }, 500);
  }

  const { data: createdSubscription, error: insertError } = await serviceClient
    .from("store_subscriptions")
    .insert({
      store_account_id: (storeAccount as StoreAccountRow).id,
      owner_user_id: user.id,
      plan_id: planId,
      provider: "manual",
      status: "active",
      billing_type: "PIX",
      price: (plan as PlanRow).price,
      currency: (plan as PlanRow).currency,
      current_period_starts_at: now.toISOString(),
      current_period_ends_at: periodEnd.toISOString(),
      external_reference: user.id,
      metadata: {
        source: "manual_plan_selection",
        manual_until_asaas: true,
        activated_at: now.toISOString(),
      },
    })
    .select("id, plan_id, current_period_starts_at, current_period_ends_at")
    .single();

  if (insertError || !createdSubscription) {
    return jsonResponse({ error: insertError?.message || "Não foi possível ativar o plano." }, 500);
  }

  return jsonResponse({
    success: true,
    subscription: createdSubscription,
    plan: {
      id: (plan as PlanRow).id,
      name: (plan as PlanRow).name,
      price: (plan as PlanRow).price,
      durationDays,
    },
  });
});
