import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import {
  encodeTextAttachment,
  escapeHtml,
  getHappyCashFromEmail,
  isValidEmailRecipient,
  normalizeEmailRecipients,
  renderHappyCashEmail,
  sendHappyCashEmail,
} from '../_shared/happycashEmail.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';

type FiscalDocumentEmailRequest = {
  documentId?: string;
  recipients?: string[] | string;
  timezone?: string;
};

type CallerProfileRow = {
  role: string | null;
  owner_user_id: string | null;
  email: string | null;
};

type StoreAccountRow = {
  email: string | null;
  nome_estabelecimento: string | null;
};

type FiscalDocumentRow = {
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
  error_message: string | null;
  provider: string | null;
  external_id: string | null;
  external_status: string | null;
  payload: Record<string, unknown> | null;
  emitted_at: string;
};

const HOMOLOGATION_MESSAGE = 'EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

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

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const asArray = (value: unknown) => Array.isArray(value) ? value : [];

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toOptionalText = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
};

const formatMoney = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));

const formatDateTime = (value: string | null | undefined, timezone: string) => {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
};

const paymentMethodLabel = (value: unknown) => {
  switch (value) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'Pix';
    case 'fiado':
      return 'Fiado';
    case 'cartao_debito':
      return 'Cartao de debito';
    case 'cartao_credito':
      return 'Cartao de credito';
    default:
      return typeof value === 'string' && value.trim() ? value : 'Nao informado';
  }
};

const fiscalStatusLabel = (value: string) => {
  switch (value) {
    case 'homologacao_emitida':
      return 'Homologacao emitida';
    case 'autorizada':
      return 'Autorizada';
    case 'erro':
      return 'Erro';
    case 'cancelada':
      return 'Cancelada';
    default:
      return 'Pendente';
  }
};

const getItems = (document: FiscalDocumentRow) => {
  const payload = asRecord(document.payload);
  return asArray(payload.items).map((item) => asRecord(item));
};

const getFiscalParts = (document: FiscalDocumentRow) => {
  const payload = asRecord(document.payload);
  const issuer = asRecord(payload.issuer);
  const customer = asRecord(payload.customer);
  const sale = asRecord(payload.sale);
  const items = getItems(document);

  return { payload, issuer, customer, sale, items };
};

