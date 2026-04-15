import { createClient } from 'npm:@supabase/supabase-js@2';

type ManageFiscalRequest =
  | {
      action: 'runtime_status';
    }
  | {
      action: 'issue_nfce_homologation';
      saleId?: string;
    };

interface CallerProfileRow {
  role: string;
  owner_user_id: string | null;
  username: string | null;
  email: string | null;
}

interface FiscalSettingsRow {
  id: string;
  owner_user_id: string;
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
  address_zip_code: string | null;
  danfe_message: string | null;
  contingency_offline_enabled: boolean;
  print_customer_copy: boolean;
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
  date: string;
  status: string | null;
}

interface SaleItemRow {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
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
  payload: Record<string, unknown> | null;
  emitted_at: string;
}

const HOMOLOGATION_MESSAGE = 'EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
const SP_UF_CODE = '35';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

const currentAaMm = (value: string) => {
  const date = new Date(value);
  const year = padLeft(date.getFullYear() % 100, 2);
  const month = padLeft(date.getMonth() + 1, 2);
  return `${year}${month}`;
};

const buildMissingItems = (settings: FiscalSettingsRow | null) => {
  if (!settings) {
    return ['Configuracao fiscal da loja'];
  }

  const missing = [
    ['Razao social do emitente', settings.issuer_legal_name],
    ['CNPJ do emitente', digitsOnly(settings.issuer_cnpj).length === 14 ? 'ok' : ''],
    ['Inscricao estadual', settings.issuer_state_registration],
    ['Regime tributario (CRT)', settings.issuer_tax_regime],
    ['Natureza da operacao', settings.operation_nature],
    ['CSC ID', settings.csc_id],
    ['CSC token', settings.csc_token],
    ['Logradouro', settings.address_street],
    ['Numero', settings.address_number],
    ['Bairro', settings.address_district],
    ['Municipio', settings.address_city],
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
  payload: row.payload,
  emittedAt: row.emitted_at,
});

const reserveNextNumber = async (
  serviceClient: ReturnType<typeof createClient>,
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

    currentNumber = Number(refresh.data.nfce_next_number ?? currentNumber + 1);
  }

  throw new Error('Nao foi possivel reservar a numeracao fiscal agora.');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Configuracao do Supabase invalida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse({ error: 'Sessao invalida. Faca login novamente.' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
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
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse({ error: 'Sessao invalida. Faca login novamente.' }, 401);
  }

  const body = await getBody(request);
  if (!body?.action) {
    return jsonResponse({ error: 'Acao invalida.' }, 400);
  }

  const { data: callerProfile, error: callerProfileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id, username, email')
    .eq('user_id', user.id)
    .single();

  if (callerProfileError || !callerProfile) {
    return jsonResponse({ error: 'Perfil do usuario nao encontrado.' }, 403);
  }

  const typedCallerProfile = callerProfile as CallerProfileRow;
  const ownerUserId = typedCallerProfile.owner_user_id ?? user.id;

  const { data: settingsData, error: settingsError } = await serviceClient
    .from('store_fiscal_settings')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();

  if (settingsError) {
    return jsonResponse({ error: 'Nao foi possivel carregar a configuracao fiscal da loja.' }, 500);
  }

  const settings = (settingsData ?? null) as FiscalSettingsRow | null;
  const missingItems = buildMissingItems(settings);

  if (body.action === 'runtime_status') {
    return jsonResponse({
      success: true,
      runtime: {
        enabled: Boolean(settings?.nfce_enabled),
        environment: settings?.nfce_environment ?? 'homologacao',
        ready: missingItems.length === 0,
        series: settings?.nfce_series ?? 1,
        nextNumber: settings?.nfce_next_number ?? 1,
        operationNature: settings?.operation_nature ?? null,
        issuerName: settings?.issuer_trade_name || settings?.issuer_legal_name || null,
        printCustomerCopy: settings?.print_customer_copy ?? true,
        contingencyOfflineEnabled: settings?.contingency_offline_enabled ?? true,
        missingItems,
      },
    });
  }

  if (body.action !== 'issue_nfce_homologation') {
    return jsonResponse({ error: 'Acao fiscal nao suportada.' }, 400);
  }

  if (!body.saleId?.trim()) {
    return jsonResponse({ error: 'Venda invalida para emissao da NFC-e.' }, 400);
  }

  if (!settings || !settings.nfce_enabled) {
    return jsonResponse({ error: 'A NFC-e nao esta ativada para esta loja.' }, 400);
  }

  if (settings.nfce_environment !== 'homologacao') {
    return jsonResponse({ error: 'Somente o fluxo inicial de homologacao esta disponivel nesta etapa.' }, 400);
  }

  if (missingItems.length > 0) {
    return jsonResponse({
      error: 'Complete a configuracao fiscal da loja antes de emitir a NFC-e em homologacao.',
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
    return jsonResponse({ error: 'Nao foi possivel consultar o documento fiscal existente.' }, 500);
  }

  if (existingDocument) {
    return jsonResponse({
      success: true,
      document: normalizeFiscalDocument(existingDocument as FiscalDocumentRow),
      reused: true,
    });
  }

  const { data: saleData, error: saleError } = await serviceClient
    .from('sales')
    .select('id, user_id, client_id, operator_user_id, seller_name, total, discount, payment_method, change_amount, cash_received, date, status')
    .eq('id', saleId)
    .eq('user_id', ownerUserId)
    .single();

  if (saleError || !saleData) {
    return jsonResponse({ error: 'Venda nao encontrada para a emissao da NFC-e.' }, 404);
  }

  const sale = saleData as SaleRow;

  if (sale.status === 'cancelled') {
    return jsonResponse({ error: 'Nao e possivel emitir NFC-e para venda cancelada.' }, 400);
  }

  const { data: itemsData, error: itemsError } = await serviceClient
    .from('sale_items')
    .select('product_name, quantity, unit_price, total')
    .eq('sale_id', saleId);

  if (itemsError) {
    return jsonResponse({ error: 'Nao foi possivel carregar os itens da venda.' }, 500);
  }

  const items = (itemsData as SaleItemRow[] | null) ?? [];
  if (items.length === 0) {
    return jsonResponse({ error: 'A venda nao possui itens para emissao da NFC-e.' }, 400);
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

  const number = await reserveNextNumber(serviceClient, settings, user.id);
  const accessKey = buildAccessKey(settings, sale.date, number);
  const nowIso = new Date().toISOString();
  const protocol = `HSP-${padLeft(number, 9)}-${nowIso.replace(/\D/g, '').slice(0, 14)}`;

  const payload = {
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
    customer: client
      ? {
          name: client.name,
          phone: client.phone,
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

  const { data: createdDocument, error: createDocumentError } = await serviceClient
    .from('fiscal_documents')
    .insert({
      owner_user_id: ownerUserId,
      sale_id: sale.id,
      operator_user_id: sale.operator_user_id,
      created_by_user_id: user.id,
      document_model: '65',
      environment: 'homologacao',
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
    return jsonResponse({ error: 'Nao foi possivel registrar o documento fiscal de homologacao.' }, 500);
  }

  return jsonResponse({
    success: true,
    document: normalizeFiscalDocument(createdDocument as FiscalDocumentRow),
    reused: false,
  });
});
