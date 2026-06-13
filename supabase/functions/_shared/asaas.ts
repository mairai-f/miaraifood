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
  deleted?: boolean;
  removed?: boolean;
  status?: string;
  deletedAt?: string | null;
  dateDeleted?: string | null;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  dueDate: string;
  status?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string | null;
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export interface AsaasWebhookPayload {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: {
    id: string;
    customer?: string;
    subscription?: string | null;
    billingType?: string;
    status?: string;
    value?: number;
    netValue?: number;
    dueDate?: string;
    originalDueDate?: string;
    paymentDate?: string | null;
    clientPaymentDate?: string | null;
    description?: string;
    externalReference?: string | null;
    invoiceUrl?: string | null;
  };
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

export interface CreateAsaasPaymentInput {
  customer: string;
  billingType: "PIX" | "CREDIT_CARD";
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
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

export async function getAsaasCustomer(customerId: string) {
  return requestAsaas<AsaasCustomer>(`/customers/${customerId}`, {
    method: "GET",
  });
}

export function isRemovedAsaasCustomer(customer?: AsaasCustomer | null) {
  if (!customer) return false;
  const normalizedStatus = customer.status?.trim().toLowerCase();
  return customer.deleted === true ||
    customer.removed === true ||
    Boolean(customer.deletedAt || customer.dateDeleted) ||
    normalizedStatus === "deleted" ||
    normalizedStatus === "removed";
}

export async function restoreAsaasCustomer(customerId: string) {
  return requestAsaas<AsaasCustomer>(`/customers/${customerId}/restore`, {
    method: "POST",
  });
}

export async function removeAsaasCustomer(customerId: string) {
  await requestAsaas(`/customers/${customerId}`, {
    method: "DELETE",
  });
}

export async function createAsaasPayment(input: CreateAsaasPaymentInput) {
  return requestAsaas<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAsaasPayment(paymentId: string) {
  return requestAsaas<AsaasPayment>(`/payments/${paymentId}`, {
    method: "GET",
  });
}

export async function getAsaasPixQrCode(paymentId: string) {
  return requestAsaas<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, {
    method: "GET",
  });
}

export async function deleteAsaasPayment(paymentId: string) {
  await requestAsaas(`/payments/${paymentId}`, {
    method: "DELETE",
  });
}
