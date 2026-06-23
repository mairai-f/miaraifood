import { formatCurrency, formatDateTime, getActiveLocale, translateCurrentText } from '../../shared/locale/format';

export const HOMOLOGATION_MESSAGE = 'EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

export type FiscalEnvironment = 'homologacao' | 'producao';
export type FiscalProvider = 'internal' | 'nuvem_fiscal';
export type FiscalMode = 'receipt_only' | 'nfce';

export interface FiscalPayloadItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface FiscalPayloadSnapshot {
  issuer?: {
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    stateRegistration?: string | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressComplement?: string | null;
    addressDistrict?: string | null;
    addressCity?: string | null;
    addressZipCode?: string | null;
    state?: string | null;
  };
  customer?: {
    name?: string | null;
    document?: string | null;
    phone?: string | null;
  };
  sale?: {
    sellerName?: string | null;
    paymentMethod?: string | null;
    total?: number | null;
    discount?: number | null;
    changeAmount?: number | null;
    cashReceived?: number | null;
    date?: string | null;
    operationNature?: string | null;
  };
  items?: FiscalPayloadItem[];
  danfeMessage?: string | null;
  printCustomerCopy?: boolean;
}

export interface FiscalDocumentRecord {
  id: string;
  saleId: string;
  documentModel: string;
  environment: FiscalEnvironment;
  status: string;
  provider?: FiscalProvider;
  series: number;
  number: number;
  accessKey: string;
  externalId?: string | null;
  externalStatus?: string | null;
  protocol?: string | null;
  homologationMessage?: string | null;
  errorMessage?: string | null;
  payload?: FiscalPayloadSnapshot | null;
  emittedAt: string;
}

export interface FiscalRuntimeStatus {
  enabled: boolean;
  fiscalMode: FiscalMode;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  ready: boolean;
  providerConfigured: boolean;
  danfeAutoPrint: boolean;
  danfeStoreLocally: boolean;
  consumerDocumentPromptEnabled: boolean;
  danfePrintWidth: '80mm' | '58mm';
  series: number;
  nextNumber: number;
  operationNature?: string | null;
  issuerName?: string | null;
  printCustomerCopy: boolean;
  contingencyOfflineEnabled: boolean;
  missingItems: string[];
}

