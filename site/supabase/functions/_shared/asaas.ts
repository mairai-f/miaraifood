const ASAAS_PRODUCTION_BASE_URL = "https://api.asaas.com/v3";
const ASAAS_SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";

interface AsaasErrorItem {
  description?: string;
}

interface AsaasErrorResponse {
  errors?: AsaasErrorItem[];
  message?: string;
}

export interface AsaasCustomer {
  id: string;
  name?: string;
  email?: string;
  company?: string;
  externalReference?: string;
}

interface AsaasListResponse<T> {
  data?: T[];
}

export interface CreateAsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference: string;
  company?: string;
  notificationDisabled?: boolean;
}

const getAsaasBaseUrl = () => {
  const environment = (Deno.env.get("ASAAS_ENVIRONMENT") || "production").trim().toLowerCase();
  return environment === "sandbox" ? ASAAS_SANDBOX_BASE_URL : ASAAS_PRODUCTION_BASE_URL;
};

const getAsaasHeaders = () => {
  const apiKey = Deno.env.get("ASAAS_API_KEY");
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  return {
    "Content-Type": "application/json",
    access_token: apiKey,
  };
};

const readErrorMessage = (payload: AsaasErrorResponse | null) => {
  const description = payload?.errors?.map((item) => item.description).filter(Boolean).join(" ");
  return description || payload?.message || "Erro ao comunicar com o Asaas.";
};

async function requestAsaas<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...getAsaasHeaders(),
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null) as T | AsaasErrorResponse | null;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload as AsaasErrorResponse | null));
  }

  return payload as T;
}

export async function findAsaasCustomerByExternalReference(externalReference: string) {
  const params = new URLSearchParams({
    externalReference,
    limit: "1",
  });

  const payload = await requestAsaas<AsaasListResponse<AsaasCustomer>>(`/customers?${params.toString()}`, {
    method: "GET",
  });

  return payload.data?.[0] || null;
}

export async function createAsaasCustomer(input: CreateAsaasCustomerInput) {
  return requestAsaas<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeAsaasCustomer(customerId: string) {
  await requestAsaas(`/customers/${customerId}`, {
    method: "DELETE",
  });
}