const buildItemsRows = (items: Record<string, unknown>[]) => {
  if (items.length === 0) {
    return '<tr><td colspan="4" style="padding:10px 0;color:#5b6b83;">Sem itens para exibir.</td></tr>';
  }

  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;color:#14213d;">${escapeHtml(toOptionalText(item.productName) || 'Item')}</td>
      <td style="padding:8px 0;text-align:center;color:#42526a;">${escapeHtml(toNumber(item.quantity))}</td>
      <td style="padding:8px 0;text-align:right;color:#42526a;">${escapeHtml(formatMoney(item.unitPrice))}</td>
      <td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(formatMoney(item.total))}</td>
    </tr>
  `).join('');
};

const buildFiscalDocumentEmail = (document: FiscalDocumentRow, timezone: string) => {
  const { issuer, customer, sale, items } = getFiscalParts(document);
  const total = toNumber(sale.total);
  const tradeName = toOptionalText(issuer.tradeName) || toOptionalText(issuer.legalName) || 'MIAR AI/FOOD';
  const emittedAt = formatDateTime(document.emitted_at, timezone);
  const saleDate = formatDateTime(toOptionalText(sale.date), timezone);
  const statusLabel = fiscalStatusLabel(document.status);
  const paymentLabel = paymentMethodLabel(sale.paymentMethod);
  const itemsHtml = buildItemsRows(items);
  const isHomologation = document.environment !== 'producao';
  const fiscalMessage = document.homologation_message || (isHomologation ? HOMOLOGATION_MESSAGE : '');

  const html = renderHappyCashEmail({
    eyebrow: 'Nota fiscal',
    title: `NFC-e ${document.number}/${document.series}`,
    preview: `NFC-e ${document.number}/${document.series} no valor de ${formatMoney(total)}`,
    intro: `Segue a NFC-e emitida por ${tradeName}. O DANFE simplificado tambem esta anexado neste e-mail.`,
    metrics: [
      { label: 'Total', value: formatMoney(total), tone: 'success' },
      { label: 'Status', value: statusLabel, tone: document.status === 'erro' ? 'danger' : 'primary' },
      { label: 'Pagamento', value: paymentLabel },
    ],
    contentHtml: `
      ${fiscalMessage ? `
        <div style="margin-top:20px;border:1px dashed #1f5ca3;border-radius:14px;background:#f8fbff;padding:14px;">
          <p style="margin:0;color:#14213d;font-size:13px;line-height:20px;font-weight:800;text-align:center;">${escapeHtml(fiscalMessage)}</p>
        </div>
      ` : ''}

      <div style="margin-top:20px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Dados da NFC-e</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="padding:8px 0;color:#5b6b83;">Emitente</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(tradeName)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b83;">Emissao</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(emittedAt)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b83;">Venda</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(saleDate)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b83;">Ambiente</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(document.environment)}</td></tr>
            <tr><td style="padding:8px 0;color:#5b6b83;">Chave de acesso</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;word-break:break-all;">${escapeHtml(document.access_key)}</td></tr>
            ${document.protocol ? `<tr><td style="padding:8px 0;color:#5b6b83;">Protocolo</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#14213d;">${escapeHtml(document.protocol)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>

      <div style="margin-top:20px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Itens</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Item</th>
              <th align="center" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Qtd</th>
              <th align="right" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Unit.</th>
              <th align="right" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      ${(customer.name || customer.document) ? `
        <div style="margin-top:20px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
          <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Consumidor</h2>
          <p style="margin:0;color:#42526a;font-size:14px;line-height:22px;">
            ${escapeHtml(toOptionalText(customer.name) || 'Consumidor nao identificado')}
            ${customer.document ? `<br>CPF/CNPJ: ${escapeHtml(toOptionalText(customer.document))}` : ''}
          </p>
        </div>
      ` : ''}
    `,
    footerNote: 'Este e-mail foi enviado automaticamente pelo MIAR AI/FOOD.',
  });

  const text = [
    `NFC-e ${document.number}/${document.series}`,
    `Emitente: ${tradeName}`,
    `Status: ${statusLabel}`,
    `Ambiente: ${document.environment}`,
    `Emissao: ${emittedAt}`,
    `Venda: ${saleDate}`,
    `Total: ${formatMoney(total)}`,
    `Pagamento: ${paymentLabel}`,
    `Chave de acesso: ${document.access_key}`,
    document.protocol ? `Protocolo: ${document.protocol}` : '',
    fiscalMessage,
  ].filter(Boolean).join('\n');

  return { html, text };
};