export interface ManageFiscalDocumentsResponse {
  success?: boolean;
  error?: string;
  runtime?: FiscalRuntimeStatus | Record<string, unknown> | null;
  document?: FiscalDocumentRecord | Record<string, unknown> | null;
  reused?: boolean;
  missingItems?: string[];
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeFiscalDocumentRecord = (row: Record<string, unknown>): FiscalDocumentRecord => ({
  id: String(row.id ?? ''),
  saleId: String(row.sale_id ?? row.saleId ?? ''),
  documentModel: String(row.document_model ?? row.documentModel ?? '65'),
  environment: row.environment === 'producao' ? 'producao' : 'homologacao',
  status: String(row.status ?? 'pendente'),
  provider: row.provider === 'nuvem_fiscal' ? 'nuvem_fiscal' : 'internal',
  series: toFiniteNumber(row.series, 0),
  number: toFiniteNumber(row.number, 0),
  accessKey: String(row.access_key ?? row.accessKey ?? ''),
  externalId: typeof row.external_id === 'string'
    ? row.external_id
    : typeof row.externalId === 'string'
      ? row.externalId
      : null,
  externalStatus: typeof row.external_status === 'string'
    ? row.external_status
    : typeof row.externalStatus === 'string'
      ? row.externalStatus
      : null,
  protocol: typeof row.protocol === 'string' ? row.protocol : null,
  homologationMessage: typeof row.homologation_message === 'string'
    ? row.homologation_message
    : typeof row.homologationMessage === 'string'
      ? row.homologationMessage
      : null,
  errorMessage: typeof row.error_message === 'string'
    ? row.error_message
    : typeof row.errorMessage === 'string'
      ? row.errorMessage
      : null,
  payload: (row.payload as FiscalPayloadSnapshot | null | undefined) ?? null,
  emittedAt: String(row.emitted_at ?? row.emittedAt ?? ''),
});

export const normalizeFiscalRuntimeStatus = (row: Record<string, unknown>): FiscalRuntimeStatus => ({
  enabled: Boolean(row.enabled),
  fiscalMode: row.fiscalMode === 'nfce' || row.fiscal_mode === 'nfce' ? 'nfce' : 'receipt_only',
  provider: row.provider === 'nuvem_fiscal' ? 'nuvem_fiscal' : 'internal',
  environment: row.environment === 'producao' ? 'producao' : 'homologacao',
  ready: Boolean(row.ready),
  providerConfigured: row.providerConfigured !== false && row.provider_configured !== false,
  danfeAutoPrint: row.danfeAutoPrint === true || row.danfe_auto_print === true,
  danfeStoreLocally: row.danfeStoreLocally !== false && row.danfe_store_locally !== false,
  consumerDocumentPromptEnabled: row.consumerDocumentPromptEnabled !== false && row.consumer_document_prompt_enabled !== false,
  danfePrintWidth: row.danfePrintWidth === '58mm' || row.danfe_print_width === '58mm' ? '58mm' : '80mm',
  series: toFiniteNumber(row.series, 1),
  nextNumber: toFiniteNumber(row.nextNumber ?? row.next_number, 1),
  operationNature: typeof row.operationNature === 'string'
    ? row.operationNature
    : typeof row.operation_nature === 'string'
      ? row.operation_nature
      : null,
  issuerName: typeof row.issuerName === 'string'
    ? row.issuerName
    : typeof row.issuer_name === 'string'
      ? row.issuer_name
      : null,
  printCustomerCopy: row.printCustomerCopy !== false && row.print_customer_copy !== false,
  contingencyOfflineEnabled: row.contingencyOfflineEnabled !== false && row.contingency_offline_enabled !== false,
  missingItems: Array.isArray(row.missingItems)
    ? row.missingItems.map(item => String(item))
    : Array.isArray(row.missing_items)
      ? row.missing_items.map(item => String(item))
      : [],
});

export const fiscalStatusVariant = (
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'homologacao_emitida':
    case 'autorizada':
      return 'default';
    case 'erro':
      return 'destructive';
    case 'cancelada':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const fiscalStatusLabel = (status: string) => {
  switch (status) {
    case 'homologacao_emitida':
      return translateCurrentText('Homologacao emitida');
    case 'autorizada':
      return translateCurrentText('Autorizada');
    case 'erro':
      return translateCurrentText('Erro');
    case 'cancelada':
      return translateCurrentText('Cancelada');
    default:
      return translateCurrentText('Pendente');
  }
};

export const paymentMethodLabel = (value?: string | null) => {
  switch (value) {
    case 'dinheiro':
      return translateCurrentText('Dinheiro');
    case 'pix':
      return 'Pix';
    case 'fiado':
      return translateCurrentText('Fiado');
    case 'cartao_debito':
      return translateCurrentText('Cartao de debito');
    case 'cartao_credito':
      return translateCurrentText('Cartao de credito');
    default:
      return value ? translateCurrentText(value) : translateCurrentText('Nao informado');
  }
};

export const formatMoney = (value: number) => formatCurrency(value);

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const getPayloadItems = (document: FiscalDocumentRecord) => document.payload?.items ?? [];

export const buildFiscalDocumentHtml = (
  document: FiscalDocumentRecord,
  options: { autoPrint?: boolean } = {},
) => {
  const payload = document.payload ?? {};
  const issuer = payload.issuer ?? {};
  const sale = payload.sale ?? {};
  const items = getPayloadItems(document);
  const customer = payload.customer ?? {};
  const emittedAt = formatDateTime(document.emittedAt);
  const saleDate = sale.date ? formatDateTime(sale.date) : emittedAt;
  const tradeName = issuer.tradeName || issuer.legalName || 'HappyCash';
  const addressParts = [
    issuer.addressStreet,
    issuer.addressNumber,
    issuer.addressComplement,
    issuer.addressDistrict,
    issuer.addressCity,
    issuer.state,
    issuer.addressZipCode,
  ].filter(Boolean);

  const itemsHtml = items.length > 0
    ? items.map(item => `
        <tr>
          <td>${escapeHtml(item.productName)}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">${escapeHtml(formatMoney(item.unitPrice))}</td>
          <td style="text-align:right;">${escapeHtml(formatMoney(item.total))}</td>
        </tr>
      `).join('')
    : `
      <tr>
        <td colspan="4" style="text-align:center;color:#6b7280;">Sem itens para exibir.</td>
      </tr>
    `;

  return `
    <!doctype html>
    <html lang="${escapeHtml(getActiveLocale())}">
      <head>
        <meta charset="utf-8" />
        <title>DANFE NFC-e ${escapeHtml(String(document.number || ''))}</title>
        <style>
          * {
            box-sizing: border-box;
          }
          @page {
            size: auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            color: #111827;
          }
          .coupon {
            width: 80mm;
            margin: 0 auto;
            background: #fff;
            border: 1px solid #d1d5db;
            padding: 5mm 4mm;
            box-sizing: border-box;
          }
          .center { text-align: center; }
          .muted { color: #6b7280; font-size: 12px; }
          .strong { font-weight: 700; }
          .message {
            margin: 14px 0;
            padding: 10px;
            border: 1px dashed #111827;
            font-size: 12px;
            text-align: center;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            padding: 6px 0;
            border-bottom: 1px dashed #d1d5db;
            vertical-align: top;
          }
          .totals {
            margin-top: 12px;
            font-size: 13px;
          }
          .totals div {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
          }
          .qr-placeholder {
            margin: 16px auto 10px;
            width: 132px;
            height: 132px;
            border: 2px solid #111827;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            font-size: 11px;
            font-weight: 700;
            padding: 8px;
            box-sizing: border-box;
          }
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .coupon {
              border: none;
              width: auto;
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="coupon" data-receipt-root data-sale-id="${escapeHtml(document.saleId)}">
          <div class="center">
            <div class="strong">${escapeHtml(tradeName)}</div>
            ${issuer.legalName ? `<div class="muted">${escapeHtml(issuer.legalName)}</div>` : ''}
            ${issuer.cnpj ? `<div class="muted">CNPJ: ${escapeHtml(issuer.cnpj)}</div>` : ''}
            ${issuer.stateRegistration ? `<div class="muted">IE: ${escapeHtml(issuer.stateRegistration)}</div>` : ''}
            ${addressParts.length > 0 ? `<div class="muted">${escapeHtml(addressParts.join(' - '))}</div>` : ''}
          </div>

          <div class="message">${escapeHtml(document.homologationMessage || HOMOLOGATION_MESSAGE)}</div>

          <div class="center">
            <div class="strong">DANFE NFC-e Simplificado</div>
            <div class="muted">Ambiente: ${escapeHtml(document.environment)}</div>
            <div class="muted">Numero: ${escapeHtml(String(document.number))} | Serie: ${escapeHtml(String(document.series))}</div>
            <div class="muted">Emissao: ${escapeHtml(emittedAt)}</div>
            <div class="muted">Venda: ${escapeHtml(saleDate)}</div>
            ${sale.operationNature ? `<div class="muted">Natureza: ${escapeHtml(sale.operationNature)}</div>` : ''}
          </div>

          <div style="margin-top: 12px;">
            <table>
              <thead>
                <tr>
                  <th align="left">Item</th>
                  <th align="center">Qtd</th>
                  <th align="right">Unit</th>
                  <th align="right">Total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>

          <div class="totals">
            <div><span>Desconto</span><span>${escapeHtml(formatMoney(Number(sale.discount || 0)))}</span></div>
            <div><span>Total</span><span class="strong">${escapeHtml(formatMoney(Number(sale.total || 0)))}</span></div>
            <div><span>Pagamento</span><span>${escapeHtml(paymentMethodLabel(sale.paymentMethod))}</span></div>
            ${Number(sale.cashReceived || 0) > 0 ? `<div><span>Valor recebido</span><span>${escapeHtml(formatMoney(Number(sale.cashReceived || 0)))}</span></div>` : ''}
            ${Number(sale.changeAmount || 0) > 0 ? `<div><span>Troco</span><span>${escapeHtml(formatMoney(Number(sale.changeAmount || 0)))}</span></div>` : ''}
          </div>

          ${(customer.name || customer.document) ? `
            <div class="muted" style="margin-top:12px;">
              Consumidor: ${escapeHtml(customer.name || 'Nao identificado')}
              ${customer.document ? `<br />CPF/CNPJ: ${escapeHtml(customer.document)}` : ''}
            </div>
          ` : ''}
          ${sale.sellerName ? `<div class="muted">Operador: ${escapeHtml(sale.sellerName)}</div>` : ''}

          <div class="qr-placeholder">QR homologacao local</div>

          <div class="center muted">Chave de acesso</div>
          <div class="center strong" style="font-size:13px;word-break:break-all;">${escapeHtml(document.accessKey)}</div>
          ${document.protocol ? `<div class="center muted" style="margin-top:8px;">Protocolo interno: ${escapeHtml(document.protocol)}</div>` : ''}
          ${payload.danfeMessage ? `<div class="center muted" style="margin-top:8px;">${escapeHtml(payload.danfeMessage)}</div>` : ''}
        </main>
        ${options.autoPrint === false ? '' : `
          <script>
            window.focus();
            window.print();
          </script>
        `}
      </body>
    </html>
  `;
};

export const openFiscalDocumentPrintWindow = (document: FiscalDocumentRecord) => {
  if (typeof window === 'undefined') return;

  const html = buildFiscalDocumentHtml(document);
  const printWindow = window.open('', '_blank', 'width=480,height=840');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
