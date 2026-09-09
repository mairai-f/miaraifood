import { createClient } from "npm:@supabase/supabase-js@2";

import {
  createAsaasCustomer,
  findAsaasCustomerByExternalReference,
  getAsaasCustomer,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import {
  escapeHtml,
  getHappyCashFromEmail,
  renderHappyCashEmail,
  sendHappyCashEmail,
} from "../_shared/happycashEmail.ts";
import {
  getProductContextLabel,
  normalizeProductContext,
  type ProductContext,
} from "../_shared/productContext.ts";
import { checkRedisRateLimit, readRateLimitEnv } from "../_shared/rateLimit.ts";

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
  terms_accepted_at: string | null;
  terms_version: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  lgpd_accepted_at: string | null;
  lgpd_version: string | null;
  legal_acceptance_source: string | null;
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

type ServiceClient = ReturnType<typeof createClient>;

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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "nao informado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "nao informado";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

const updatePendingRegistration = async (
  serviceClient: ServiceClient,
  registrationId: string,
  updates: Record<string, unknown>,
) => {
  await serviceClient
    .from("site_pending_registrations")
    .update(updates)
    .eq("id", registrationId);
};

const ensureBillingCustomer = async (
  serviceClient: ServiceClient,
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

const sendWelcomeEmail = async (
  registration: PendingRegistrationRow,
  details: {
    trialEndsAt: string | null;
    productContext: ProductContext;
  },
) => {
  if (!Deno.env.get("RESEND_API_KEY")?.trim()) {
    return;
  }

  const appUrl = Deno.env.get("MIAR_APP_URL")?.trim()
    || Deno.env.get("HAPPYCASH_APP_URL")?.trim()
    || "https://app.miaraifood.com.br";
  const productLabel = getProductContextLabel(details.productContext);
  const trialEndsAt = formatDate(details.trialEndsAt);
  const establishmentName = registration.nome_estabelecimento || registration.nome_cliente || "sua loja";
  const html = renderHappyCashEmail({
    eyebrow: "Bem-vindo",
    title: "Sua conta MIAR AI/FOOD está pronta",
    preview: `A conta de ${establishmentName} já pode acessar a MIAR AI/FOOD.`,
    intro:
      `O cadastro de ${establishmentName} foi ativado com sucesso. ` +
      `Agora você já pode acessar a MIAR AI/FOOD e configurar sua operação.`,
    metrics: [
      { label: "Produto", value: productLabel, tone: "primary" },
      { label: "Demo ate", value: trialEndsAt, tone: "success" },
    ],
    action: {
      label: "Acessar MIAR AI/FOOD",
      href: appUrl,
    },
    contentHtml: `
      <div style="margin-top:20px;border:1px solid #d8e2ef;border-radius:14px;background:#f8fbff;padding:16px;">
        <p style="margin:0;color:#42526a;font-size:14px;line-height:22px;">
          Conta: <strong>${escapeHtml(registration.email)}</strong><br>
          Loja: <strong>${escapeHtml(establishmentName)}</strong><br>
          Cidade: <strong>${escapeHtml(`${registration.cidade}/${registration.estado}`)}</strong>
        </p>
      </div>
    `,
    footerNote: "Este e-mail confirma a ativação da sua conta MIAR AI/FOOD.",
  });
  const text = [
    "Sua conta MIAR AI/FOOD está pronta",
    "",
    `Conta: ${registration.email}`,
    `Loja: ${establishmentName}`,
    `Produto: ${productLabel}`,
    `Demo ate: ${trialEndsAt}`,
    `Acesse: ${appUrl}`,
  ].join("\n");

  await sendHappyCashEmail({
    from: getHappyCashFromEmail("WELCOME_FROM_EMAIL"),
    to: [registration.email],
    subject: "Bem-vindo à MIAR AI/FOOD",
    html,
    text,
  });
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

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: "finalize-site-registration",
    limit: readRateLimitEnv("FINALIZE_SITE_REGISTRATION_RATE_LIMIT_PER_MINUTE", 20),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: "Muitas tentativas de finalizar cadastro em pouco tempo. Aguarde alguns instantes e tente novamente.",
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
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
        "terms_accepted_at",
        "terms_version",
        "privacy_accepted_at",
        "privacy_version",
        "lgpd_accepted_at",
        "lgpd_version",
        "legal_acceptance_source",
      ].join(", "),
    )
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (registrationError) {
    return jsonResponse(
      request,
      { error: "Nao foi possivel consultar o cadastro pendente." },
      500,
    );
  }

  const registration = (registrationData as PendingRegistrationRow | null) || null;

  if (registration?.status === "completed") {
    return jsonResponse(request, {
      success: true,
      alreadyReady: true,
      storeAccountId: registration.store_account_id,
      trialEndsAt: registration.trial_ends_at,
      productContext: normalizeProductContext(registration.product_context),
    });
  }

  if (!registration) {
    const { data: anyStoreAccountData, error: anyStoreAccountError } = await serviceClient
      .from("store_accounts")
      .select("id, product_context")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyStoreAccountError) {
      return jsonResponse(
        request,
        { error: "Nao foi possivel consultar a conta da loja." },
        500,
      );
    }

    if (anyStoreAccountData) {
      return jsonResponse(request, {
        success: true,
        alreadyReady: true,
        productContext: normalizeProductContext((anyStoreAccountData as StoreAccountRow).product_context),
      });
    }

    return jsonResponse(
      request,
      { error: "Nenhum cadastro pendente foi encontrado para esta conta." },
      404,
    );
  }

  try {
    const registrationProductContext = normalizeProductContext(registration.product_context);

    // O perfil, a conta da loja e a assinatura sempre pertencem ao mesmo
    // usuário autenticado. Isso também corrige perfis legados que possam ter
    // ficado apontando para outro proprietário antes da conclusão do cadastro.
    const { error: profileSyncError } = await serviceClient
      .from("profiles")
      .upsert({
        user_id: user.id,
        username: user.user_metadata?.username || user.email || registration.email,
        email: user.email || registration.email,
        role: "admin",
        owner_user_id: user.id,
        created_by_user_id: null,
      }, { onConflict: "user_id" });

    if (profileSyncError) {
      throw new Error(profileSyncError.message || "Nao foi possivel sincronizar o perfil da conta.");
    }

    const { data: existingStoreAccountData, error: existingStoreAccountError } = await serviceClient
      .from("store_accounts")
      .select("id, product_context")
      .eq("owner_user_id", user.id)
      .eq("product_context", registrationProductContext)
      .maybeSingle();

    if (existingStoreAccountError) {
      throw new Error("Nao foi possivel consultar a conta da loja.");
    }

    const existingStoreAccount = (existingStoreAccountData as StoreAccountRow | null) || null;
    let storeAccountId = existingStoreAccount?.id ?? registration.store_account_id ?? null;
    const accountProductContext = normalizeProductContext(
      existingStoreAccount?.product_context ?? registrationProductContext,
    );
    const legalAcceptanceUpdate = {
      terms_accepted_at: registration.terms_accepted_at,
      terms_version: registration.terms_version,
      privacy_accepted_at: registration.privacy_accepted_at,
      privacy_version: registration.privacy_version,
      lgpd_accepted_at: registration.lgpd_accepted_at,
      lgpd_version: registration.lgpd_version,
      legal_acceptance_source: registration.legal_acceptance_source,
    };
    const shouldSyncLegalAcceptance = Boolean(
      registration.terms_accepted_at
      || registration.privacy_accepted_at
      || registration.lgpd_accepted_at,
    );

    if (
      existingStoreAccount
      && normalizeProductContext(existingStoreAccount.product_context) !== registrationProductContext
    ) {
      const existingProductLabel = getProductContextLabel(normalizeProductContext(existingStoreAccount.product_context));
      throw new Error(`Esta conta ja esta designada para ${existingProductLabel}. Use um cadastro separado para outro produto.`);
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
          ...legalAcceptanceUpdate,
        })
        .select("id, product_context")
        .single();

      if (createdStoreAccountError || !createdStoreAccountData) {
        throw new Error(createdStoreAccountError?.message || "Nao foi possivel salvar a conta da loja.");
      }

      storeAccountId = (createdStoreAccountData as StoreAccountRow).id;
    }

    if (storeAccountId && shouldSyncLegalAcceptance) {
      const { error: legalSyncError } = await serviceClient
        .from("store_accounts")
        .update(legalAcceptanceUpdate)
        .eq("id", storeAccountId);

      if (legalSyncError) {
        throw new Error(legalSyncError.message || "Nao foi possivel registrar o aceite legal da conta.");
      }
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
      // Todo novo estabelecimento recebe todos os recursos durante 30 dias.
      // O bloqueio só acontece quando esse período termina sem pagamento.
      const resolvedTrialEndsAt = new Date(trialStartedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: subscriptionError } = await serviceClient
        .from("store_subscriptions")
        .insert({
          store_account_id: storeAccountId,
          owner_user_id: user.id,
          plan_id: "inicial",
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
            created_via: "miar-site",
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

    const isFirstTimeActivation = registration.status !== "completed";

    await updatePendingRegistration(serviceClient, registration.id, {
      completed_at: new Date().toISOString(),
      failure_reason: null,
      status: "completed",
      store_account_id: storeAccountId,
      trial_ends_at: trialEndsAt,
    });

    if (isFirstTimeActivation) {
      await sendWelcomeEmail(registration, {
        trialEndsAt,
        productContext: accountProductContext,
      }).catch((error) => {
        console.warn("Nao foi possivel enviar o e-mail de boas-vindas.", {
          message: error instanceof Error ? error.message : "erro desconhecido",
        });
      });
    }

    return jsonResponse(request, {
      success: true,
      alreadyReady: Boolean(existingStoreAccount),
      storeAccountId,
      trialEndsAt,
      productContext: accountProductContext,
    });
  } catch (error) {
    await updatePendingRegistration(serviceClient, registration.id, {
      failure_reason: "Falha ao finalizar o cadastro.",
      status: "pending",
    });

    return jsonResponse(
      request,
      {
        error: "Nao foi possivel finalizar a conta agora.",
      },
      400,
    );
  }
});