const buildDanfeAttachmentHtml = (document: FiscalDocumentRow, timezone: string) => {
  const { issuer, customer, sale, items, payload } = getFiscalParts(document);
  const tradeName = toOptionalText(issuer.tradeName) || toOptionalText(issuer.legalName) || 'MIAR AI/FOOD';
  const addressParts = [
    issuer.addressStreet,
    issuer.addressNumber,
    issuer.addressComplement,
    issuer.addressDistrict,
    issuer.addressCity,
    issuer.state,
    issuer.addressZipCode,
  ].map(toOptionalText).filter(Boolean);
  const itemsHtml = buildItemsRows(items);
  const fiscalMessage = document.homologation_message || (document.environment !== 'producao' ? HOMOLOGATION_MESSAGE : '');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>DANFE NFC-e ${escapeHtml(document.number)}</title>
        <style>
          body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #f5f5f5; }
          .coupon { max-width: 360px; margin: 0 auto; background: #fff; border: 1px solid #d1d5db; padding: 18px; }
          .center { text-align: center; }
          .muted { color: #6b7280; font-size: 12px; }
          .strong { font-weight: 700; }
          .message { margin: 14px 0; padding: 10px; border: 1px dashed #111827; font-size: 12px; text-align: center; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { padding: 6px 0; border-bottom: 1px dashed #d1d5db; vertical-align: top; }
          .totals { margin-top: 12px; font-size: 13px; }
          .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
        </style>
      </head>
      <body>
        <main class="coupon">
          <div class="center">
            <div class="strong">${escapeHtml(tradeName)}</div>
            ${issuer.legalName ? `<div class="muted">${escapeHtml(toOptionalText(issuer.legalName))}</div>` : ''}
            ${issuer.cnpj ? `<div class="muted">CNPJ: ${escapeHtml(toOptionalText(issuer.cnpj))}</div>` : ''}
            ${issuer.stateRegistration ? `<div class="muted">IE: ${escapeHtml(toOptionalText(issuer.stateRegistration))}</div>` : ''}
            ${addressParts.length > 0 ? `<div class="muted">${escapeHtml(addressParts.join(' - '))}</div>` : ''}
          </div>

          ${fiscalMessage ? `<div class="message">${escapeHtml(fiscalMessage)}</div>` : ''}

          <div class="center">
            <div class="strong">DANFE NFC-e Simplificado</div>
            <div class="muted">Ambiente: ${escapeHtml(document.environment)}</div>
            <div class="muted">Numero: ${escapeHtml(document.number)} | Serie: ${escapeHtml(document.series)}</div>
            <div class="muted">Emissao: ${escapeHtml(formatDateTime(document.emitted_at, timezone))}</div>
            ${sale.operationNature ? `<div class="muted">Natureza: ${escapeHtml(toOptionalText(sale.operationNature))}</div>` : ''}
          </div>

          <div style="margin-top:12px;">
            <table>
              <thead><tr><th align="left">Item</th><th align="center">Qtd</th><th align="right">Unit.</th><th align="right">Total</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>

          <div class="totals">
            <div><span>Desconto</span><span>${escapeHtml(formatMoney(sale.discount))}</span></div>
            <div><span>Total</span><span class="strong">${escapeHtml(formatMoney(sale.total))}</span></div>
            <div><span>Pagamento</span><span>${escapeHtml(paymentMethodLabel(sale.paymentMethod))}</span></div>
            ${toNumber(sale.cashReceived) > 0 ? `<div><span>Valor recebido</span><span>${escapeHtml(formatMoney(sale.cashReceived))}</span></div>` : ''}
            ${toNumber(sale.changeAmount) > 0 ? `<div><span>Troco</span><span>${escapeHtml(formatMoney(sale.changeAmount))}</span></div>` : ''}
          </div>

          ${(customer.name || customer.document) ? `
            <div class="muted" style="margin-top:12px;">
              Consumidor: ${escapeHtml(toOptionalText(customer.name) || 'Nao identificado')}
              ${customer.document ? `<br>CPF/CNPJ: ${escapeHtml(toOptionalText(customer.document))}` : ''}
            </div>
          ` : ''}
          ${sale.sellerName ? `<div class="muted">Operador: ${escapeHtml(toOptionalText(sale.sellerName))}</div>` : ''}
          ${payload.danfeMessage ? `<div class="center muted" style="margin-top:12px;">${escapeHtml(toOptionalText(payload.danfeMessage))}</div>` : ''}
          <div class="center muted" style="margin-top:14px;">Chave de acesso</div>
          <div class="center strong" style="font-size:13px;word-break:break-all;">${escapeHtml(document.access_key)}</div>
        </main>
      </body>
    </html>
  `;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo nao permitido.' }, 405);
  }

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: 'send-fiscal-document-email',
    limit: readRateLimitEnv('SEND_FISCAL_DOCUMENT_EMAIL_RATE_LIMIT_PER_MINUTE', 20),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: 'Muitas tentativas de envio de nota fiscal em pouco tempo. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  if (!Deno.env.get('RESEND_API_KEY')?.trim()) {
    return jsonResponse(request, { error: 'Configure o secret RESEND_API_KEY para enviar e-mails pelo Resend.' }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuracao do Supabase indisponivel na funcao.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: 'Sessao nao encontrada para enviar a nota fiscal.' }, 401);
  }

  try {
    const body = await request.json().catch(() => null) as FiscalDocumentEmailRequest | null;
    const documentId = body?.documentId?.trim();

    if (!documentId) {
      return jsonResponse(request, { error: 'Informe a nota fiscal que sera enviada.' }, 400);
    }

    const recipients = normalizeEmailRecipients(body?.recipients);
    const invalidRecipients = recipients.filter((recipient) => !isValidEmailRecipient(recipient));

    if (invalidRecipients.length > 0) {
      return jsonResponse(request, { error: `Destinatario invalido: ${invalidRecipients.join(', ')}` }, 400);
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
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse(request, { error: 'Nao foi possivel validar o usuario autenticado.' }, 401);
    }

    const { data: callerProfile, error: callerProfileError } = await serviceClient
      .from('profiles')
      .select('role, owner_user_id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile) {
      return jsonResponse(request, { error: 'Perfil do usuario nao encontrado.' }, 403);
    }

    const typedCallerProfile = callerProfile as CallerProfileRow;
    const ownerUserId = typedCallerProfile.owner_user_id ?? user.id;

    const { data: hasNotesAccess, error: notesAccessError } = await authClient.rpc('current_store_has_feature', {
      target_feature: 'notes.manage',
    });

    if (notesAccessError || !hasNotesAccess) {
      return jsonResponse(request, { error: 'Seu plano atual nao libera o envio de notas fiscais.' }, 403);
    }

    const { data: documentData, error: documentError } = await serviceClient
      .from('fiscal_documents')
      .select('id, sale_id, document_model, environment, status, series, number, access_key, protocol, homologation_message, error_message, provider, external_id, external_status, payload, emitted_at')
      .eq('id', documentId)
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    if (documentError) {
      return jsonResponse(request, { error: 'Nao foi possivel carregar a nota fiscal.' }, 500);
    }

    if (!documentData) {
      return jsonResponse(request, { error: 'Nota fiscal nao encontrada para esta loja.' }, 404);
    }

    const document = documentData as FiscalDocumentRow;

    const { data: storeAccountData } = await serviceClient
      .from('store_accounts')
      .select('email, nome_estabelecimento')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    const storeAccount = (storeAccountData ?? null) as StoreAccountRow | null;
    const fallbackRecipient = storeAccount?.email?.trim() || typedCallerProfile.email?.trim() || user.email?.trim() || '';
    const resolvedRecipients = recipients.length > 0 ? recipients : normalizeEmailRecipients(fallbackRecipient);

    if (resolvedRecipients.length === 0) {
      return jsonResponse(request, { error: 'Informe ao menos um e-mail para receber a nota fiscal.' }, 400);
    }

    const timezone = body?.timezone?.trim() || 'America/Sao_Paulo';
    const { html, text } = buildFiscalDocumentEmail(document, timezone);
    const danfeHtml = buildDanfeAttachmentHtml(document, timezone);
    const subject = `NFC-e MIAR AI/FOOD ${document.number}/${document.series}`;
    const fromEmail = getHappyCashFromEmail('FISCAL_DOCUMENT_FROM_EMAIL');

    await sendHappyCashEmail({
      from: fromEmail,
      to: resolvedRecipients,
      subject,
      html,
      text,
      attachments: [
        {
          filename: `danfe-nfce-${document.series}-${document.number}.html`,
          content: encodeTextAttachment(danfeHtml),
        },
      ],
    });

    return jsonResponse(request, {
      message: 'Nota fiscal enviada por e-mail com sucesso.',
      recipients: resolvedRecipients,
    });
  } catch (error) {
    console.error('Erro inesperado ao enviar nota fiscal por e-mail:', error);
    const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar a nota fiscal.';
    return jsonResponse(request, { error: message }, 500);
  }
});
