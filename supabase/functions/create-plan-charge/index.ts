import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createAsaasCustomer,
  createAsaasPayment,
  deleteAsaasPayment,
  findAsaasCustomerByExternalReference,
  getAsaasPayment,
  getAsaasPixQrCode,
  type AsaasPayment,
  type CreateAsaasCustomerInput,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

type SupportedPaidPlan = "fiado" | "completo" | "pro";
type CheckoutPaymentMethod = "pix" | "card";
type SupportedBillingType = "PIX" | "CREDIT_CARD";

interface CreatePlanChargeRequest {
  planId?: SupportedPaidPlan;
  paymentMethod?: CheckoutPaymentMethod;
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
  billing_type: SupportedBillingType | null;
  provider_payment_id: string | null;
  metadata: Record<string, unknown> | null;
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

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const supportedPlans = new Set<SupportedPaidPlan>(["fiado", "completo", "pro"]);
const supportedPaymentMethods = new Set<CheckoutPaymentMethod>(["pix", "card"]);
const awaitingPaymentStatuses = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);
const receivedPaymentStatuses = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

const isAsaasConfigured = () => Boolean(Deno.env.get("ASAAS_API_KEY"));
const todayAsaasDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

const normalizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");
const trimToUndefined = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
const resolvePaymentMethod = (value?: string | null): CheckoutPaymentMethod =>
  value === "card" ? "card" : "pix";
const resolveBillingType = (paymentMethod: CheckoutPaymentMethod): SupportedBillingType =>
  paymentMethod === "card" ? "CREDIT_CARD" : "PIX";
const resolvePaymentMethodFromBillingType = (billingType?: string | null): CheckoutPaymentMethod =>
  billingType === "CREDIT_CARD" ? "card" : "pix";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildAsaasCustomerPayload = (
  ownerUserId: string,
  storeAccount: StoreAccountRow,
): CreateAsaasCustomerInput => {
  const customerName = trimToUndefined(storeAccount.nome_cliente);
  const cpfCnpj = normalizeDigits(storeAccount.cnpj);
  const mobilePhone = normalizeDigits(storeAccount.telefone);
  const postalCode = normalizeDigits(storeAccount.cep);

  if (!customerName) {
    throw new Error("O cadastro da loja precisa do nome do responsavel para gerar a cobranca.");
  }

  if (![11, 14].includes(cpfCnpj.length)) {
    throw new Error("O cadastro da loja precisa de um CPF ou CNPJ valido para gerar a cobranca.");
  }

  return {
    name: customerName,
    email: trimToUndefined(storeAccount.email),
    cpfCnpj,
    mobilePhone: mobilePhone.length >= 10 ? mobilePhone : undefined,
    address: trimToUndefined(storeAccount.nome_rua),
    addressNumber: trimToUndefined(storeAccount.numero),
    complement: trimToUndefined(storeAccount.complemento),
    province: trimToUndefined(storeAccount.bairro),
    postalCode: postalCode.length === 8 ? postalCode : undefined,
    externalReference: ownerUserId,
    company: trimToUndefined(storeAccount.nome_estabelecimento),
    notificationDisabled: false,
  };
};

const normalizeCheckoutError = (error: unknown, paymentMethod: CheckoutPaymentMethod) => {
  const fallbackMessage = "Nao foi possivel gerar a cobranca do plano.";
  const rawMessage = error instanceof Error && error.message.trim() ? error.message.trim() : fallbackMessage;
  const normalizedMessage = rawMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedMessage.includes("store_subscriptions_status_check")) {
    return {
      code: "BILLING_PENDING_MIGRATION_REQUIRED",
      message:
        "O banco deste projeto ainda nao recebeu a migracao de 19/04/2026 que libera assinaturas pendentes. Aplique as migracoes do Supabase e tente novamente.",
    };
  }

  if (normalizedMessage.includes("store_subscriptions_billing_type_check")) {
    return {
      code: "BILLING_CARD_MIGRATION_REQUIRED",
      message:
        "O banco deste projeto ainda nao recebeu a migracao de 22/04/2026 que libera cobranca por debito / credito. Aplique as migracoes do Supabase e tente novamente.",
    };
  }

  if (
    paymentMethod === "pix" &&
    normalizedMessage.includes("pix nao esta disponivel") &&
    normalizedMessage.includes("conta precisa estar aprovada")
  ) {
    return {
      code: "ASAAS_PIX_PENDING_APPROVAL",
      message: "O Pix do Asaas ainda nao foi liberado nesta conta. Finalize a aprovacao da conta no painel do Asaas ou use debito / credito por enquanto.",
    };
  }

  return {
    code: undefined,
    message: rawMessage,
  };
};

