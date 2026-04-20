import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createAsaasCustomer,
  findAsaasCustomerByExternalReference,
  removeAsaasCustomer,
} from "../_shared/asaas.ts";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

interface RegisterAccountRequest {
  email?: string;
  password?: string;
  nomeCliente?: string;
  telefone?: string;
  cnpj?: string;
  nomeEstabelecimento?: string;
  tipoEstabelecimento?: string;
  cep?: string;
  endereco?: string;
  nomeRua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface RegisterAccountResponse {
  success: boolean;
  trialEndsAt?: string;
  error?: string;
}

interface AuthUserResponse {
  user?: {
    id: string;
    email?: string | null;
  } | null;
}

interface StoreAccountRow {
  id: string;
}

const jsonResponse = (request: Request, body: RegisterAccountResponse, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ["POST", "OPTIONS"],
      }).headers.entries()),
      "Content-Type": "application/json",
    },
  });

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const trimToNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};
const isAsaasConfigured = () => Boolean(Deno.env.get("ASAAS_API_KEY"));

const validatePayload = (payload: RegisterAccountRequest) => {
  const email = normalizeEmail(payload.email || "");
  const password = payload.password?.trim() || "";
  const nomeCliente = payload.nomeCliente?.trim() || "";
  const telefone = digitsOnly(payload.telefone || "");
  const cpfCnpj = digitsOnly(payload.cnpj || "");
  const nomeEstabelecimento = payload.nomeEstabelecimento?.trim() || "";
  const tipoEstabelecimento = payload.tipoEstabelecimento?.trim() || "";
  const cep = digitsOnly(payload.cep || "");
  const endereco = payload.endereco?.trim() || "";
  const nomeRua = payload.nomeRua?.trim() || "";
  const numero = trimToNull(payload.numero);
  const complemento = trimToNull(payload.complemento);
  const bairro = trimToNull(payload.bairro);
  const cidade = payload.cidade?.trim() || "";
  const estado = payload.estado?.trim().toUpperCase() || "";

  if (!email || !email.includes("@")) throw new Error("Informe um email válido.");
  if (password.length < 6) throw new Error("A senha deve ter no mínimo 6 caracteres.");
  if (!nomeCliente) throw new Error("Informe o nome completo.");
  if (telefone.length < 10) throw new Error("Informe um telefone válido.");
  if (![11, 14].includes(cpfCnpj.length)) throw new Error("Informe um CPF ou CNPJ válido.");
  if (!nomeEstabelecimento) throw new Error("Informe o nome do estabelecimento.");
  if (!tipoEstabelecimento) throw new Error("Selecione o tipo de estabelecimento.");
  if (cep.length !== 8) throw new Error("Informe um CEP válido.");
  if (!nomeRua) throw new Error("Informe a rua.");
  if (!cidade) throw new Error("Informe a cidade.");
  if (estado.length !== 2) throw new Error("Selecione o estado.");

  return {
    email,
    password,
    nomeCliente,
    telefone,
    cpfCnpj,
    nomeEstabelecimento,
    tipoEstabelecimento,
    cep,
    endereco: endereco || `${nomeRua}, ${bairro || ""}, ${cidade} - ${estado}`.replace(/\s+,/g, ",").trim(),
    nomeRua,
    numero,
    complemento,
    bairro,
    cidade,
    estado,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, {
      allowedMethods: ["POST", "OPTIONS"],
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Método não suportado." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(request, { success: false, error: "Configuração do Supabase inválida." }, 500);
  }

  let payload: RegisterAccountRequest;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { success: false, error: "Payload inválido." }, 400);
  }

  try {
    const data = validatePayload(payload);

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("user_id")
      .eq("email", data.email)
      .maybeSingle();

    if (existingProfile?.user_id) {
      return jsonResponse(request, { success: false, error: "Já existe uma conta com esse email." }, 409);
    }

    let createdUserId: string | null = null;
    let createdAsaasCustomerId: string | null = null;
    let createdAsaasCustomerWasNew = false;

    try {
      const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          username: data.email,
          role: "admin",
        },
      });

      if (createUserError || !createdUser.user) {
        throw new Error(createUserError?.message || "Não foi possível criar o usuário.");
      }

      createdUserId = createdUser.user.id;

      const { data: storeAccount, error: storeAccountError } = await serviceClient
        .from("store_accounts")
        .insert({
          owner_user_id: createdUserId,
          nome_cliente: data.nomeCliente,
          email: data.email,
          telefone: data.telefone,
          cnpj: data.cpfCnpj,
          nome_estabelecimento: data.nomeEstabelecimento,
          tipo_estabelecimento: data.tipoEstabelecimento,
          cep: data.cep,
          endereco: data.endereco,
          nome_rua: data.nomeRua,
          numero: data.numero,
          complemento: data.complemento,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
        })
        .select("id")
        .single();

      if (storeAccountError || !storeAccount) {
        throw new Error(storeAccountError?.message || "Não foi possível salvar a conta da loja.");
      }

      const storeAccountId = (storeAccount as StoreAccountRow).id;
      let asaasCustomerId: string | null = null;

      if (isAsaasConfigured()) {
        const existingAsaasCustomer = await findAsaasCustomerByExternalReference(createdUserId);
        const asaasCustomer = existingAsaasCustomer || await createAsaasCustomer({
          name: data.nomeCliente,
          email: data.email,
          cpfCnpj: data.cpfCnpj,
          mobilePhone: data.telefone,
          address: data.nomeRua,
          addressNumber: data.numero || undefined,
          complement: data.complemento || undefined,
          province: data.bairro || undefined,
          postalCode: data.cep,
          externalReference: createdUserId,
          company: data.nomeEstabelecimento,
          notificationDisabled: false,
        });

        createdAsaasCustomerId = asaasCustomer.id;
        createdAsaasCustomerWasNew = !existingAsaasCustomer;
        asaasCustomerId = asaasCustomer.id;

        const { error: billingCustomerError } = await serviceClient
          .from("billing_customers")
          .insert({
            store_account_id: storeAccountId,
            owner_user_id: createdUserId,
            provider: "asaas",
            provider_customer_id: asaasCustomer.id,
            email: data.email,
            phone: data.telefone,
            cpf_cnpj: data.cpfCnpj,
            metadata: asaasCustomer,
          });

        if (billingCustomerError) {
          throw new Error(billingCustomerError.message || "Não foi possível vincular o cliente do Asaas.");
        }
      }

      const trialStartedAt = new Date();
      const trialEndsAt = new Date(trialStartedAt.getTime() + 3 * 60 * 60 * 1000);

      const { error: subscriptionError } = await serviceClient
        .from("store_subscriptions")
        .insert({
          store_account_id: storeAccountId,
          owner_user_id: createdUserId,
          plan_id: "demo",
          provider: "asaas",
          status: "trialing",
          billing_type: "PIX",
          price: 0,
          trial_started_at: trialStartedAt.toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
          current_period_starts_at: trialStartedAt.toISOString(),
          current_period_ends_at: trialEndsAt.toISOString(),
          external_reference: createdUserId,
          metadata: {
            created_via: "happycashsite",
            asaas_customer_id: asaasCustomerId,
            asaas_pending_setup: !isAsaasConfigured(),
          },
        });

      if (subscriptionError) {
        throw new Error(subscriptionError.message || "Não foi possível iniciar a demo.");
      }

      return jsonResponse(request, {
        success: true,
        trialEndsAt: trialEndsAt.toISOString(),
      });
    } catch (error) {
      if (createdAsaasCustomerId && createdAsaasCustomerWasNew) {
        try {
          await removeAsaasCustomer(createdAsaasCustomerId);
        } catch (cleanupError) {
          console.error("Falha ao remover cliente Asaas após erro no cadastro:", cleanupError);
        }
      }

      if (createdUserId) {
        try {
          await serviceClient.auth.admin.deleteUser(createdUserId);
        } catch (cleanupError) {
          console.error("Falha ao remover usuário após erro no cadastro:", cleanupError);
        }
      }

      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível concluir o cadastro.";
    return jsonResponse(request, { success: false, error: message }, 400);
  }
});
