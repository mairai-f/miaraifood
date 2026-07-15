import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { validateDesktopLicense } from '../_shared/desktopAccess.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';

type DesktopFiscalRequestContext = {
  desktopInstallationId?: string | null;
  desktopAppContext?: string | null;
};

type ManageFiscalRequest = DesktopFiscalRequestContext & (
  | {
      action: 'runtime_status';
    }
  | {
      action: 'sync_nuvem_fiscal_settings';
    }
  | {
      action: 'upload_nuvem_fiscal_certificate';
      certificateBase64?: string;
      password?: string;
    }
  | {
      action: 'issue_nfce_homologation';
      saleId?: string;
    }
);

interface CallerProfileRow {
  role: string;
  owner_user_id: string | null;
  username: string | null;
  email: string | null;
}

interface DesktopFiscalAccessResult {
  ok: boolean;
  status: number;
  code: string;
  message: string;
}

interface FiscalSettingsRow {
  id: string;
  owner_user_id: string;
  fiscal_mode: 'receipt_only' | 'nfce';
  fiscal_provider: 'internal' | 'nuvem_fiscal';
  nfce_enabled: boolean;
  nfce_environment: 'homologacao' | 'producao';
  nfce_series: number;
  nfce_next_number: number;
  issuer_state: string;
  issuer_legal_name: string | null;
  issuer_trade_name: string | null;
  issuer_cnpj: string | null;
  issuer_state_registration: string | null;
  issuer_tax_regime: string | null;
  operation_nature: string | null;
  csc_id: string | null;
  csc_token: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  issuer_city_ibge_code: string | null;
  address_zip_code: string | null;
  danfe_message: string | null;
  contingency_offline_enabled: boolean;
  print_customer_copy: boolean;
  danfe_auto_print: boolean;
  danfe_store_locally: boolean;
  consumer_document_prompt_enabled: boolean;
  danfe_print_width: '80mm' | '58mm';
  nuvem_fiscal_company_synced_at: string | null;
  nuvem_fiscal_nfce_config_synced_at: string | null;
  nuvem_fiscal_certificate_synced_at: string | null;
  nuvem_fiscal_last_error: string | null;
}

interface SaleRow {
  id: string;
  user_id: string;
  client_id: string | null;
  operator_user_id: string | null;
  seller_name: string | null;
  total: number;
  discount: number;
  payment_method: string;
  change_amount: number;
  cash_received: number;
  fiscal_customer_document: string | null;
  fiscal_customer_name: string | null;
  date: string;
  status: string | null;
}

interface SaleItemRow {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface ProductFiscalRow {
  id: string;
  code: number | null;
  barcode: string | null;
  fiscal_ncm: string | null;
  fiscal_cfop: string | null;
  fiscal_origin: number | null;
  fiscal_csosn: string | null;
  fiscal_pis_cst: string | null;
  fiscal_cofins_cst: string | null;
  fiscal_unit: string | null;
  fiscal_gtin: string | null;
  fiscal_cest: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  phone: string;
}

interface FiscalDocumentRow {
  id: string;
  sale_id: string;
  document_model: string;
  environment: string;
  status: string;
  series: number;
  number: number;
  access_key: string;
  protocol: string | null;
  homologation_message: string | null;
  external_id?: string | null;
  external_status?: string | null;
  provider?: string | null;
  payload: Record<string, unknown> | null;
  emitted_at: string;
}

interface NuvemFiscalDfe {
  id?: string;
  ambiente?: string;
  status?: string;
  referencia?: string | null;
  data_emissao?: string;
  modelo?: number;
  serie?: number;
  numero?: number;
  tipo_emissao?: number;
  valor_total?: number;
  chave?: string;
  autorizacao?: {
    id?: string;
    status?: string;
    codigo_status?: number;
    motivo_status?: string;
    numero_protocolo?: string;
    mensagem?: string;
  };
}

// The Edge Function does not import generated database types, so keep the
// service client typed by the small query surface used in helpers.
interface SupabaseFilterQuery {
  select: (columns?: string) => SupabaseFilterQuery;
  eq: (column: string, value: unknown) => SupabaseFilterQuery;
  maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
  single: () => PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
}

interface SupabaseTableQuery {
  update: (values: Record<string, unknown>) => SupabaseFilterQuery;
  select: (columns?: string) => SupabaseFilterQuery;
}

interface SupabaseServiceClient {
  from: (table: string) => SupabaseTableQuery;
}

const toFiscalSettingsRow = (value: Record<string, unknown> | null): Partial<FiscalSettingsRow> | null =>
  value as Partial<FiscalSettingsRow> | null;

const HOMOLOGATION_MESSAGE = 'EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
const SP_UF_CODE = '35';
const NUVEM_FISCAL_DEFAULT_AUTH_URL = 'https://auth.nuvemfiscal.com.br/oauth/token';
const NUVEM_FISCAL_DEFAULT_SANDBOX_URL = 'https://api.sandbox.nuvemfiscal.com.br';
const NUVEM_FISCAL_DEFAULT_PRODUCTION_URL = 'https://api.nuvemfiscal.com.br';

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ['POST', 'OPTIONS'],
      }).headers.entries()),
      'Content-Type': 'application/json',
    },
  });

