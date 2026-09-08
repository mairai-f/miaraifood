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
  sessionId?: string | null;
  closeNumber?: string | number | null;
  openedAt: string;
  closedAt: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  salesTotal: number;
  cashOutTotal: number;
  finalBalance: number;
  expectedBalance?: number;
  countedBalance?: number;
  difference?: number;
  differenceReason?: string;
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
  cartao_debito: 'Debito',
  cartao_credito: 'Credito',
};

const paymentPrintOrder = ['dinheiro', 'cartao_credito', 'cartao_debito', 'pix'] as const;
const receiptLineWidth = 42;

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
  nome_cliente: string | null;
  nome_estabelecimento: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  nome_rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

interface StoreFiscalSettings {
  issuer_trade_name: string | null;
  issuer_legal_name: string | null;
  issuer_cnpj: string | null;
  issuer_state_registration: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_zip_code: string | null;
  issuer_state: string | null;
}

interface StoreIdentity {
  tradeName: string;
  legalName: string;
  taxId: string;
  stateRegistration: string;
  addressLine: string;
  cityLine: string;
  phone: string;
  email: string;
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

const digitsOnly = (value: string | null | undefined) => String(value ?? '').replace(/\D/g, '');
const trimToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const displayOrMissing = (value: string | null | undefined) => trimToNull(value) ?? 'Nao informado';

const formatTaxId = (value: string | null | undefined) => {
  const digits = digitsOnly(value);

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return displayOrMissing(value);
};

const formatCep = (value: string | null | undefined) => {
  const digits = digitsOnly(value);
  return digits.length === 8 ? digits.replace(/(\d{5})(\d{3})/, '$1-$2') : displayOrMissing(value);
};

const formatPhone = (value: string | null | undefined) => {
  const digits = digitsOnly(value);

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  return displayOrMissing(value);
};

const joinNonEmpty = (values: Array<string | null | undefined>, separator = ', ') =>
  values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);

const resolveStoreIdentity = (
  storeAccount: StoreAccount | null,
  fiscalSettings: StoreFiscalSettings | null,
  fallbackEmail: string,
): StoreIdentity => {
  const fiscalAddressLine = joinNonEmpty([
    fiscalSettings?.address_street,
    fiscalSettings?.address_number,
    fiscalSettings?.address_complement,
    fiscalSettings?.address_district,
  ]);
  const fiscalCityLine = joinNonEmpty([
    fiscalSettings?.address_city,
    fiscalSettings?.issuer_state,
    fiscalSettings?.address_zip_code ? `CEP ${formatCep(fiscalSettings.address_zip_code)}` : null,
  ], ' - ');
  const accountAddressLine = joinNonEmpty([
    storeAccount?.nome_rua ?? storeAccount?.endereco,
    storeAccount?.numero,
    storeAccount?.complemento,
    storeAccount?.bairro,
  ]);
  const accountCityLine = joinNonEmpty([
    storeAccount?.cidade,
    storeAccount?.estado,
    storeAccount?.cep ? `CEP ${formatCep(storeAccount.cep)}` : null,
  ], ' - ');

  return {
    tradeName: displayOrMissing(fiscalSettings?.issuer_trade_name ?? storeAccount?.nome_estabelecimento),
    legalName: displayOrMissing(fiscalSettings?.issuer_legal_name ?? storeAccount?.nome_cliente),
    taxId: formatTaxId(fiscalSettings?.issuer_cnpj ?? storeAccount?.cnpj),
    stateRegistration: displayOrMissing(fiscalSettings?.issuer_state_registration),
    addressLine: displayOrMissing(fiscalAddressLine || accountAddressLine || storeAccount?.endereco),
    cityLine: displayOrMissing(fiscalCityLine || accountCityLine),
    phone: formatPhone(storeAccount?.telefone),
    email: displayOrMissing(storeAccount?.email ?? fallbackEmail),
  };
};