const isTransientPixQrCodeError = (error: unknown) => {
  const rawMessage = error instanceof Error && error.message.trim() ? error.message.trim() : "";
  const normalizedMessage = rawMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalizedMessage.includes("esta cobranca nao permite pagamentos via pix");
};

const getPixQrCodeWithRetry = async (paymentId: string) => {
  const delays = [0, 800, 1800];
  let lastError: unknown = null;

  for (const delay of delays) {
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      return await getAsaasPixQrCode(paymentId);
    } catch (error) {
      lastError = error;

      if (!isTransientPixQrCodeError(error) || delay === delays[delays.length - 1]) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Nao foi possivel obter o QR Code Pix.");
};

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

  const existingAsaasCustomer = await findAsaasCustomerByExternalReference(ownerUserId);

  if (existingAsaasCustomer?.id) {
    const normalizedPhone = normalizeDigits(storeAccount.telefone);
    const normalizedCpfCnpj = normalizeDigits(storeAccount.cnpj);

    if (
      billingCustomer?.provider_customer_id !== existingAsaasCustomer.id ||
      billingCustomer?.provider_customer_deleted
    ) {
      const { error: syncBillingCustomerError } = await serviceClient
        .from("billing_customers")
        .upsert({
          store_account_id: storeAccount.id,
          owner_user_id: ownerUserId,
          provider: "asaas",
          provider_customer_id: existingAsaasCustomer.id,
          provider_customer_deleted: false,
          email: trimToUndefined(storeAccount.email) || storeAccount.email,
          phone: normalizedPhone.length >= 10 ? normalizedPhone : null,
          cpf_cnpj: [11, 14].includes(normalizedCpfCnpj.length) ? normalizedCpfCnpj : null,
          metadata: existingAsaasCustomer,
        }, { onConflict: "owner_user_id" });

      if (syncBillingCustomerError) {
        throw new Error(syncBillingCustomerError.message || "Não foi possível sincronizar o cliente de cobrança.");
      }
    }

    return existingAsaasCustomer.id;
  }

  const customerPayload = buildAsaasCustomerPayload(ownerUserId, storeAccount);
  const asaasCustomer = await createAsaasCustomer(customerPayload);

  const upsertPayload = {
    store_account_id: storeAccount.id,
    owner_user_id: ownerUserId,
    provider: "asaas",
    provider_customer_id: asaasCustomer.id,
    provider_customer_deleted: false,
    email: customerPayload.email || storeAccount.email,
    phone: customerPayload.mobilePhone || null,
    cpf_cnpj: customerPayload.cpfCnpj,
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
  paymentMethod: CheckoutPaymentMethod,
  payment: AsaasPayment,
): Promise<{
  subscriptionId: string;
  planId: SupportedPaidPlan;
  paymentMethod: CheckoutPaymentMethod;
  paymentId: string;
  paymentStatus: string;
  value: number;
  dueDate: string;
  invoiceUrl: string | null;
  copyPasteCode?: string;
  qrCodeBase64?: string;
  qrCodeExpirationDate?: string;
}> => {
  const baseCheckout = {
    subscriptionId,
    planId,
    paymentMethod,
    paymentId: payment.id,
    paymentStatus: payment.status || "PENDING",
    value: Number(payment.value || 0),
    dueDate: payment.dueDate,
    invoiceUrl: payment.invoiceUrl || null,
  };

  if (paymentMethod === "card") {
    if (!payment.invoiceUrl) {
      throw new Error("A fatura do cartao nao foi gerada pelo Asaas.");
    }

    return baseCheckout;
  }

  const pixQrCode = await getPixQrCodeWithRetry(payment.id);

  return {
    ...baseCheckout,
    copyPasteCode: pixQrCode.payload,
    qrCodeBase64: pixQrCode.encodedImage,
    qrCodeExpirationDate: pixQrCode.expirationDate,
  };
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

  if (!isAsaasConfigured()) {
    return jsonResponse(request, { error: "ASAAS_API_KEY não configurada." }, 503);
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

  let body: CreatePlanChargeRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload inválido." }, 400);
  }

  const planId = body.planId;
  const paymentMethod = resolvePaymentMethod(body.paymentMethod);

  if (!planId || !supportedPlans.has(planId)) {
    return jsonResponse(request, { error: "Plano inválido." }, 400);
  }

  if (body.paymentMethod && !supportedPaymentMethods.has(body.paymentMethod)) {
    return jsonResponse(request, { error: "Forma de pagamento inválida." }, 400);
  }

  const { data: planData, error: planError } = await serviceClient
    .from("subscription_plans")
    .select("id, name, price, currency, duration_days")
    .eq("id", planId)
    .eq("is_active", true)
    .single();

  if (planError || !planData) {
    return jsonResponse(request, { error: "Plano não encontrado." }, 404);
  }

  const { data: storeAccountData, error: storeAccountError } = await serviceClient
    .from("store_accounts")
    .select("id, nome_cliente, email, telefone, cnpj, nome_estabelecimento, nome_rua, numero, complemento, bairro, cep")
    .eq("owner_user_id", user.id)
    .single();

  if (storeAccountError || !storeAccountData) {
    return jsonResponse(request, { error: "Conta da loja não encontrada." }, 404);
  }

  const plan = planData as SubscriptionPlanRow;
  const storeAccount = storeAccountData as StoreAccountRow;
  const billingType = resolveBillingType(paymentMethod);

  try {
    const asaasCustomerId = await ensureBillingCustomer(serviceClient, user.id, storeAccount);

    const { data: pendingSubscriptionsData, error: pendingSubscriptionsError } = await serviceClient
      .from("store_subscriptions")
      .select("id, store_account_id, owner_user_id, plan_id, status, billing_type, provider_payment_id, metadata, created_at")
      .eq("owner_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (pendingSubscriptionsError) {
      throw new Error(pendingSubscriptionsError.message || "Não foi possível consultar cobranças pendentes.");
    }

    const pendingSubscriptions = (pendingSubscriptionsData as StoreSubscriptionRow[] | null) || [];

    for (const pendingSubscription of pendingSubscriptions) {
      if (!pendingSubscription.provider_payment_id || pendingSubscription.plan_id !== planId) {
        continue;
      }

      let currentPayment: AsaasPayment;

      try {
        currentPayment = await getAsaasPayment(pendingSubscription.provider_payment_id);
      } catch (error) {
        console.warn("Cobranca pendente nao encontrada no ambiente atual do Asaas. Cancelando registro local antigo.", {
          subscriptionId: pendingSubscription.id,
          providerPaymentId: pendingSubscription.provider_payment_id,
          error,
        });
        continue;
      }

      const paymentStatus = (currentPayment.status || "PENDING").toUpperCase();
      const pendingPaymentMethod = resolvePaymentMethodFromBillingType(pendingSubscription.billing_type);

      if (receivedPaymentStatuses.has(paymentStatus)) {
        return jsonResponse(
          request,
          {
            error: "O pagamento deste plano ja foi recebido. Aguarde alguns instantes para a liberacao automatica.",
            code: "PAYMENT_ALREADY_RECEIVED",
          },
          409,
        );
      }

      if (pendingPaymentMethod === paymentMethod && awaitingPaymentStatuses.has(paymentStatus)) {
        const checkout = await buildCheckoutPayload(pendingSubscription.id, planId, paymentMethod, currentPayment);

        await serviceClient
          .from("store_subscriptions")
          .update({
            metadata: updateSubscriptionMetadata(pendingSubscription.metadata, {
              asaas_payment_status: paymentStatus,
              asaas_invoice_url: currentPayment.invoiceUrl || null,
              checkout_payment_method: paymentMethod,
              checkout_billing_type: billingType,
              last_checkout_requested_at: new Date().toISOString(),
              reused_pending_checkout: true,
            }),
          })
          .eq("id", pendingSubscription.id);

        return jsonResponse(request, {
          success: true,
          reusedPending: true,
          checkout,
        });
      }
    }

    for (const pendingSubscription of pendingSubscriptions) {
      if (pendingSubscription.provider_payment_id) {
        try {
          await deleteAsaasPayment(pendingSubscription.provider_payment_id);
        } catch (error) {
          console.error("Falha ao remover cobranca anterior do Asaas:", error);
        }
      }

      const cancelledMetadata = updateSubscriptionMetadata(pendingSubscription.metadata, {
        checkout_cancelled_at: new Date().toISOString(),
        checkout_cancelled_by_plan: planId,
        checkout_cancelled_by_payment_method: paymentMethod,
        checkout_cancelled_by_billing_type: billingType,
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
      source: paymentMethod === "pix" ? "asaas_pix_checkout" : "asaas_card_checkout",
      checkout_started_at: new Date().toISOString(),
      checkout_plan_name: plan.name,
      checkout_payment_method: paymentMethod,
      checkout_billing_type: billingType,
    };

    const { data: createdSubscriptionData, error: createSubscriptionError } = await serviceClient
      .from("store_subscriptions")
      .insert({
        store_account_id: storeAccount.id,
        owner_user_id: user.id,
        plan_id: planId,
        provider: "asaas",
        status: "pending",
        billing_type: billingType,
        price: plan.price,
        currency: plan.currency,
        external_reference: user.id,
        metadata: pendingMetadata,
      })
      .select("id, store_account_id, owner_user_id, plan_id, status, billing_type, provider_payment_id, metadata, created_at")
      .single();

    if (createSubscriptionError || !createdSubscriptionData) {
      throw new Error(createSubscriptionError?.message || "Não foi possível preparar a assinatura.");
    }

    const createdSubscription = createdSubscriptionData as StoreSubscriptionRow;

    try {
      const payment = await createAsaasPayment({
        customer: asaasCustomerId,
        billingType,
        value: Number(plan.price),
        dueDate: todayAsaasDate(),
        description: `HappyCash - ${plan.name} - 30 dias`,
        externalReference: createdSubscription.id,
      });

      const checkout = await buildCheckoutPayload(createdSubscription.id, planId, paymentMethod, payment);
      const paymentMetadata = {
        asaas_payment_status: payment.status || "PENDING",
        asaas_due_date: payment.dueDate,
        asaas_invoice_url: payment.invoiceUrl || null,
        asaas_billing_type: payment.billingType || billingType,
        checkout_payment_method: paymentMethod,
        checkout_billing_type: billingType,
        last_checkout_requested_at: new Date().toISOString(),
      } as Record<string, unknown>;

      if (checkout.paymentMethod === "pix" && checkout.qrCodeExpirationDate) {
        paymentMetadata.pix_qr_code_expiration_date = checkout.qrCodeExpirationDate;
      }

      await serviceClient
        .from("store_subscriptions")
        .update({
          provider_payment_id: payment.id,
          metadata: updateSubscriptionMetadata(createdSubscription.metadata, paymentMetadata),
        })
        .eq("id", createdSubscription.id);

      return jsonResponse(request, {
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
    console.error("create-plan-charge failed", {
      userId: user.id,
      planId,
      paymentMethod,
      error: error instanceof Error ? error.message : String(error),
    });

    const providerError = normalizeCheckoutError(error, paymentMethod);

    return jsonResponse(
      request,
      {
        error: providerError.message,
        ...(providerError.code ? { code: providerError.code } : {}),
      },
      providerError.code ? 409 : 400,
    );
  }
});