const getBody = async (request: Request): Promise<ManageFiscalRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const digitsOnly = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

const padLeft = (value: string | number, length: number) => String(value).padStart(length, '0');

const roundMoney = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const toOptionalText = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeLimitedText = (value: string | null | undefined, maxLength: number) =>
  (toOptionalText(value) ?? '').slice(0, maxLength) || null;

const validateDesktopFiscalAccess = async (
  serviceClient: SupabaseServiceClient,
  userId: string,
  ownerUserId: string,
  body: ManageFiscalRequest,
): Promise<DesktopFiscalAccessResult> => {
  const license = await validateDesktopLicense(
    serviceClient as unknown as Parameters<typeof validateDesktopLicense>[0],
    userId,
    'happycash',
  );

  if (!license.ok) {
    return {
      ok: false,
      status: 403,
      code: license.code ?? 'PRO_DESKTOP_REQUIRED',
      message: license.message || 'A NFC-e fica disponivel somente para lojas com Plano PRO ativo no HappyCash Desktop.',
    };
  }

  if (license.planId !== 'pro') {
    return {
      ok: false,
      status: 403,
      code: 'PRO_DESKTOP_REQUIRED',
      message: 'A NFC-e fica disponivel somente para lojas com Plano PRO ativo no HappyCash Desktop.',
    };
  }

  const installationId = normalizeLimitedText(body.desktopInstallationId, 120);
  const appContext = normalizeLimitedText(body.desktopAppContext, 40);

  if (!installationId || appContext !== 'happycash') {
    return {
      ok: false,
      status: 403,
      code: 'DESKTOP_INSTALLATION_REQUIRED',
      message: 'A NFC-e deve ser emitida por uma instalacao ativada do HappyCash Desktop PRO.',
    };
  }

  const { data: activation, error } = await serviceClient
    .from('desktop_machine_activations')
    .select('id')
    .eq('owner_user_id', ownerUserId)
    .eq('app_context', 'happycash')
    .eq('installation_id', installationId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 503,
      code: 'DESKTOP_ACTIVATION_LOOKUP_FAILED',
      message: 'Nao foi possivel validar esta instalacao desktop agora.',
    };
  }

  if (!activation) {
    return {
      ok: false,
      status: 403,
      code: 'DESKTOP_INSTALLATION_NOT_FOUND',
      message: 'Esta maquina ainda nao esta ativada para emitir NFC-e pelo HappyCash Desktop PRO.',
    };
  }

  return {
    ok: true,
    status: 200,
    code: 'OK',
    message: 'OK',
  };
};

const asRecord = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : {};

const getNuvemFiscalBaseUrl = () => {
  const configured = Deno.env.get('NUVEM_FISCAL_API_BASE_URL')?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  return Deno.env.get('NUVEM_FISCAL_ENVIRONMENT') === 'production'
    ? NUVEM_FISCAL_DEFAULT_PRODUCTION_URL
    : NUVEM_FISCAL_DEFAULT_SANDBOX_URL;
};

const getNuvemFiscalAuthUrl = () => Deno.env.get('NUVEM_FISCAL_AUTH_URL')?.trim() || NUVEM_FISCAL_DEFAULT_AUTH_URL;

const isNuvemFiscalConfigured = () => Boolean(
  Deno.env.get('NUVEM_FISCAL_CLIENT_ID')?.trim()
  && Deno.env.get('NUVEM_FISCAL_CLIENT_SECRET')?.trim()
);

class NuvemFiscalError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'NuvemFiscalError';
    this.status = status;
    this.payload = payload;
  }
}

const getPublicNuvemFiscalError = (error: unknown) => {
  if (error instanceof NuvemFiscalError) {
    const payload = asRecord(error.payload);
    const nestedError = asRecord(payload.error);
    const message = String(nestedError.message ?? payload.message ?? error.message ?? '').trim();
    return message || `A Nuvem Fiscal recusou a operacao (${error.status}).`;
  }

  return error instanceof Error && error.message.trim()
    ? error.message
    : 'Nao foi possivel concluir a operacao na Nuvem Fiscal.';
};

const getNuvemFiscalToken = async (scope = 'empresa nfce') => {
  const clientId = Deno.env.get('NUVEM_FISCAL_CLIENT_ID')?.trim();
  const clientSecret = Deno.env.get('NUVEM_FISCAL_CLIENT_SECRET')?.trim();

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da Nuvem Fiscal nao configuradas nos secrets do Supabase.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: Deno.env.get('NUVEM_FISCAL_TOKEN_SCOPE')?.trim() || scope,
  });

  const response = await fetch(getNuvemFiscalAuthUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new NuvemFiscalError(response.status, 'Falha ao autenticar na Nuvem Fiscal.', payload);
  }

  const token = String(asRecord(payload).access_token ?? '').trim();
  if (!token) {
    throw new Error('A Nuvem Fiscal nao retornou token de acesso.');
  }

  return token;
};