const getExpectedBalance = (receipt: CashCloseReceipt) =>
  Number.isFinite(receipt.expectedBalance)
    ? Number(receipt.expectedBalance)
    : (receipt.openingAmount ?? 0) + (receipt.salesTotal ?? 0) - (receipt.cashOutTotal ?? 0);

const getCountedBalance = (receipt: CashCloseReceipt) =>
  Number.isFinite(receipt.countedBalance) ? Number(receipt.countedBalance) : (receipt.finalBalance ?? 0);

const getDifference = (receipt: CashCloseReceipt) =>
  Number.isFinite(receipt.difference)
    ? Number(receipt.difference)
    : getCountedBalance(receipt) - getExpectedBalance(receipt);

const getCashCloseNumber = (receipt: CashCloseReceipt) => {
  const value = receipt.closeNumber ?? receipt.sessionId;
  if (!value) return 'sem numero';
  const normalized = String(value);
  return normalized.length > 12 ? normalized.slice(-8).toUpperCase() : normalized;
};

const makeEmailRows = (rows: Array<[string, string, string?]>) =>
  rows
    .map(
      ([label, value, color]) => `
        <tr>
          <td style="padding:8px 0;color:#6b7280;">${escapeHtml(label)}</td>
          <td style="padding:8px 0;text-align:right;font-weight:700;color:${color ?? '#111827'};">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join('');

const normalizeReceiptText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[^\x20-\x7E]/g, '');

const receiptSeparator = () => '-'.repeat(receiptLineWidth);

const centerReceiptLine = (value: string) => {
  const normalized = normalizeReceiptText(value).slice(0, receiptLineWidth);
  const left = Math.max(0, Math.floor((receiptLineWidth - normalized.length) / 2));
  return `${' '.repeat(left)}${normalized}`;
};

const amountLine = (label: string, value: number) => {
  const left = normalizeReceiptText(label.toUpperCase()).replace(/\s+$/g, '');
  const right = normalizeReceiptText(formatMoney(value));
  const room = receiptLineWidth - left.length - right.length;

  if (room < 1) return [`${left}:`, right];
  return [`${left}:${' '.repeat(room)}${right}`];
};

const textLine = (label: string, value: string) => {
  const left = normalizeReceiptText(label.toUpperCase()).replace(/\s+$/g, '');
  const right = normalizeReceiptText(value);
  const room = receiptLineWidth - left.length - right.length;

  if (room < 1) return [`${left}:`, ...wrapReceiptText(right)];
  return [`${left}:${' '.repeat(room)}${right}`];
};

const wrapReceiptText = (value: string, width = receiptLineWidth) => {
  const words = normalizeReceiptText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word.slice(0, width);
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

const escapePdfText = (value: string) =>
  normalizeReceiptText(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

const buildPdfBase64 = (lines: string[]) => {
  const pageWidth = 226;
  const pageHeight = 842;
  const marginX = 10;
  const startY = 820;
  const lineHeight = 10;
  const fontSize = 8;
  const linesPerPage = 78;
  const chunks: string[][] = [];

  for (let index = 0; index < lines.length; index += linesPerPage) {
    chunks.push(lines.slice(index, index + linesPerPage));
  }

  if (chunks.length === 0) chunks.push(['']);

  const objects: string[] = [];
  objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  objects[3] = '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n';

  const pageObjectIds: number[] = [];

  chunks.forEach((chunk, pageIndex) => {
    const pageObjectId = 4 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const contentLines = [
      'BT',
      `/F1 ${fontSize} Tf`,
      `${marginX} ${startY} Td`,
      ...chunk.flatMap((line, lineIndex) => [
        lineIndex === 0 ? '' : `0 -${lineHeight} Td`,
        `(${escapePdfText(line)}) Tj`,
      ]).filter(Boolean),
      'ET',
    ];
    const stream = `${contentLines.join('\n')}\n`;

    objects[pageObjectId] = `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`;
    objects[contentObjectId] = `${contentObjectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`;
  });

  objects[2] = `2 0 obj\n<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] >>\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    if (!objects[objectId]) continue;
    offsets[objectId] = pdf.length;
    pdf += objects[objectId];
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += '0000000000 65535 f \n';

  for (let objectId = 1; objectId < objects.length; objectId += 1) {
    pdf += `${String(offsets[objectId] ?? 0).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return encodeTextAttachment(pdf);
};

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

  const orderedKeys = paymentPrintOrder.map((key) => paymentLabels[key]);
  return Array.from(totals.entries()).sort(([labelA], [labelB]) => {
    const indexA = orderedKeys.indexOf(labelA);
    const indexB = orderedKeys.indexOf(labelB);

    if (indexA >= 0 && indexB >= 0) return indexA - indexB;
    if (indexA >= 0) return -1;
    if (indexB >= 0) return 1;
    return labelA.localeCompare(labelB, 'pt-BR');
  });
};

const getPaymentTotalByKey = (receipt: CashCloseReceipt, key: string) =>
  receipt.sales
    .filter((sale) => sale.payment_method === key)
    .reduce((sum, sale) => sum + (sale.total ?? 0), 0);

const buildPrintableReceiptLines = (
  receipt: CashCloseReceipt,
  timezone: string,
  storeIdentity: StoreIdentity,
) => {
  const expectedBalance = getExpectedBalance(receipt);
  const countedBalance = getCountedBalance(receipt);
  const difference = getDifference(receipt);
  const averageTicket = receipt.saleCount > 0 ? receipt.salesTotal / receipt.saleCount : 0;
  const cashCloseNumber = getCashCloseNumber(receipt);
  const cashOutLines = receipt.cashOuts.length > 0
    ? receipt.cashOuts.flatMap((cashOut) => textLine(cashOut.description || 'Saida', formatMoney(cashOut.amount)))
    : ['SEM SAIDAS REGISTRADAS'];

  return [
    centerReceiptLine('HappyCash ERP'),
    centerReceiptLine(storeIdentity.tradeName),
    ...wrapReceiptText(storeIdentity.legalName),
    ...wrapReceiptText(`CPF/CNPJ: ${storeIdentity.taxId}`),
    ...wrapReceiptText(storeIdentity.addressLine),
    ...wrapReceiptText(storeIdentity.cityLine),
    ...wrapReceiptText(`Telefone: ${storeIdentity.phone}`),
    ...wrapReceiptText(`Email: ${storeIdentity.email}`),
    receiptSeparator(),
    centerReceiptLine(`FECHAMENTO DO CAIXA ${cashCloseNumber}`),
    receiptSeparator(),
    centerReceiptLine('VALORES SISTEMICOS'),
    receiptSeparator(),
    ...amountLine('Abertura', receipt.openingAmount),
    ...amountLine('Entradas', 0),
    ...amountLine('Saidas', receipt.cashOutTotal),
    ...amountLine('Dinheiro', getPaymentTotalByKey(receipt, 'dinheiro')),
    ...amountLine('Credito', getPaymentTotalByKey(receipt, 'cartao_credito')),
    ...amountLine('Debito', getPaymentTotalByKey(receipt, 'cartao_debito')),
    ...amountLine('Pix', getPaymentTotalByKey(receipt, 'pix')),
    ...amountLine('Total', expectedBalance),
    receiptSeparator(),
    centerReceiptLine('VALORES INFORMADOS'),
    receiptSeparator(),
    ...amountLine('Valor contado', countedBalance),
    ...amountLine('Total', countedBalance),
    receiptSeparator(),
    centerReceiptLine('DIFERENCA DE VALORES'),
    receiptSeparator(),
    ...amountLine('Total', difference),
    ...(receipt.differenceReason?.trim()
      ? ['JUSTIFICATIVA:', ...wrapReceiptText(receipt.differenceReason)]
      : []),
    receiptSeparator(),
    centerReceiptLine('DETALHAMENTO SAIDAS'),
    receiptSeparator(),
    ...cashOutLines,
    receiptSeparator(),
    ...textLine('Numero de vendas', String(receipt.saleCount)),
    ...amountLine('Valor total em venda', receipt.salesTotal),
    ...amountLine('Ticket medio em vendas', averageTicket),
    ...amountLine('Valor total das taxas', 0),
    ...textLine('Responsavel', receipt.closedBy),
    ...textLine('Abertura', formatDateTime(receipt.openedAt, timezone)),
    ...textLine('Fechamento', formatDateTime(receipt.closedAt, timezone)),
    receiptSeparator(),
    'RECONHECO QUE OS VALORES ACIMA',
    'FORAM CONFERIDOS NO FECHAMENTO',
    '',
    '________________________________________',
    centerReceiptLine('ASSINATURA DO RESPONSAVEL'),
  ];
};

const buildEmailContent = (
  receipt: CashCloseReceipt,
  timezone: string,
  storeIdentity: StoreIdentity,
) => {
  const paymentBreakdown = buildPaymentBreakdown(receipt.sales);
  const expectedBalance = getExpectedBalance(receipt);
  const countedBalance = getCountedBalance(receipt);
  const difference = getDifference(receipt);
  const averageTicket = receipt.saleCount > 0 ? receipt.salesTotal / receipt.saleCount : 0;
  const cashCloseNumber = getCashCloseNumber(receipt);
  const summaryRows = [
    ['Abertura', formatMoney(receipt.openingAmount)],
    ['Entradas', formatMoney(0)],
    ['Vendas', formatMoney(receipt.salesTotal)],
    ['Saidas', formatMoney(receipt.cashOutTotal)],
    ['Total sistemico', formatMoney(expectedBalance)],
    ['Valor contado', formatMoney(countedBalance)],
    ['Diferenca', formatMoney(difference), Math.abs(difference) >= 0.01 ? '#b91c1c' : '#159947'],
    ['Quantidade de vendas', String(receipt.saleCount)],
    ['Ticket medio', formatMoney(averageTicket)],
  ] satisfies Array<[string, string, string?]>;
  const storeRows = [
    ['Nome fantasia', storeIdentity.tradeName],
    ['Razao/Nome', storeIdentity.legalName],
    ['CPF/CNPJ', storeIdentity.taxId],
    ['Inscricao estadual', storeIdentity.stateRegistration],
    ['Endereco', storeIdentity.addressLine],
    ['Cidade/CEP', storeIdentity.cityLine],
    ['Telefone', storeIdentity.phone],
    ['E-mail', storeIdentity.email],
  ] satisfies Array<[string, string]>;

  const summaryHtml = makeEmailRows(summaryRows);
  const storeHtml = makeEmailRows(storeRows);

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
    title: `Fechamento do caixa ${cashCloseNumber}`,
    preview: `Total contado ${formatMoney(countedBalance)} em ${formatDateTime(receipt.closedAt, timezone)}`,
    intro:
      `Caixa aberto por ${receipt.openedBy} em ${formatDateTime(receipt.openedAt, timezone)}. ` +
      `Fechado por ${receipt.closedBy} em ${formatDateTime(receipt.closedAt, timezone)}.`,
    metrics: [
      { label: 'Valor contado', value: formatMoney(countedBalance), tone: 'success' },
      { label: 'Total sistemico', value: formatMoney(expectedBalance), tone: 'primary' },
      { label: 'Saidas', value: formatMoney(receipt.cashOutTotal), tone: receipt.cashOutTotal > 0 ? 'danger' : 'default' },
      { label: 'Diferenca', value: formatMoney(difference), tone: Math.abs(difference) >= 0.01 ? 'danger' : 'success' },
    ],
    contentHtml: `
      <div style="margin-top:24px;border:1px solid #d8e2ef;border-radius:14px;padding:20px;background:#f8fbff;">
        <h2 style="margin:0 0 12px;color:#14213d;font-size:18px;line-height:24px;">Dados do estabelecimento</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>${storeHtml}</tbody>
        </table>
      </div>

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

      <div style="margin-top:18px;border:1px dashed #9fb1c8;border-radius:14px;padding:16px;background:#f8fbff;">
        <p style="margin:0;color:#42526a;font-size:13px;line-height:21px;">
          O recibo de fechamento em PDF esta anexado a este e-mail para impressao e arquivamento.
        </p>
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

  const printableLines = buildPrintableReceiptLines(receipt, timezone, storeIdentity);
  const pdfBase64 = buildPdfBase64(printableLines);
  const pdfFilename = `fechamento-caixa-${new Date(receipt.closedAt).toISOString().slice(0, 10)}-${cashCloseNumber}.pdf`
    .replace(/[^a-zA-Z0-9._-]/g, '-');

  const text = [
    `Fechamento do caixa ${cashCloseNumber}`,
    '',
    'Dados do estabelecimento',
    `Nome fantasia: ${storeIdentity.tradeName}`,
    `Razao/Nome: ${storeIdentity.legalName}`,
    `CPF/CNPJ: ${storeIdentity.taxId}`,
    `Inscricao estadual: ${storeIdentity.stateRegistration}`,
    `Endereco: ${storeIdentity.addressLine}`,
    `Cidade/CEP: ${storeIdentity.cityLine}`,
    `Telefone: ${storeIdentity.phone}`,
    `E-mail: ${storeIdentity.email}`,
    '',
    `Aberto por: ${receipt.openedBy} em ${formatDateTime(receipt.openedAt, timezone)}`,
    `Fechado por: ${receipt.closedBy} em ${formatDateTime(receipt.closedAt, timezone)}`,
    '',
    `Abertura: ${formatMoney(receipt.openingAmount)}`,
    `Entradas: ${formatMoney(0)}`,
    `Vendas: ${formatMoney(receipt.salesTotal)}`,
    `Saidas: ${formatMoney(receipt.cashOutTotal)}`,
    `Total sistemico: ${formatMoney(expectedBalance)}`,
    `Valor contado: ${formatMoney(countedBalance)}`,
    `Diferenca: ${formatMoney(difference)}`,
    `Quantidade de vendas: ${receipt.saleCount}`,
    `Ticket medio: ${formatMoney(averageTicket)}`,
    '',
    'Total por forma de pagamento',
    paymentText,
    '',
    'Entradas por venda',
    salesText,
    '',
    'Saidas de caixa',
    cashOutText,
    '',
    `PDF anexado: ${pdfFilename}`,
  ].join('\n');

  return { html, text, pdfBase64, pdfFilename };
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
      .select('nome_cliente, nome_estabelecimento, cnpj, telefone, email, cep, endereco, nome_rua, numero, complemento, bairro, cidade, estado')
      .eq('owner_user_id', ownerUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const typedStoreAccount = (storeAccount ?? null) as StoreAccount | null;
    const registeredStoreEmail = typedStoreAccount?.email?.trim() || typedCallerProfile?.email?.trim() || user.email?.trim() || '';

    const { data: fiscalSettings } = await serviceClient
      .from('store_fiscal_settings')
      .select('issuer_trade_name, issuer_legal_name, issuer_cnpj, issuer_state_registration, address_street, address_number, address_complement, address_district, address_city, address_zip_code, issuer_state')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    const storeIdentity = resolveStoreIdentity(
      typedStoreAccount,
      (fiscalSettings ?? null) as StoreFiscalSettings | null,
      registeredStoreEmail,
    );

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
    const { html, text, pdfBase64, pdfFilename } = buildEmailContent(receipt, reportTimezone, storeIdentity);

    await sendHappyCashEmail({
      from: fromEmail,
      to: recipients,
      subject,
      html,
      text,
      attachments: [{ filename: pdfFilename, content: pdfBase64 }],
    });

    return jsonResponse(request, {
      message: 'Relatorio enviado por e-mail com sucesso.',
      recipients,
      attachment: pdfFilename,
    });
  } catch (error) {
    console.error('Erro inesperado ao enviar relatorio de fechamento:', error);
    const message = error instanceof Error ? error.message : 'Erro inesperado ao enviar o relatorio.';
    return jsonResponse(request, { error: message }, 500);
  }
});
