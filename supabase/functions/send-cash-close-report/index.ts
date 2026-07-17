import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import {
  escapeHtml,
  getHappyCashFromEmail,
  isValidEmailRecipient,
  normalizeEmailRecipients,
  renderHappyCashEmail,
  sendHappyCashEmail,
} from '../_shared/happycashEmail.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';

interface CashSale {
  date: string;
  payment_method: string;
  total: number;
}

interface CashOut {
  id?: string;
  date: string;
  description: string;
  amount: number;
}

interface CashCloseReceipt {
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  salesTotal: number;
  cashOutTotal: number;
  finalBalance: number;
  saleCount: number;
  cashOuts: CashOut[];
  sales: CashSale[];
}

interface CashCloseEmailRequest {
  receipt?: CashCloseReceipt;
  recipients?: string[];
  timezone?: string;
}

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  fiado: 'Fiado',
  cartao_debito: 'Cartao de debito',
  cartao_credito: 'Cartao de credito',
};

const parseRecipients = (rawValue: string | undefined) =>
  (rawValue ?? '')
    .split(/[,\n;]/)
    .map((value) => value.trim())
    .filter(Boolean);

interface CallerProfile {
  owner_user_id: string | null;
  email: string | null;
}

interface StoreAccount {
  email: string | null;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value ?? 0);

const formatDateTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));

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

const buildPaymentBreakdown = (sales: CashSale[]) => {
  const totals = new Map<string, number>();

  for (const sale of sales) {
    const label = paymentLabels[sale.payment_method] ?? sale.payment_method;
    totals.set(label, (totals.get(label) ?? 0) + (sale.total ?? 0));
  }

  return Array.from(totals.entries());
};