const nuvemFiscalRequest = async <T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  scope = 'empresa nfce',
) => {
  const token = await getNuvemFiscalToken(scope);
  const response = await fetch(`${getNuvemFiscalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    throw new NuvemFiscalError(response.status, 'A Nuvem Fiscal recusou a operacao.', payload);
  }

  return payload as T;
};

const currentAaMm = (value: string) => {
  const date = new Date(value);
  const year = padLeft(date.getFullYear() % 100, 2);
  const month = padLeft(date.getMonth() + 1, 2);
  return `${year}${month}`;
};

const getFiscalMode = (settings: FiscalSettingsRow | null) =>
  settings?.fiscal_mode === 'nfce' || settings?.nfce_enabled ? 'nfce' : 'receipt_only';

const getEffectiveFiscalProvider = (_settings: FiscalSettingsRow | null): FiscalSettingsRow['fiscal_provider'] =>
  'internal';

const buildMissingItems = (settings: FiscalSettingsRow | null) => {
  if (!settings) {
    return ['Configuracao fiscal da loja'];
  }

  if (getFiscalMode(settings) === 'receipt_only') {
    return [];
  }

  const missing = [
    ['Razao social do emitente', settings.issuer_legal_name],
    ['CNPJ do emitente', digitsOnly(settings.issuer_cnpj).length === 14 ? 'ok' : ''],
    ['Inscricao estadual', settings.issuer_state_registration],
    ['Regime tributario (CRT)', settings.issuer_tax_regime],
    ['Natureza da operacao', settings.operation_nature],
    ['CSC ID', digitsOnly(settings.csc_id) ? 'ok' : ''],
    ['CSC token', settings.csc_token],
    ['Logradouro', settings.address_street],
    ['Numero', settings.address_number],
    ['Bairro', settings.address_district],
    ['Municipio', settings.address_city],
    ...(settings.fiscal_provider === 'nuvem_fiscal'
      ? [['Codigo IBGE do municipio', digitsOnly(settings.issuer_city_ibge_code).length === 7 ? 'ok' : '']] as const
      : []),
    ['CEP', digitsOnly(settings.address_zip_code).length === 8 ? 'ok' : ''],
    ['Serie NFC-e', settings.nfce_series > 0 ? 'ok' : ''],
    ['Proximo numero NFC-e', settings.nfce_next_number > 0 ? 'ok' : ''],
  ] as const;

  return missing.filter(([, value]) => !value).map(([label]) => label);
};

const computeMod11Dv = (base: string) => {
  let multiplier = 2;
  let total = 0;

  for (let index = base.length - 1; index >= 0; index -= 1) {
    total += Number(base[index]) * multiplier;
    multiplier = multiplier === 9 ? 2 : multiplier + 1;
  }

  const remainder = total % 11;
  const digit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return String(digit);
};

const randomNumericCode = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => String(byte % 10)).join('').slice(0, length);
};

const buildAccessKey = (settings: FiscalSettingsRow, saleDate: string, number: number) => {
  const cnpj = padLeft(digitsOnly(settings.issuer_cnpj), 14);
  const base = [
    SP_UF_CODE,
    currentAaMm(saleDate),
    cnpj,
    '65',
    padLeft(settings.nfce_series, 3),
    padLeft(number, 9),
    '1',
    randomNumericCode(8),
  ].join('');

  return `${base}${computeMod11Dv(base)}`;
};

const normalizeFiscalDocument = (row: FiscalDocumentRow) => ({
  id: row.id,
  saleId: row.sale_id,
  documentModel: row.document_model,
  environment: row.environment,
  status: row.status,
  series: row.series,
  number: row.number,
  accessKey: row.access_key,
  protocol: row.protocol,
  homologationMessage: row.homologation_message,
  provider: row.provider ?? 'internal',
  externalId: row.external_id ?? null,
  externalStatus: row.external_status ?? null,
  payload: row.payload,
  emittedAt: row.emitted_at,
});

const reserveNextNumber = async (
  serviceClient: SupabaseServiceClient,
  settings: FiscalSettingsRow,
  updatedByUserId: string,
) => {
  let currentNumber = settings.nfce_next_number;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await serviceClient
      .from('store_fiscal_settings')
      .update({
        nfce_next_number: currentNumber + 1,
        updated_by_user_id: updatedByUserId,
      })
      .eq('id', settings.id)
      .eq('nfce_next_number', currentNumber)
      .select('nfce_next_number')
      .maybeSingle();

    if (!error && data) {
      return currentNumber;
    }

    const refresh = await serviceClient
      .from('store_fiscal_settings')
      .select('nfce_next_number')
      .eq('id', settings.id)
      .single();

    if (refresh.error || !refresh.data) {
      break;
    }

    const refreshedSettings = toFiscalSettingsRow(refresh.data);
    currentNumber = Number(refreshedSettings?.nfce_next_number ?? currentNumber + 1);
  }

  throw new Error('Nao foi possivel reservar a numeracao fiscal agora.');
};

const mapPaymentMethodToNfce = (value: string) => {
  switch (value) {
    case 'dinheiro':
      return '01';
    case 'cartao_credito':
      return '03';
    case 'cartao_debito':
      return '04';
    case 'fiado':
      return '05';
    case 'pix':
      return '17';
    default:
      return '99';
  }
};

const allocateDiscounts = (items: SaleItemRow[], totalDiscount: number) => {
  const discount = roundMoney(Math.max(0, Number(totalDiscount || 0)));
  const grossTotal = roundMoney(items.reduce((sum, item) => sum + Number(item.total || 0), 0));

  if (items.length === 0 || discount <= 0 || grossTotal <= 0) {
    return items.map(() => 0);
  }

  let allocated = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) {
      return roundMoney(Math.max(0, discount - allocated));
    }

    const itemDiscount = roundMoney((Number(item.total || 0) / grossTotal) * discount);
    allocated = roundMoney(allocated + itemDiscount);
    return itemDiscount;
  });
};

const buildPayloadSnapshot = (
  settings: FiscalSettingsRow,
  sale: SaleRow,
  items: SaleItemRow[],
  client: ClientRow | null,
) => {
  const customerDocument = digitsOnly(sale.fiscal_customer_document);
  const customerName = toOptionalText(sale.fiscal_customer_name) || client?.name || null;

  return {
    issuer: {
      legalName: settings.issuer_legal_name,
      tradeName: settings.issuer_trade_name,
      cnpj: settings.issuer_cnpj,
      stateRegistration: settings.issuer_state_registration,
      addressStreet: settings.address_street,
      addressNumber: settings.address_number,
      addressComplement: settings.address_complement,
      addressDistrict: settings.address_district,
      addressCity: settings.address_city,
      addressZipCode: settings.address_zip_code,
      state: settings.issuer_state,
    },
    customer: customerName || customerDocument || client
      ? {
          name: customerName,
          document: customerDocument || null,
          phone: client?.phone ?? null,
        }
      : null,
    sale: {
      sellerName: sale.seller_name,
      paymentMethod: sale.payment_method,
      total: Number(sale.total ?? 0),
      discount: Number(sale.discount ?? 0),
      changeAmount: Number(sale.change_amount ?? 0),
      cashReceived: Number(sale.cash_received ?? 0),
      date: sale.date,
      operationNature: settings.operation_nature,
    },
    items: items.map(item => ({
      productName: item.product_name,
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unit_price ?? 0),
      total: Number(item.total ?? 0),
    })),
    danfeMessage: settings.danfe_message,
    printCustomerCopy: settings.print_customer_copy,
    contingencyOfflineEnabled: settings.contingency_offline_enabled,
  };
};

const validateProductsForNuvemFiscal = (items: SaleItemRow[], productsById: Map<string, ProductFiscalRow>) => {
  const missing: string[] = [];

  items.forEach((item) => {
    if (!item.product_id) {
      missing.push(`${item.product_name}: produto sem vinculo fiscal`);
      return;
    }

    const product = productsById.get(item.product_id);
    if (!product) {
      missing.push(`${item.product_name}: produto nao encontrado`);
      return;
    }

    if (digitsOnly(product.fiscal_ncm).length !== 8) missing.push(`${item.product_name}: NCM`);
    if (digitsOnly(product.fiscal_cfop).length !== 4) missing.push(`${item.product_name}: CFOP`);
    if (product.fiscal_origin === null || product.fiscal_origin === undefined) missing.push(`${item.product_name}: origem`);
    if (!digitsOnly(product.fiscal_csosn)) missing.push(`${item.product_name}: CSOSN`);
    if (!digitsOnly(product.fiscal_pis_cst)) missing.push(`${item.product_name}: PIS CST`);
    if (!digitsOnly(product.fiscal_cofins_cst)) missing.push(`${item.product_name}: COFINS CST`);
    if (!toOptionalText(product.fiscal_unit)) missing.push(`${item.product_name}: unidade fiscal`);
  });

  return missing;
};

const buildNuvemFiscalIssuePayload = (
  settings: FiscalSettingsRow,
  sale: SaleRow,
  items: SaleItemRow[],
  productsById: Map<string, ProductFiscalRow>,
  number: number,
) => {
  const discounts = allocateDiscounts(items, Number(sale.discount || 0));
  const grossTotal = roundMoney(items.reduce((sum, item) => sum + Number(item.total || 0), 0));
  const totalDiscount = roundMoney(Number(sale.discount || 0));
  const total = roundMoney(Number(sale.total || Math.max(0, grossTotal - totalDiscount)));
  const cashReceived = roundMoney(Number(sale.cash_received || 0));
  const changeAmount = roundMoney(Number(sale.change_amount || 0));
  const paymentValue = sale.payment_method === 'dinheiro' && cashReceived > total ? cashReceived : total;
  const isSimpleNational = ['1', '2', '4'].includes(String(settings.issuer_tax_regime || ''));
  const customerDocument = digitsOnly(sale.fiscal_customer_document);
  const customerName = toOptionalText(sale.fiscal_customer_name);
  const destination = customerDocument.length === 11 || customerDocument.length === 14
    ? {
        ...(customerDocument.length === 11 ? { CPF: customerDocument } : { CNPJ: customerDocument }),
        ...(customerName ? { xNome: customerName } : {}),
        indIEDest: 9,
      }
    : null;

  if (!isSimpleNational) {
    throw new Error('A emissao automatica inicial pela Nuvem Fiscal suporta apenas CRT Simples Nacional com CSOSN por produto.');
  }

  return {
    ambiente: settings.nfce_environment,
    referencia: sale.id,
    infNFe: {
      versao: '4.00',
      ide: {
        cUF: 35,
        natOp: settings.operation_nature,
        mod: 65,
        serie: settings.nfce_series,
        nNF: number,
        dhEmi: new Date(sale.date).toISOString(),
        tpNF: 1,
        idDest: 1,
        cMunFG: digitsOnly(settings.issuer_city_ibge_code),
        tpImp: 4,
        tpEmis: 1,
        tpAmb: settings.nfce_environment === 'producao' ? 1 : 2,
        finNFe: 1,
        indFinal: 1,
        indPres: 1,
        procEmi: 0,
        verProc: 'HappyCash',
      },
      emit: {
        CNPJ: digitsOnly(settings.issuer_cnpj),
        xNome: settings.issuer_legal_name,
        xFant: toOptionalText(settings.issuer_trade_name),
        IE: digitsOnly(settings.issuer_state_registration),
        CRT: Number(settings.issuer_tax_regime || 1),
        enderEmit: {
          xLgr: settings.address_street,
          nro: settings.address_number,
          xCpl: toOptionalText(settings.address_complement),
          xBairro: settings.address_district,
          cMun: digitsOnly(settings.issuer_city_ibge_code),
          xMun: settings.address_city,
          UF: settings.issuer_state,
          CEP: digitsOnly(settings.address_zip_code),
          cPais: '1058',
          xPais: 'Brasil',
        },
      },
      ...(destination ? { dest: destination } : {}),
      det: items.map((item, index) => {
        const product = productsById.get(item.product_id || '')!;
        const unit = toOptionalText(product.fiscal_unit)?.toUpperCase() || 'UN';
        const gtin = toOptionalText(product.fiscal_gtin) || toOptionalText(product.barcode) || 'SEM GTIN';
        const lineTotal = roundMoney(Number(item.total || 0));

        return {
          nItem: index + 1,
          prod: {
            cProd: String(product.code || item.product_id || index + 1).slice(0, 60),
            cEAN: gtin,
            xProd: item.product_name,
            NCM: digitsOnly(product.fiscal_ncm),
            CEST: toOptionalText(digitsOnly(product.fiscal_cest)),
            CFOP: digitsOnly(product.fiscal_cfop),
            uCom: unit,
            qCom: Number(item.quantity || 0),
            vUnCom: roundMoney(Number(item.unit_price || 0)),
            vProd: lineTotal,
            vDesc: discounts[index] > 0 ? discounts[index] : undefined,
            cEANTrib: gtin,
            uTrib: unit,
            qTrib: Number(item.quantity || 0),
            vUnTrib: roundMoney(Number(item.unit_price || 0)),
            indTot: 1,
          },
          imposto: {
            ICMS: {
              ICMSSN102: {
                orig: product.fiscal_origin,
                CSOSN: digitsOnly(product.fiscal_csosn),
              },
            },
            PIS: {
              PISNT: {
                CST: digitsOnly(product.fiscal_pis_cst),
              },
            },
            COFINS: {
              COFINSNT: {
                CST: digitsOnly(product.fiscal_cofins_cst),
              },
            },
          },
        };
      }),
      total: {
        ICMSTot: {
          vBC: 0,
          vICMS: 0,
          vICMSDeson: 0,
          vFCP: 0,
          vBCST: 0,
          vST: 0,
          vFCPST: 0,
          vFCPSTRet: 0,
          vProd: grossTotal,
          vFrete: 0,
          vSeg: 0,
          vDesc: totalDiscount,
          vII: 0,
          vIPI: 0,
          vIPIDevol: 0,
          vPIS: 0,
          vCOFINS: 0,
          vOutro: 0,
          vNF: total,
        },
      },
      transp: {
        modFrete: 9,
      },
      pag: {
        detPag: [{
          tPag: mapPaymentMethodToNfce(sale.payment_method),
          vPag: paymentValue,
        }],
        ...(changeAmount > 0 ? { vTroco: changeAmount } : {}),
      },
      ...(settings.danfe_message ? { infAdic: { infCpl: settings.danfe_message } } : {}),
    },
  };
};

const mapNuvemFiscalDocumentStatus = (status: string | undefined) => {
  switch (status) {
    case 'autorizado':
      return 'autorizada';
    case 'cancelado':
      return 'cancelada';
    case 'pendente':
      return 'pendente';
    case 'rejeitado':
    case 'denegado':
    case 'erro':
      return 'erro';
    default:
      return 'pendente';
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo nao suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuracao do Supabase invalida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
  }

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: 'manage-fiscal-documents',
    limit: readRateLimitEnv('MANAGE_FISCAL_DOCUMENTS_RATE_LIMIT_PER_MINUTE', 120),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: 'Muitas requisicoes fiscais em pouco tempo. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
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
  const fiscalServiceClient = serviceClient as unknown as SupabaseServiceClient;

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
  }

  const body = await getBody(request);
  if (!body?.action) {
    return jsonResponse(request, { error: 'Acao invalida.' }, 400);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id, username, email')
    .eq('user_id', user.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse(request, { error: 'Perfil do usuario nao encontrado.' }, 403);
  }

  const typedCallerProfile = callerProfile as CallerProfileRow;

  if (typedCallerProfile.role !== 'admin') {
    return jsonResponse(request, { error: 'Somente administradores podem emitir documentos fiscais.' }, 403);
  }

  const ownerUserId = typedCallerProfile.owner_user_id ?? user.id;
  const desktopFiscalAccess = await validateDesktopFiscalAccess(fiscalServiceClient, user.id, ownerUserId, body);

  if (!desktopFiscalAccess.ok) {
    return jsonResponse(request, {
      error: desktopFiscalAccess.message,
      code: desktopFiscalAccess.code,
    }, desktopFiscalAccess.status);
  }

  const { data: settingsData, error: settingsError } = await serviceClient
    .from('store_fiscal_settings')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  if (settingsError) {
    return jsonResponse(request, { error: 'Nao foi possivel carregar a configuracao fiscal da loja.' }, 500);
  }

  const settings = (settingsData ?? null) as FiscalSettingsRow | null;
  const missingItems = buildMissingItems(settings);

  if (body.action === 'runtime_status') {
    const provider = getEffectiveFiscalProvider(settings);
    const fiscalMode = getFiscalMode(settings);

    return jsonResponse(request, {
      success: true,
      runtime: {
        enabled: fiscalMode === 'nfce' && Boolean(settings?.nfce_enabled),
        fiscalMode,
        provider,
        environment: settings?.nfce_environment ?? 'homologacao',
        ready: fiscalMode === 'receipt_only' || missingItems.length === 0,
        providerConfigured: fiscalMode === 'receipt_only' || provider === 'internal' || isNuvemFiscalConfigured(),
        danfeAutoPrint: settings?.danfe_auto_print === true,
        danfeStoreLocally: settings?.danfe_store_locally !== false,
        consumerDocumentPromptEnabled: settings?.consumer_document_prompt_enabled !== false,
        danfePrintWidth: settings?.danfe_print_width === '58mm' ? '58mm' : '80mm',
        series: settings?.nfce_series ?? 1,
        nextNumber: settings?.nfce_next_number ?? 1,
        operationNature: settings?.operation_nature ?? null,
        issuerName: settings?.issuer_trade_name || settings?.issuer_legal_name || null,
        printCustomerCopy: settings?.print_customer_copy ?? true,
        contingencyOfflineEnabled: settings?.contingency_offline_enabled ?? true,
        nuvemFiscalCompanySyncedAt: settings?.nuvem_fiscal_company_synced_at ?? null,
        nuvemFiscalNfceConfigSyncedAt: settings?.nuvem_fiscal_nfce_config_synced_at ?? null,
        nuvemFiscalCertificateSyncedAt: settings?.nuvem_fiscal_certificate_synced_at ?? null,
        nuvemFiscalLastError: settings?.nuvem_fiscal_last_error ?? null,
        missingItems,
      },
    });
  }

  if (body.action === 'sync_nuvem_fiscal_settings') {
    return jsonResponse(request, { error: 'Integracao com API fiscal externa desativada. A NFC-e ficara restrita ao Desktop PRO com motor fiscal local.' }, 410);
  }

  if (body.action === 'upload_nuvem_fiscal_certificate') {
    return jsonResponse(request, { error: 'Envio de certificado para API fiscal externa desativado. O certificado deve ficar no ambiente local do cliente no Desktop PRO.' }, 410);
  }

  if (body.action !== 'issue_nfce_homologation') {
    return jsonResponse(request, { error: 'Acao fiscal nao suportada.' }, 400);
  }

  if (!body.saleId?.trim()) {
    return jsonResponse(request, { error: 'Venda invalida para emissao da NFC-e.' }, 400);
  }

  if (!settings || getFiscalMode(settings) !== 'nfce' || !settings.nfce_enabled) {
    return jsonResponse(request, { error: 'A NFC-e nao esta ativada para esta loja.' }, 400);
  }

  const fiscalProvider = getEffectiveFiscalProvider(settings);

  if (fiscalProvider === 'internal' && settings.nfce_environment !== 'homologacao') {
    return jsonResponse(request, { error: 'Somente o fluxo inicial de homologacao esta disponivel nesta etapa.' }, 400);
  }

  if (fiscalProvider === 'nuvem_fiscal' && !isNuvemFiscalConfigured()) {
    return jsonResponse(request, { error: 'As credenciais da Nuvem Fiscal nao estao configuradas no servidor.' }, 500);
  }

  if (missingItems.length > 0) {
    return jsonResponse(request, {
      error: 'Complete a configuracao fiscal da loja antes de emitir a NFC-e.',
      missingItems,
    }, 400);
  }

  const saleId = body.saleId.trim();

  const { data: existingDocument, error: existingDocumentError } = await serviceClient
    .from('fiscal_documents')
    .select('*')
    .eq('sale_id', saleId)
    .maybeSingle();

  if (existingDocumentError) {
    return jsonResponse(request, { error: 'Nao foi possivel consultar o documento fiscal existente.' }, 500);
  }

  if (existingDocument && String(existingDocument.status ?? '') !== 'erro') {
    return jsonResponse(request, {
      success: true,
      document: normalizeFiscalDocument(existingDocument as FiscalDocumentRow),
      reused: true,
    });
  }

  const { data: saleData, error: saleError } = await serviceClient
    .from('sales')
    .select('id, user_id, client_id, operator_user_id, seller_name, total, discount, payment_method, change_amount, cash_received, fiscal_customer_document, fiscal_customer_name, date, status')
    .eq('id', saleId)
    .eq('user_id', ownerUserId)
    .single();

  if (saleError || !saleData) {
    return jsonResponse(request, { error: 'Venda nao encontrada para a emissao da NFC-e.' }, 404);
  }

  const sale = saleData as SaleRow;

  if (sale.status === 'cancelled') {
    return jsonResponse(request, { error: 'Nao e possivel emitir NFC-e para venda cancelada.' }, 400);
  }

  const { data: itemsData, error: itemsError } = await serviceClient
    .from('sale_items')
    .select('product_id, product_name, quantity, unit_price, total')
    .eq('sale_id', saleId);

  if (itemsError) {
    return jsonResponse(request, { error: 'Nao foi possivel carregar os itens da venda.' }, 500);
  }

  const items = (itemsData as SaleItemRow[] | null) ?? [];
  if (items.length === 0) {
    return jsonResponse(request, { error: 'A venda nao possui itens para emissao da NFC-e.' }, 400);
  }

  let client: ClientRow | null = null;
  if (sale.client_id) {
    const { data: clientData } = await serviceClient
      .from('clients')
      .select('id, name, phone')
      .eq('id', sale.client_id)
      .maybeSingle();

    client = (clientData as ClientRow | null) ?? null;
  }

  if (fiscalProvider === 'nuvem_fiscal') {
    const productIds = Array.from(new Set(items.map(item => item.product_id).filter(Boolean))) as string[];
    const { data: productsData, error: productsError } = productIds.length > 0
      ? await serviceClient
        .from('products')
        .select('id, code, barcode, fiscal_ncm, fiscal_cfop, fiscal_origin, fiscal_csosn, fiscal_pis_cst, fiscal_cofins_cst, fiscal_unit, fiscal_gtin, fiscal_cest')
        .in('id', productIds)
      : { data: [], error: null };

    if (productsError) {
      return jsonResponse(request, { error: 'Nao foi possivel carregar os dados fiscais dos produtos.' }, 500);
    }

    const productsById = new Map(
      ((productsData as ProductFiscalRow[] | null) ?? []).map(product => [product.id, product]),
    );
    const productMissingItems = validateProductsForNuvemFiscal(items, productsById);

    if (productMissingItems.length > 0) {
      return jsonResponse(request, {
        error: 'Complete os dados fiscais dos produtos antes de emitir pela Nuvem Fiscal.',
        missingItems: productMissingItems,
      }, 400);
    }

    const number = await reserveNextNumber(fiscalServiceClient, settings, user.id);
    const fallbackAccessKey = buildAccessKey(settings, sale.date, number);
    const nowIso = new Date().toISOString();
    let externalDocument: NuvemFiscalDfe | null = null;
    let externalErrorMessage = '';

    try {
      const nuvemPayload = buildNuvemFiscalIssuePayload(settings, sale, items, productsById, number);
      externalDocument = await nuvemFiscalRequest<NuvemFiscalDfe>('POST', '/nfce', nuvemPayload, 'nfce');
    } catch (error) {
      externalErrorMessage = getPublicNuvemFiscalError(error);
      await serviceClient
        .from('store_fiscal_settings')
        .update({
          nuvem_fiscal_last_error: externalErrorMessage,
          updated_by_user_id: user.id,
        })
        .eq('id', settings.id);
    }

    if (!externalDocument) {
      const errorPayload = {
        ...buildPayloadSnapshot(settings, sale, items, client),
        provider: 'nuvem_fiscal',
        error: externalErrorMessage,
      };
      const mutation = {
        owner_user_id: ownerUserId,
        sale_id: sale.id,
        operator_user_id: sale.operator_user_id,
        created_by_user_id: user.id,
        document_model: '65',
        environment: settings.nfce_environment,
        provider: 'nuvem_fiscal',
        status: 'erro',
        series: settings.nfce_series,
        number,
        access_key: fallbackAccessKey,
        protocol: null,
        homologation_message: null,
        error_message: externalErrorMessage,
        payload: errorPayload,
        emitted_at: nowIso,
      };

      const result = existingDocument
        ? await serviceClient.from('fiscal_documents').update(mutation).eq('id', existingDocument.id).select('*').single()
        : await serviceClient.from('fiscal_documents').insert(mutation).select('*').single();

      if (result.error || !result.data) {
        return jsonResponse(request, { error: externalErrorMessage || 'Nao foi possivel registrar a falha fiscal.' }, 502);
      }

      return jsonResponse(request, {
        success: false,
        error: externalErrorMessage || 'A Nuvem Fiscal recusou a emissao da NFC-e.',
        document: normalizeFiscalDocument(result.data as FiscalDocumentRow),
      }, 502);
    }

    const status = mapNuvemFiscalDocumentStatus(externalDocument.status);
    const protocol = externalDocument.autorizacao?.numero_protocolo
      || externalDocument.autorizacao?.id
      || null;
    const errorMessage = status === 'erro'
      ? externalDocument.autorizacao?.motivo_status || externalDocument.autorizacao?.mensagem || 'NFC-e rejeitada pela Nuvem Fiscal/SEFAZ.'
      : null;
    const payload = {
      ...buildPayloadSnapshot(settings, sale, items, client),
      provider: 'nuvem_fiscal',
      nuvemFiscal: {
        id: externalDocument.id ?? null,
        status: externalDocument.status ?? null,
        referencia: externalDocument.referencia ?? null,
        autorizacao: externalDocument.autorizacao ?? null,
      },
    };
    const documentMutation = {
      owner_user_id: ownerUserId,
      sale_id: sale.id,
      operator_user_id: sale.operator_user_id,
      created_by_user_id: user.id,
      document_model: '65',
      environment: externalDocument.ambiente || settings.nfce_environment,
      provider: 'nuvem_fiscal',
      external_id: externalDocument.id ?? null,
      external_status: externalDocument.status ?? null,
      status,
      series: Number(externalDocument.serie ?? settings.nfce_series),
      number: Number(externalDocument.numero ?? number),
      access_key: externalDocument.chave || fallbackAccessKey,
      protocol,
      homologation_message: settings.nfce_environment === 'homologacao' ? HOMOLOGATION_MESSAGE : null,
      error_message: errorMessage,
      payload,
      emitted_at: externalDocument.data_emissao || nowIso,
    };

    const result = existingDocument
      ? await serviceClient.from('fiscal_documents').update(documentMutation).eq('id', existingDocument.id).select('*').single()
      : await serviceClient.from('fiscal_documents').insert(documentMutation).select('*').single();

    if (result.error || !result.data) {
      return jsonResponse(request, { error: 'Nao foi possivel registrar o retorno da Nuvem Fiscal.' }, 500);
    }

    await serviceClient
      .from('store_fiscal_settings')
      .update({
        nuvem_fiscal_last_error: errorMessage,
        updated_by_user_id: user.id,
      })
      .eq('id', settings.id);

    return jsonResponse(request, {
      success: true,
      document: normalizeFiscalDocument(result.data as FiscalDocumentRow),
      reused: false,
    });
  }

  const number = await reserveNextNumber(fiscalServiceClient, settings, user.id);
  const accessKey = buildAccessKey(settings, sale.date, number);
  const nowIso = new Date().toISOString();
  const protocol = `HSP-${padLeft(number, 9)}-${nowIso.replace(/\D/g, '').slice(0, 14)}`;

  const payload = buildPayloadSnapshot(settings, sale, items, client);

  const { data: createdDocument, error: createDocumentError } = await serviceClient
    .from('fiscal_documents')
    .insert({
      owner_user_id: ownerUserId,
      sale_id: sale.id,
      operator_user_id: sale.operator_user_id,
      created_by_user_id: user.id,
      document_model: '65',
      environment: 'homologacao',
      provider: 'internal',
      status: 'homologacao_emitida',
      series: settings.nfce_series,
      number,
      access_key: accessKey,
      protocol,
      homologation_message: HOMOLOGATION_MESSAGE,
      payload,
      emitted_at: nowIso,
    })
    .select('*')
    .single();

  if (createDocumentError || !createdDocument) {
    return jsonResponse(request, { error: 'Nao foi possivel registrar o documento fiscal de homologacao.' }, 500);
  }

  return jsonResponse(request, {
    success: true,
    document: normalizeFiscalDocument(createdDocument as FiscalDocumentRow),
    reused: false,
  });
});
