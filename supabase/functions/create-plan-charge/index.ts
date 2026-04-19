import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createAsaasCustomer,
  createAsaasPayment,
  deleteAsaasPayment,
  getAsaasPayment,
  getAsaasPixQrCode,
  type AsaasPayment,
} from "../_shared/asaas.ts";

type SupportedPaidPlan = "fiado" | "completo" | "pro";

interface CreatePlanChargeRequest {
  planId?: SupportedPaidPlan;
}

interface SubscriptionPlanRow {
  id: SupportedPaidPlan;
  name: string;
  price: number;
  currency: string;
  duration_days: number;
}

interface StoreAccountRow {
  id: string;
  nome_cliente: string;
  email: string;
  telefone: string;
  cnpj: string | null;
  nome_estabelecimento: string;
  nome_rua: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string;
}

interface BillingCustomerRow {
  id: string;
  provider_customer_id: string | null;
  provider_customer_deleted: boolean;
}

interface StoreSubscriptionRow {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  plan_id: SupportedPaidPlan;
  status: string;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
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
const awaitingPaymentStatuses = new Set(["PENDING", "OVERDUE"]);
const receivedPaymentStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

const isAsaasConfigured = () => Boolean(Deno.env.get("ASAAS_API_KEY"));
const todayAsaasDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

const normalizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const updateSubscriptionMetadata = (
  currentMetadata: Record<string, unknown> | null | undefined,
  nextMetadata: Record<string, unknown>,
) => ({
  ...(currentMetadata || {}),
  ...nextMetadata,
});

const ensureBillingCustomer = async (
  serviceClient: ReturnType<typeof createClient>,
  ownerUserId: string,
  storeAccount: StoreAccountRow,
) => {
  const { data: billingCustomerData, error: billingCustomerError } = await serviceClient
    .from("billing_customers")
    .select("id, provider_customer_id, provider_customer_deleted")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (billingCustomerError) {
    throw new Error(billingCustomerError.message || "Não foi possível consultar o cliente de cobrança.");
  }

  const billingCustomer = (billingCustomerData as BillingCustomerRow | null) || null;

  if (billingCustomer?.provider_customer_id && !billingCustomer.provider_customer_deleted) {
    return billingCustomer.provider_customer_id;
  }

  const asaasCustomer = await createAsaasCustomer({
    name: storeAccount.nome_cliente,
    email: storeAccount.email,
    cpfCnpj: normalizeDigits(storeAccount.cnpj),
    mobilePhone: normalizeDigits(storeAccount.telefone),
    address: storeAccount.nome_rua,
    addressNumber: storeAccount.numero || undefined,
    complement: storeAccount.complemento || undefined,
    province: storeAccount.bairro || undefined,
    postalCode: normalizeDigits(storeAccount.cep),
    externalReference: ownerUserId,
    company: storeAccount.nome_estabelecimento,
    notificationDisabled: false,
  });

  const upsertPayload = {
    store_account_id: storeAccount.id,
    owner_user_id: ownerUserId,
    provider: "asaas",
    provider_customer_id: asaasCustomer.id,
    provider_customer_deleted: false,
    email: storeAccount.email,
    phone: normalizeDigits(storeAccount.telefone),
    cpf_cnpj: normalizeDigits(storeAccount.cnpj),
    metadata: asaasCustomer,
  };

  const { error: upsertBillingCustomerError } = await serviceClient
    .from("billing_customers")
    .upsert(upsertPayload, { onConflict: "owner_user_id" });

  if (upsertBillingCustomerError) {
    throw new Error(upsertBillingCustomerError.message || "Não foi possível registrar o cliente de cobrança.");
  }

  return asaasCustomer.id;
};

const buildCheckoutPayload = async (
  subscriptionId: string,
  planId: SupportedPaidPlan,
  payment: AsaasPayment,
) => {
  const pixQrCode = await getAsaasPixQrCode(payment.id);

  return {
    subscriptionId,
    planId,
    paymentId: payment.id,
    paymentStatus: payment.status || "PENDING",
    value: Number(payment.value || 0),
    dueDate: payment.dueDate,
    invoiceUrl: payment.invoiceUrl || null,
    copyPasteCode: pixQrCode.payload,
    qrCodeBase64: pixQrCode.encodedImage,
    qrCodeExpirationDate: pixQrCode.expirationDate,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não suportado." }, 405);
  }

  if (!isAsaasConfigured()) {
    return jsonResponse({ error: "ASAAS_API_KEY não configurada." }, 503);
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

  let body: CreatePlanChargeRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Payload inválido." }, 400);
  }

  const planId = body.planId;

  if (!planId || !supportedPlans.has(planId)) {
    return jsonResponse({ error: "Plano inválido." }, 400);
  }

  const { data: planData, error: planError } = await serviceClient
    .from("subscription_plans")
    .select("id, name, price, currency, duration_days")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (planError || !planData) {
    return jsonResponse({ error: "Plano não encontrado." }, 404);
  }

  const { data: storeAccountData, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("id, nome_cliente, email, telefone, cnpj, nome_estabelecimento, nome_rua, numero, complemento, bairro, cep")
    .eq("owner_user_id", user.id)
    .single();

  if (storeAccountError || !storeAccountData) {
    return jsonResponse({ error: "Conta da loja não encontrada." }, 404);
  }

  const plan = planData as SubscriptionPlanRow;
  const storeAccount = storeAccountData as StoreAccountRow;

  try {
    const asaasCustomerId = await ensureBillingCustomer(serviceClient, user.id, storeAccount);

    const { data: pendingSubscriptionsData, error: pendingSubscriptionsError } = await serviceClient
      .from("store_subscriptions")
      .select("id, store_account_id, owner_user_id, plan_id, status, provider_payment_id, metadata, created_at")
      .eq("owner_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingSubscriptionsError) {
      throw new Error(pendingSubscriptionsError.message || "Não foi possível consultar cobranças pendentes.");
    }

    const pendingSubscriptions = (pendingSubscriptionsData as StoreSubscriptionRow[] | null) || [];
    const pendingForSamePlan = pendingSubscriptions.find(subscription => subscription.plan_id === planId) || null;

    if (pendingForSamePlan?.provider_payment_id) {
      const currentPayment = await getAsaasPayment(pendingForSamePlan.provider_payment_id);
      const paymentStatus = (currentPayment.status || "PENDING").toUpperCase();

      if (awaitingPaymentStatuses.has(paymentStatus)) {
        const checkout = await buildCheckoutPayload(pendingForSamePlan.id, planId, currentPayment);

        await serviceClient
          .from("store_subscriptions")
          .update({
            metadata: updateSubscriptionMetadata(pendingForSamePlan.metadata, {
              asaas_payment_status: paymentStatus,
              last_checkout_requested_at: new Date().toISOString(),
              reused_pending_checkout: true,
            }),
          })
          .eq("id", pendingForSamePlan.id);

        return jsonResponse({
          success: true,
          reusedPending: true,
          checkout,
        });
      }

      if (receivedPaymentStatuses.has(paymentStatus)) {
        return jsonResponse(
          {
            error: "O pagamento deste plano já foi recebido. Aguarde alguns instantes para a liberação automática.",
            code: "PAYMENT_ALREADY_RECEIVED",
          },
          409,
        );
      }
    }

    for (const pendingSubscription of pendingSubscriptions) {
      if (pendingSubscription.provider_payment_id) {
        try {
          await deleteAsaasPayment(pendingSubscription.provider_payment_id);
        } catch (error) {
          console.error("Falha ao remover cobrança Pix anterior do Asaas:", error);
        }
      }

      const cancelledMetadata = updateSubscriptionMetadata(pendingSubscription.metadata, {
        checkout_cancelled_at: new Date().toISOString(),
        checkout_cancelled_by_plan: planId,
      });

      await serviceClient
        .from("store_subscriptions")
        .update({
          status: "canceled",
          metadata: cancelledMetadata,
        })
        .eq("id", pendingSubscription.id);
    }

    const pendingMetadata = {
      source: "asaas_pix_checkout",
      checkout_started_at: new Date().toISOString(),
      checkout_plan_name: plan.name,
    };

    const { data: createdSubscriptionData, error: createSubscriptionError } = await serviceClient
      .from("store_subscriptions")
      .insert({
        store_account_id: storeAccount.id,
        owner_user_id: user.id,
        plan_id: planId,
        provider: "asaas",
        status: "pending",
        billing_type: "PIX",
        price: plan.price,
        currency: plan.currency,
        external_reference: user.id,
        metadata: pendingMetadata,
      })
      .select("id, store_account_id, owner_user_id, plan_id, status, provider_payment_id, metadata, created_at")
      .single();

    if (createSubscriptionError || !createdSubscriptionData) {
      throw new Error(createSubscriptionError?.message || "Não foi possível preparar a assinatura.");
    }

    const createdSubscription = createdSubscriptionData as StoreSubscriptionRow;

    try {
      const payment = await createAsaasPayment({
        customer: asaasCustomerId,
        billingType: "PIX",
        value: Number(plan.price),
        dueDate: todayAsaasDate(),
        description: `HappyCash - ${plan.name} - 30 dias`,
        externalReference: createdSubscription.id,
      });

      const checkout = await buildCheckoutPayload(createdSubscription.id, planId, payment);

      await serviceClient
        .from("store_subscriptions")
        .update({
          provider_payment_id: payment.id,
          metadata: updateSubscriptionMetadata(createdSubscription.metadata, {
            asaas_payment_status: payment.status || "PENDING",
            asaas_due_date: payment.dueDate,
            asaas_invoice_url: payment.invoiceUrl || null,
            pix_qr_code_expiration_date: checkout.qrCodeExpirationDate,
            last_checkout_requested_at: new Date().toISOString(),
          }),
        })
        .eq("id", createdSubscription.id);

      return jsonResponse({
        success: true,
        reusedPending: false,
        checkout,
      });
    } catch (error) {
      await serviceClient
        .from("store_subscriptions")
        .delete()
        .eq("id", createdSubscription.id);

      throw error;
    }
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Não foi possível gerar a cobrança Pix.",
      },
      400,
    );
  }
});
