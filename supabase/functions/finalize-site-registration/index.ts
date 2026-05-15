import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createAsaasCustomer,
  findAsaasCustomerByExternalReference,
  getAsaasCustomer,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  normalizeProductContext,
  type ProductContext,
} from "../_shared/productContext.ts";

interface PendingRegistrationRow {
  id: string;
  owner_user_id: string;
  email: string;
  nome_cliente: string;
  telefone: string;
  cpf_cnpj: string;
  nome_estabelecimento: string;
  tipo_estabelecimento: string;
  cep: string;
  endereco: string;
  nome_rua: string;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  status: "pending" | "completed";
  store_account_id: string | null;
  trial_ends_at: string | null;
  product_context: ProductContext;
}

interface StoreAccountRow {
  id: string;
  product_context: ProductContext;
}

interface BillingCustomerRow {
  provider_customer_id: string | null;
  provider_customer_deleted: boolean;
}

interface StoreSubscriptionRow {
  id: string;
  status: string;
  plan_id: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  product_context: ProductContext;
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

const isAsaasConfigured = () => Boolean(Deno.env.get("ASAAS_API_KEY"));

const normalizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const updatePendingRegistration = async (
  serviceClient: ReturnType<typeof createClient>,
  registrationId: string,
  updates: Record<string, unknown>,
) => {
  await serviceClient
    .from("site_pending_registrations")
    .update(updates)
    .eq("id", registrationId);
};

const ensureBillingCustomer = async (
  serviceClient: ReturnType<typeof createClient>,
  ownerUserId: string,
  storeAccountId: string,
  registration: PendingRegistrationRow,
) => {
  const { data: billingCustomerData, error: billingCustomerError } = await serviceClient
    .from("billing_customers")
    .select("provider_customer_id, provider_customer_deleted")
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();

  if (billingCustomerError) {
    throw new Error(billingCustomerError.message || "Nao foi possivel consultar o cliente de cobranca.");
  }

  const billingCustomer = (billingCustomerData as BillingCustomerRow | null) || null;

  if (billingCustomer?.provider_customer_id && !billingCustomer.provider_customer_deleted) {
    try {
      const verifiedCustomer = await getAsaasCustomer(billingCustomer.provider_customer_id);

      if (verifiedCustomer?.id) {
        return verifiedCustomer.id;
      }
    } catch (error) {
      console.warn("Cliente local de cobranca nao existe mais no ambiente atual do Asaas. Tentando ressincronizar.", {
        ownerUserId,
        providerCustomerId: billingCustomer.provider_customer_id,
        error,
      });
    }
  }

  const existingAsaasCustomer = await findAsaasCustomerByExternalReference(ownerUserId);
  const asaasCustomer = existingAsaasCustomer || await createAsaasCustomer({
    name: registration.nome_cliente,
    email: registration.email,
    cpfCnpj: normalizeDigits(registration.cpf_cnpj),
    mobilePhone: normalizeDigits(registration.telefone),
    address: registration.nome_rua,
    addressNumber: registration.numero || undefined,
    complement: registration.complemento || undefined,
    province: registration.bairro || undefined,
    postalCode: normalizeDigits(registration.cep),
    externalReference: ownerUserId,
    company: registration.nome_estabelecimento,
    notificationDisabled: false,
  });

  const { error: upsertBillingCustomerError } = await serviceClient
    .from("billing_customers")
    .upsert(
      {
        store_account_id: storeAccountId,
        owner_user_id: ownerUserId,
        provider: "asaas",
        provider_customer_id: asaasCustomer.id,
        provider_customer_deleted: false,
        email: registration.email,
        phone: normalizeDigits(registration.telefone),
        cpf_cnpj: normalizeDigits(registration.cpf_cnpj),
        metadata: asaasCustomer,
      },
      { onConflict: "owner_user_id" },
    );

  if (upsertBillingCustomerError) {
    throw new Error(upsertBillingCustomerError.message || "Nao foi possivel vincular o cliente do Asaas.");
  }

  return asaasCustomer.id;
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

  if (!(user.email_confirmed_at || user.confirmed_at)) {
    return jsonResponse(
      request,
      {
        error: "Confirme seu email antes de finalizar a ativacao da conta.",
        code: "EMAIL_NOT_CONFIRMED",
      },
      403,
    );
  }

  const { data: existingStoreAccountData, error: existingStoreAccountError } = await serviceClient
    .from("store_accounts")
    .select("id, product_context")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existingStoreAccountError) {
    return jsonResponse(
      request,
      { error: existingStoreAccountError.message || "Nao foi possivel consultar a conta da loja." },
      500,
    );
  }

  const existingStoreAccount = (existingStoreAccountData as StoreAccountRow | null) || null;

