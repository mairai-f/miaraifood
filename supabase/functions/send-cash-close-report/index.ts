import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';

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

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

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

  const html = `
    <div style="background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;color:#111827;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">HappyCash</p>
        <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2;">Relatorio de fechamento do caixa</h1>
        <p style="margin:0 0 24px;color:#6b7280;">
          Caixa aberto por <strong>${escapeHtml(receipt.openedBy)}</strong> em ${escapeHtml(formatDateTime(receipt.openedAt, timezone))}
          <br />
          Caixa fechado por <strong>${escapeHtml(receipt.closedBy)}</strong> em ${escapeHtml(formatDateTime(receipt.closedAt, timezone))}
        </p>

        <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:14px;padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;">Resumo</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${summaryHtml}</tbody>
          </table>
        </div>

        <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:14px;padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;">Total por forma de pagamento</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${paymentHtml}</tbody>
          </table>
        </div>

        <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:14px;padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;">Entradas por venda</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th align="left" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Horario</th>
                <th align="left" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Pagamento</th>
                <th align="right" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Valor</th>
              </tr>
            </thead>
            <tbody>${salesHtml}</tbody>
          </table>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;">Saidas de caixa</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th align="left" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Horario</th>
                <th align="left" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Descricao</th>
                <th align="right" style="padding-bottom:8px;font-size:12px;color:#9ca3af;">Valor</th>
              </tr>
            </thead>
            <tbody>${cashOutHtml}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

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

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('CASH_CLOSE_REPORT_FROM_EMAIL');

  if (!resendApiKey || !fromEmail) {
    return jsonResponse(
      request,
      {
        error:
          'Configure os secrets RESEND_API_KEY e CASH_CLOSE_REPORT_FROM_EMAIL para enviar o relatorio por e-mail.',
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

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(request, { error: 'Configuracao do Supabase indisponivel na funcao.' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(request, { error: 'Nao foi possivel validar o usuario autenticado.' }, 401);
    }

    const { data: hasCashAccess, error: cashAccessError } = await supabase.rpc('current_store_has_feature', {
      target_feature: 'cash.manage',
    });

    if (cashAccessError || !hasCashAccess) {
      return jsonResponse(request, { error: 'Seu plano atual nao libera o fechamento de caixa.' }, 403);
    }

    const { receipt, timezone }: CashCloseEmailRequest = await request.json();

    if (!receipt) {
      return jsonResponse(request, { error: 'Dados do fechamento nao informados.' }, 400);
    }

    const fallbackRecipients = parseRecipients(Deno.env.get('CASH_CLOSE_REPORT_RECIPIENTS'));
    const recipients = user.email
      ? [user.email]
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

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Erro ao enviar e-mail pelo Resend:', resendError);
      return jsonResponse(request, { error: 'O provedor de e-mail recusou o envio do relatorio.' }, 502);
    }

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
