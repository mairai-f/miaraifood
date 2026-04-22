import { createClient } from "npm:@supabase/supabase-js@2";

import type { AsaasWebhookPayload } from "../_shared/asaas.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface StoreSubscriptionRow {
  id: string;
  owner_user_id: string;
  store_account_id: string;
  plan_id: string;
  status: string;
  provider_payment_id: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface SubscriptionPlanRow {
  id: string;
  duration_days: number;
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

const activeSubscriptionStatuses = ["trialing", "active", "past_due"];

const parseWebhookDate = (value?: string | null) => {
  if (!value) return new Date();

  const normalized = (value.includes("T") ? value : value.replace(" ", "T")).trim();
  const withTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}-03:00`;
  const resolved = new Date(withTimezone);
  return Number.isNaN(resolved.getTime()) ? new Date() : resolved;
};

const mergeMetadata = (
  currentMetadata: Record<string, unknown> | null | undefined,
  nextMetadata: Record<string, unknown>,
) => ({
  ...(currentMetadata || {}),
  ...nextMetadata,
});

const resolveSubscription = async (
  serviceClient: ReturnType<typeof createClient>,
  paymentId: string,
  externalReference?: string | null,
) => {
  if (externalReference) {
    const { data, error } = await serviceClient
      .from("store_subscriptions")
      .select("id, owner_user_id, store_account_id, plan_id, status, provider_payment_id, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, metadata")
      .eq("id", externalReference)
      .maybeSingle();

    if (!error && data) {
      return data as StoreSubscriptionRow;
    }
  }

  const { data, error } = await serviceClient
    .from("store_subscriptions")
    .select("id, owner_user_id, store_account_id, plan_id, status, provider_payment_id, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, metadata")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();

  if (error || !data) return null;
  return data as StoreSubscriptionRow;
};

const activateSubscriptionFromPayment = async (
  serviceClient: ReturnType<typeof createClient>,
  subscription: StoreSubscriptionRow,
  webhook: AsaasWebhookPayload,
) => {
  const payment = webhook.payment;
  if (!payment?.id) return;

  const { data: planData, error: planError } = await serviceClient
    .from("subscription_plans")
    .select("id, duration_days")
    .eq("id", subscription.plan_id)
    .single();

  if (planError || !planData) {
    throw new Error(planError?.message || "Plano da assinatura não encontrado.");
  }

  const plan = planData as SubscriptionPlanRow;
  const startAt = parseWebhookDate(webhook.dateCreated);
  const endAt = new Date(startAt.getTime() + Math.max(1, Number(plan.duration_days || 30)) * 24 * 60 * 60 * 1000);

  await serviceClient
    .from("store_subscriptions")
    .update({
      status: "expired",
      current_period_ends_at: startAt.toISOString(),
      trial_ends_at: startAt.toISOString(),
      metadata: {
        replaced_at: startAt.toISOString(),
        replaced_by_subscription_id: subscription.id,
        replaced_by_payment_id: payment.id,
      },
    })
    .eq("owner_user_id", subscription.owner_user_id)
    .in("status", activeSubscriptionStatuses)
    .neq("id", subscription.id);

  const nextMetadata = mergeMetadata(subscription.metadata, {
    activated_at: startAt.toISOString(),
    activated_from_payment_id: payment.id,
    asaas_payment_status: payment.status || "RECEIVED",
    asaas_last_event: webhook.event,
    asaas_last_event_id: webhook.id,
    asaas_last_event_at: webhook.dateCreated || startAt.toISOString(),
    asaas_payment_snapshot: payment,
  });

  await serviceClient
    .from("store_subscriptions")
    .update({
      status: "active",
      provider_payment_id: payment.id,
      current_period_starts_at: startAt.toISOString(),
      current_period_ends_at: endAt.toISOString(),
      trial_started_at: null,
      trial_ends_at: null,
      metadata: nextMetadata,
    })
    .eq("id", subscription.id);
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
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_AUTH_TOKEN");
  const incomingWebhookToken = request.headers.get("asaas-access-token");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: "Configuração do Supabase inválida." }, 500);
  }

  if (!webhookToken) {
    return jsonResponse(request, { error: "ASAAS_WEBHOOK_AUTH_TOKEN não configurado." }, 500);
  }

  if (!incomingWebhookToken || incomingWebhookToken !== webhookToken) {
    return jsonResponse(request, { error: "Webhook não autorizado." }, 401);
  }

  let body: AsaasWebhookPayload;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload inválido." }, 400);
  }

  if (!body?.id || !body?.event || !body?.payment?.id) {
    return jsonResponse(request, { received: true });
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: logError } = await serviceClient
    .from("billing_webhook_events")
    .insert({
      provider: "asaas",
      provider_event_id: body.id,
      event_type: body.event,
      payload: body,
    });

  if (logError && logError.code === "23505") {
    return jsonResponse(request, { received: true, duplicate: true });
  }

  if (logError) {
    console.error("Falha ao registrar webhook do Asaas:", logError);
    return jsonResponse(request, { error: "Não foi possível registrar o evento recebido." }, 500);
  }

  const subscription = await resolveSubscription(
    serviceClient,
    body.payment.id,
    body.payment.externalReference || null,
  );

  if (!subscription) {
    return jsonResponse(request, { received: true, ignored: true });
  }

  try {
    const paymentStatus = (body.payment.status || "").toUpperCase();

    if (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") {
      if (subscription.status === "canceled" || subscription.status === "expired") {
        return jsonResponse(request, { received: true, ignored: true });
      }

      await activateSubscriptionFromPayment(serviceClient, subscription, body);
      return jsonResponse(request, { received: true, activated: true });
    }

    if (
      body.event === "PAYMENT_CREATED" ||
      body.event === "PAYMENT_UPDATED" ||
      body.event === "PAYMENT_OVERDUE" ||
      body.event === "PAYMENT_AWAITING_RISK_ANALYSIS" ||
      body.event === "PAYMENT_APPROVED_BY_RISK_ANALYSIS" ||
      body.event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS" ||
      body.event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
    ) {
      await serviceClient
        .from("store_subscriptions")
        .update({
          provider_payment_id: body.payment.id,
          metadata: mergeMetadata(subscription.metadata, {
            asaas_payment_status: paymentStatus || body.event,
            asaas_last_event: body.event,
            asaas_last_event_id: body.id,
            asaas_last_event_at: body.dateCreated || new Date().toISOString(),
            asaas_payment_snapshot: body.payment,
          }),
        })
        .eq("id", subscription.id);

      return jsonResponse(request, { received: true, updated: true });
    }

    if (body.event === "PAYMENT_DELETED" && subscription.status === "pending") {
      await serviceClient
        .from("store_subscriptions")
        .update({
          status: "canceled",
          metadata: mergeMetadata(subscription.metadata, {
            asaas_payment_status: "DELETED",
            asaas_last_event: body.event,
            asaas_last_event_id: body.id,
            asaas_last_event_at: body.dateCreated || new Date().toISOString(),
            cancelled_at: new Date().toISOString(),
          }),
        })
        .eq("id", subscription.id);
    }

    return jsonResponse(request, { received: true });
  } catch (error) {
    await serviceClient
      .from("billing_webhook_events")
      .delete()
      .eq("provider", "asaas")
      .eq("provider_event_id", body.id);

    console.error("Falha ao processar webhook do Asaas:", error);
    return jsonResponse(
      request,
      {
        error: error instanceof Error ? error.message : "Não foi possível processar o webhook.",
      },
      500,
    );
  }
});