  const { data: registrationData, error: registrationError } = await serviceClient
    .from("site_pending_registrations")
    .select(
      [
        "id",
        "owner_user_id",
        "email",
        "nome_cliente",
        "telefone",
        "cpf_cnpj",
        "nome_estabelecimento",
        "tipo_estabelecimento",
        "cep",
        "endereco",
        "nome_rua",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "estado",
        "status",
        "store_account_id",
        "trial_ends_at",
        "product_context",
      ].join(", "),
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (registrationError) {
    return jsonResponse(
      request,
      { error: registrationError.message || "Nao foi possivel consultar o cadastro pendente." },
      500,
    );
  }

  const registration = (registrationData as PendingRegistrationRow | null) || null;

  if (!registration && existingStoreAccount) {
    return jsonResponse(request, { success: true, alreadyReady: true });
  }

  if (!registration) {
    return jsonResponse(
      request,
      { error: "Nenhum cadastro pendente foi encontrado para esta conta." },
      404,
    );
  }

  try {
    let storeAccountId = existingStoreAccount?.id ?? registration.store_account_id ?? null;
    const accountProductContext = normalizeProductContext(
      existingStoreAccount?.product_context ?? registration.product_context,
    );

    if (
      existingStoreAccount
      && normalizeProductContext(existingStoreAccount.product_context) !== normalizeProductContext(registration.product_context)
    ) {
      throw new Error("Esta conta ja esta designada para outro produto. Use um cadastro separado para HappyCash e HappyCashFood.");
    }

    if (!storeAccountId) {
      const { data: createdStoreAccountData, error: createdStoreAccountError } = await serviceClient
        .from("store_accounts")
        .insert({
          owner_user_id: user.id,
          nome_cliente: registration.nome_cliente,
          email: registration.email,
          telefone: registration.telefone,
          cnpj: registration.cpf_cnpj,
          nome_estabelecimento: registration.nome_estabelecimento,
          tipo_estabelecimento: registration.tipo_estabelecimento,
          cep: registration.cep,
          endereco: registration.endereco,
          nome_rua: registration.nome_rua,
          numero: registration.numero,
          complemento: registration.complemento,
          bairro: registration.bairro,
          cidade: registration.cidade,
          estado: registration.estado,
          product_context: accountProductContext,
        })
        .select("id, product_context")
        .single();

      if (createdStoreAccountError || !createdStoreAccountData) {
        throw new Error(createdStoreAccountError?.message || "Nao foi possivel salvar a conta da loja.");
      }

      storeAccountId = (createdStoreAccountData as StoreAccountRow).id;
    }

    let asaasCustomerId: string | null = null;
    if (isAsaasConfigured() && storeAccountId) {
      asaasCustomerId = await ensureBillingCustomer(serviceClient, user.id, storeAccountId, registration);
    }

    const { data: existingSubscriptionsData, error: existingSubscriptionsError } = await serviceClient
      .from("store_subscriptions")
      .select("id, status, plan_id, current_period_ends_at, trial_ends_at, product_context")
      .eq("owner_user_id", user.id)
      .eq("product_context", accountProductContext)
      .order("created_at", { ascending: false });

    if (existingSubscriptionsError) {
      throw new Error(existingSubscriptionsError.message || "Nao foi possivel consultar a assinatura da conta.");
    }

    const existingSubscriptions = (existingSubscriptionsData as StoreSubscriptionRow[] | null) || [];
    const currentSubscription = existingSubscriptions.find((subscription) =>
      ["active", "past_due", "pending", "trialing"].includes(subscription.status),
    ) || null;

    let trialEndsAt = registration.trial_ends_at;

    if (!currentSubscription) {
      const trialStartedAt = new Date();
      const resolvedTrialEndsAt = new Date(trialStartedAt.getTime() + 12 * 60 * 60 * 1000).toISOString();

      const { error: subscriptionError } = await serviceClient
        .from("store_subscriptions")
        .insert({
          store_account_id: storeAccountId,
          owner_user_id: user.id,
          plan_id: "demo",
          provider: "asaas",
          status: "trialing",
          billing_type: "PIX",
          price: 0,
          product_context: accountProductContext,
          trial_started_at: trialStartedAt.toISOString(),
          trial_ends_at: resolvedTrialEndsAt,
          current_period_starts_at: trialStartedAt.toISOString(),
          current_period_ends_at: resolvedTrialEndsAt,
          external_reference: user.id,
          metadata: {
            created_via: "happycashsite",
            asaas_customer_id: asaasCustomerId,
            asaas_pending_setup: !isAsaasConfigured(),
            finalized_after_email_confirmation: true,
          },
        });

      if (subscriptionError) {
        throw new Error(subscriptionError.message || "Nao foi possivel iniciar a demo.");
      }

      trialEndsAt = resolvedTrialEndsAt;
    } else {
      trialEndsAt = currentSubscription.trial_ends_at || currentSubscription.current_period_ends_at || trialEndsAt;
    }

    await updatePendingRegistration(serviceClient, registration.id, {
      completed_at: new Date().toISOString(),
      failure_reason: null,
      status: "completed",
      store_account_id: storeAccountId,
      trial_ends_at: trialEndsAt,
    });

    return jsonResponse(request, {
      success: true,
      alreadyReady: Boolean(existingStoreAccount),
      storeAccountId,
      trialEndsAt,
      productContext: accountProductContext,
    });
  } catch (error) {
    await updatePendingRegistration(serviceClient, registration.id, {
      failure_reason: error instanceof Error ? error.message : "Falha ao finalizar o cadastro.",
      status: "pending",
    });

    return jsonResponse(
      request,
      {
        error: error instanceof Error ? error.message : "Nao foi possivel finalizar a conta agora.",
      },
      400,
    );
  }
});