const buildEmailContent = (receipt: CashCloseReceipt, timezone: string) => {
  const paymentBreakdown = buildPaymentBreakdown(receipt.sales);
  const summaryRows = [
    ['Abertura', formatMoney(receipt.openingAmount)],
    ['Vendas', formatMoney(receipt.salesTotal)],
    ['Saidas', formatMoney(receipt.cashOutTotal)],
    ['Saldo final', formatMoney(receipt.finalBalance)],
    ['Quantidade de vendas', String(receipt.saleCount)],
  ];

  const summaryHtml = summaryRows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#6b7280;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:#111827;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join('');

  const paymentHtml = paymentBreakdown.length > 0
    ? paymentBreakdown
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:8px 0;color:#6b7280;">${escapeHtml(label)}</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;">${escapeHtml(formatMoney(value))}</td>
            </tr>
          `,
        )
        .join('')
    : `
      <tr>
        <td colspan="2" style="padding:8px 0;color:#6b7280;">Sem vendas nesta abertura.</td>
      </tr>
    `;

  const salesHtml = receipt.sales.length > 0
    ? receipt.sales
        .map(
          (sale) => `
            <tr>
              <td style="padding:8px 0;color:#111827;">${escapeHtml(formatDateTime(sale.date, timezone))}</td>
              <td style="padding:8px 0;color:#6b7280;">${escapeHtml(paymentLabels[sale.payment_method] ?? sale.payment_method)}</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;">${escapeHtml(formatMoney(sale.total))}</td>
            </tr>
          `,
        )
        .join('')
    : `
      <tr>
        <td colspan="3" style="padding:8px 0;color:#6b7280;">Sem vendas nesta abertura.</td>
      </tr>
    `;

  const cashOutHtml = receipt.cashOuts.length > 0
    ? receipt.cashOuts
        .map(
          (cashOut) => `
            <tr>
              <td style="padding:8px 0;color:#111827;">${escapeHtml(formatDateTime(cashOut.date, timezone))}</td>
              <td style="padding:8px 0;color:#6b7280;">${escapeHtml(cashOut.description)}</td>
              <td style="padding:8px 0;text-align:right;font-weight:600;color:#b91c1c;">${escapeHtml(formatMoney(cashOut.amount))}</td>
            </tr>
          `,
        )
        .join('')
    : `
      <tr>
        <td colspan="3" style="padding:8px 0;color:#6b7280;">Sem saidas de caixa nesta abertura.</td>
      </tr>
    `;

  const html = renderHappyCashEmail({
    eyebrow: 'Fechamento de caixa',
    title: 'Relatorio de fechamento do caixa',
    preview: `Saldo final ${formatMoney(receipt.finalBalance)} em ${formatDateTime(receipt.closedAt, timezone)}`,
    intro:
      `Caixa aberto por ${receipt.openedBy} em ${formatDateTime(receipt.openedAt, timezone)}. ` +
      `Fechado por ${receipt.closedBy} em ${formatDateTime(receipt.closedAt, timezone)}.`,
    metrics: [
      { label: 'Saldo final', value: formatMoney(receipt.finalBalance), tone: 'success' },
      { label: 'Vendas', value: formatMoney(receipt.salesTotal), tone: 'primary' },
      { label: 'Saidas', value: formatMoney(receipt.cashOutTotal), tone: receipt.cashOutTotal > 0 ? 'danger' : 'default' },
      { label: 'Qtd. vendas', value: String(receipt.saleCount) },
    ],
    contentHtml: `
      <div style="margin-top:24px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Resumo financeiro</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${summaryHtml}</tbody>
        </table>
      </div>

      <div style="margin-top:18px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Total por forma de pagamento</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${paymentHtml}</tbody>
        </table>
      </div>

      <div style="margin-top:18px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Entradas por venda</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Horario</th>
              <th align="left" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Pagamento</th>
              <th align="right" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Valor</th>
            </tr>
          </thead>
          <tbody>${salesHtml}</tbody>
        </table>
      </div>

      <div style="margin-top:18px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Saidas de caixa</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Horario</th>
              <th align="left" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Descricao</th>
              <th align="right" style="padding-bottom:8px;font-size:12px;color:#5b6b83;">Valor</th>
            </tr>
          </thead>
          <tbody>${cashOutHtml}</tbody>
        </table>
      </div>
    `,
    footerNote: 'Este fechamento foi enviado automaticamente pelo HappyCash.',
  });

  const paymentText = paymentBreakdown.length > 0
    ? paymentBreakdown
        .map(([label, value]) => `- ${label}: ${formatMoney(value)}`)
        .join('\n')
    : 'Sem vendas nesta abertura.';

  const salesText = receipt.sales.length > 0
    ? receipt.sales
        .map(
          (sale) =>
            `- ${formatDateTime(sale.date, timezone)} | ${paymentLabels[sale.payment_method] ?? sale.payment_method} | ${formatMoney(sale.total)}`,
        )
        .join('\n')
    : 'Sem vendas nesta abertura.';

  const cashOutText = receipt.cashOuts.length > 0
    ? receipt.cashOuts
        .map(
          (cashOut) =>
            `- ${formatDateTime(cashOut.date, timezone)} | ${cashOut.description} | ${formatMoney(cashOut.amount)}`,
        )
        .join('\n')
    : 'Sem saidas de caixa nesta abertura.';

  const text = [
    'Relatorio de fechamento do caixa',
    '',
    `Aberto por: ${receipt.openedBy} em ${formatDateTime(receipt.openedAt, timezone)}`,
    `Fechado por: ${receipt.closedBy} em ${formatDateTime(receipt.closedAt, timezone)}`,
    '',
    `Abertura: ${formatMoney(receipt.openingAmount)}`,
    `Vendas: ${formatMoney(receipt.salesTotal)}`,
    `Saidas: ${formatMoney(receipt.cashOutTotal)}`,
    `Saldo final: ${formatMoney(receipt.finalBalance)}`,
    `Quantidade de vendas: ${receipt.saleCount}`,
    '',
    'Total por forma de pagamento',
    paymentText,
    '',
    'Entradas por venda',
    salesText,
    '',
    'Saidas de caixa',
    cashOutText,
  ].join('\n');

  return { html, text };
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
    namespace: 'send-cash-close-report',
    limit: readRateLimitEnv('SEND_CASH_CLOSE_REPORT_RATE_LIMIT_PER_MINUTE', 8),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: 'Muitas tentativas de envio de relatorio em pouco tempo. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
  }

  const fromEmail = getHappyCashFromEmail('CASH_CLOSE_REPORT_FROM_EMAIL');

  if (!Deno.env.get('RESEND_API_KEY')?.trim()) {
    return jsonResponse(
      request,
      {
        error:
          'Configure o secret RESEND_API_KEY para enviar o relatorio por e-mail.',
      },
      500,
    );
  }

  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return jsonResponse(request, { error: 'Sessao nao encontrada para enviar o relatorio.' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse(request, { error: 'Configuracao do Supabase indisponivel na funcao.' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(request, { error: 'Nao foi possivel validar o usuario autenticado.' }, 401);
    }

    const { data: callerProfile } = await serviceClient
      .from('profiles')
      .select('owner_user_id, email')
      .eq('user_id', user.id)
      .maybeSingle();

    const typedCallerProfile = (callerProfile ?? null) as CallerProfile | null;
    const ownerUserId = typedCallerProfile?.owner_user_id ?? user.id;

    const { data: storeAccount } = await serviceClient
      .from('store_accounts')
      .select('email')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    const typedStoreAccount = (storeAccount ?? null) as StoreAccount | null;
    const registeredStoreEmail = typedStoreAccount?.email?.trim() || typedCallerProfile?.email?.trim() || user.email?.trim() || '';

    const { data: hasCashAccess, error: cashAccessError } = await supabase.rpc('current_store_has_feature', {
      target_feature: 'cash.manage',
    });

    if (cashAccessError || !hasCashAccess) {
      return jsonResponse(request, { error: 'Seu plano atual nao libera o fechamento de caixa.' }, 403);
    }

    const { receipt, recipients: requestedRecipients, timezone }: CashCloseEmailRequest = await request.json();

    if (!receipt) {
      return jsonResponse(request, { error: 'Dados do fechamento nao informados.' }, 400);
    }

    const customRecipients = normalizeEmailRecipients(requestedRecipients);
    const invalidRecipients = customRecipients.filter((recipient) => !isValidEmailRecipient(recipient));

    if (invalidRecipients.length > 0) {
      return jsonResponse(request, { error: `Destinatario invalido: ${invalidRecipients.join(', ')}` }, 400);
    }

    const fallbackRecipients = parseRecipients(Deno.env.get('CASH_CLOSE_REPORT_RECIPIENTS'));
    const recipients = customRecipients.length > 0
      ? customRecipients
      : registeredStoreEmail
      ? [registeredStoreEmail]
      : fallbackRecipients;

    if (recipients.length === 0) {
      return jsonResponse(request, { error: 'Nenhum destinatario configurado para receber o relatorio.' }, 400);
    }

    const reportTimezone = timezone?.trim() || Deno.env.get('CASH_CLOSE_REPORT_TIMEZONE') || 'America/Sao_Paulo';
    const closedAt = formatDateTime(receipt.closedAt, reportTimezone);
    const subjectPrefix = Deno.env.get('CASH_CLOSE_REPORT_SUBJECT_PREFIX')?.trim();
    const subjectBase = `Fechamento de caixa - ${closedAt}`;
    const subject = subjectPrefix ? `${subjectPrefix} ${subjectBase}` : subjectBase;
    const { html, text } = buildEmailContent(receipt, reportTimezone);

    await sendHappyCashEmail({ from: fromEmail, to: recipients, subject, html, text });

    return jsonResponse(request, {
      message: 'Relatorio enviado por e-mail com sucesso.',
      recipients,
    });
  } catch (error) {
    console.error('Erro inesperado ao enviar relatorio de fechamento:', error);
    const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar o relatorio.';
    return jsonResponse(request, { error: message }, 500);
  }
});
