import { formatCurrency, formatDateTime, getActiveLocale, translateCurrentText } from '../../shared/locale/format';

export interface RetailCouponPrintItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface RetailCouponPrintPayload {
  storeName: string;
  storeTaxId?: string | null;
  storeAddress?: string | null;
  storePhone?: string | null;
  systemBrandLabel?: string | null;
  saleId: string;
  saleDate: string;
  operatorName?: string | null;
  customerName?: string | null;
  paymentMethod?: string | null;
  total: number;
  subtotal?: number | null;
  discount?: number | null;
  changeAmount?: number | null;
  cashReceived?: number | null;
  isDelivery?: boolean | null;
  serviceTicketNumber?: number | null;
  creditBalanceAfter?: number | null;
  items: RetailCouponPrintItem[];
  copyLabel?: string | null;
  footerMessage?: string | null;
}

interface RetailCouponPrintOptions {
  preferSilentPrint?: boolean;
  automaticPrint?: boolean;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatMoney = (value: number) => formatCurrency(value);

const formatSaleCode = (saleId: string) => {
  const normalized = saleId.replaceAll('-', '').toUpperCase();
  return normalized.slice(0, 8) || 'SEM-CODIGO';
};

const formatTaxId = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length !== 14) return value.trim();
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const applyMeasuredBrowserPageSize = (frameDocument: Document) => {
  const receipt = frameDocument.querySelector<HTMLElement>('[data-receipt-root]');
  if (!receipt) return;

  const receiptHeightMm = Math.max(50, Math.ceil((receipt.getBoundingClientRect().height * 25.4) / 96));
  const pageStyle = frameDocument.createElement('style');
  pageStyle.setAttribute('data-happycash-page-size', 'true');
  pageStyle.textContent = `@page { size: 80mm ${receiptHeightMm}mm; margin: 0; }`;
  frameDocument.head.appendChild(pageStyle);
};

const printRetailCouponWithIframe = (html: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const iframe = document.createElement('iframe');
    let settled = false;

    const finalize = (printed: boolean) => {
      if (settled) return;
      settled = true;

      window.setTimeout(() => {
        iframe.remove();
      }, 1000);

      resolve(printed);
    };

    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;

      if (!frameWindow) {
        finalize(false);
        return;
      }

      applyMeasuredBrowserPageSize(frameWindow.document);
      frameWindow.onafterprint = () => finalize(true);

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
          window.setTimeout(() => finalize(true), 1500);
        } catch {
          finalize(false);
        }
      }, 120);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
};

export const buildRetailCouponHtml = (
  payload: RetailCouponPrintPayload,
  options?: {
    attachBrowserPrintScript?: boolean;
  },
) => {
  const itemsHtml = payload.items.length > 0
    ? payload.items.map(item => `
        <div class="item">
          <div class="item-name">${escapeHtml(item.productName)}</div>
          <div class="item-meta">
            <span>${item.quantity} x ${escapeHtml(formatMoney(item.unitPrice))}</span>
            <strong>${escapeHtml(formatMoney(item.total))}</strong>
          </div>
        </div>
      `).join('')
    : `
      <div class="empty-state">Nenhum item encontrado para este cupom.</div>
    `;

  const saleDate = formatDateTime(payload.saleDate);
  const copyLabel = payload.copyLabel?.trim();
  const footerMessage = payload.footerMessage?.trim() || translateCurrentText('Obrigado pela preferencia.');
  const systemBrandLabel = payload.systemBrandLabel?.trim() || translateCurrentText('Sistema HappyCash');
  const itemCount = payload.items.reduce((sum, item) => sum + item.quantity, 0);
  const attachBrowserPrintScript = options?.attachBrowserPrintScript !== false;

  return `
    <!doctype html>
    <html lang="${escapeHtml(getActiveLocale())}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Cupom nao fiscal</title>
        <style>
          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          @page {
            size: auto;
            margin: 0;
          }

          body {
            margin: 0;
            width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
            font-weight: 500;
          }

          .page {
            width: 80mm;
            margin: 0;
            padding: 0;
          }

          .coupon {
            width: 80mm;
            background: #ffffff;
            padding: 9mm 3mm 5mm;
          }

          .center {
            text-align: center;
          }

          .brand-name {
            font-size: 21px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.18em;
          }

          .store-name {
            margin-top: 8px;
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .system-brand {
            margin-top: 4px;
            color: #000000;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .title {
            margin-top: 8px;
            font-size: 17px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .subtitle {
            margin-top: 4px;
            color: #000000;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.35;
          }

          .store-details {
            margin-top: 6px;
            font-size: 13px;
            font-weight: 600;
            line-height: 1.35;
          }

          .non-fiscal-warning {
            margin-top: 10px;
            padding: 6px;
            border: 2px solid #000000;
            font-size: 14px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .copy-label {
            display: inline-block;
            margin-top: 10px;
            padding: 4px 8px;
            border: 1px dashed #000000;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .divider {
            margin: 12px 0;
            border-top: 1px dashed #000000;
          }

          .meta,
          .totals {
            display: grid;
            gap: 6px;
            font-size: 14px;
            font-weight: 600;
          }

          .meta-row,
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }

          .meta-row span:first-child,
          .total-row span:first-child {
            color: #000000;
          }

          .meta-row span:last-child,
          .total-row span:last-child {
            text-align: right;
          }

          .items-title {
            margin-bottom: 8px;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .items {
            display: grid;
            gap: 8px;
          }

          .item {
            padding-bottom: 8px;
            border-bottom: 1px dashed #000000;
            break-inside: avoid;
          }

          .item:last-child {
            padding-bottom: 0;
            border-bottom: 0;
          }

          .item-name {
            font-size: 15px;
            font-weight: 700;
            line-height: 1.35;
            word-break: break-word;
          }

          .item-meta {
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #000000;
            font-size: 13px;
            font-weight: 600;
          }

          .item-meta strong {
            color: #000000;
            font-size: 14px;
            font-weight: 800;
          }

          .total-row.total {
            padding-top: 8px;
            border-top: 2px solid #000000;
            font-size: 18px;
            font-weight: 900;
          }

          .footer {
            margin-top: 12px;
            font-size: 13px;
            color: #000000;
            font-weight: 600;
            text-align: center;
            line-height: 1.5;
          }

          .empty-state {
            color: #000000;
            font-size: 14px;
            text-align: center;
            padding: 8px 0;
          }

          @media print {
            body {
              background: #ffffff;
            }

            .page {
              padding: 0;
            }

            .coupon {
              width: 80mm;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <article class="coupon" data-receipt-root data-sale-id="${escapeHtml(payload.saleId)}">
            <header class="center">
              <div class="brand-name">HappyCash</div>
              <div class="system-brand">${escapeHtml(systemBrandLabel)}</div>
              <div class="store-name">${escapeHtml(payload.storeName)}</div>
              ${(payload.storeTaxId || payload.storeAddress || payload.storePhone) ? `
                <div class="store-details">
                  ${payload.storeTaxId ? `<div>CNPJ: ${escapeHtml(formatTaxId(payload.storeTaxId))}</div>` : ''}
                  ${payload.storeAddress ? `<div>${escapeHtml(payload.storeAddress)}</div>` : ''}
                  ${payload.storePhone ? `<div>Contato: ${escapeHtml(payload.storePhone)}</div>` : ''}
                </div>
              ` : ''}
              <div class="non-fiscal-warning">Nao e documento fiscal</div>
              <div class="title">Comprovante de venda</div>
              <div class="subtitle">Documento de venda rapida de varejo ao consumidor final</div>
              ${copyLabel ? `<div class="copy-label">${escapeHtml(copyLabel)}</div>` : ''}
            </header>

            <div class="divider"></div>

            <section class="meta">
              <div class="meta-row">
                <span>Venda</span>
                <span>#${escapeHtml(formatSaleCode(payload.saleId))}</span>
              </div>
              <div class="meta-row">
                <span>Data</span>
                <span>${escapeHtml(saleDate)}</span>
              </div>
              ${payload.serviceTicketNumber ? `
                <div class="meta-row">
                  <span>Comanda</span>
                  <span>#${escapeHtml(String(payload.serviceTicketNumber))}</span>
                </div>
              ` : ''}
              ${payload.operatorName ? `
                <div class="meta-row">
                  <span>Operador</span>
                  <span>${escapeHtml(payload.operatorName)}</span>
                </div>
              ` : ''}
              ${payload.customerName ? `
                <div class="meta-row">
                  <span>Cliente</span>
                  <span>${escapeHtml(payload.customerName)}</span>
                </div>
              ` : ''}
              <div class="meta-row">
                <span>Atendimento</span>
                <span>${payload.isDelivery ? 'Delivery' : 'Balcao'}</span>
              </div>
              ${payload.paymentMethod ? `
                <div class="meta-row">
                  <span>Pagamento</span>
                  <span>${escapeHtml(payload.paymentMethod)}</span>
                </div>
              ` : ''}
            </section>

            <div class="divider"></div>

            <section>
              <div class="items-title">Itens (${escapeHtml(String(itemCount))})</div>
              <div class="items">${itemsHtml}</div>
            </section>

            <div class="divider"></div>

            <section class="totals">
              ${typeof payload.subtotal === 'number' ? `
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>${escapeHtml(formatMoney(payload.subtotal))}</span>
                </div>
              ` : ''}
              ${(payload.discount ?? 0) > 0 ? `
                <div class="total-row">
                  <span>Desconto</span>
                  <span>- ${escapeHtml(formatMoney(payload.discount ?? 0))}</span>
                </div>
              ` : ''}
              <div class="total-row total">
                <span>Total</span>
                <span>${escapeHtml(formatMoney(payload.total))}</span>
              </div>
              ${(payload.cashReceived ?? 0) > 0 ? `
                <div class="total-row">
                  <span>Valor recebido</span>
                  <span>${escapeHtml(formatMoney(payload.cashReceived ?? 0))}</span>
                </div>
              ` : ''}
              ${(payload.changeAmount ?? 0) > 0 ? `
                <div class="total-row">
                  <span>Troco</span>
                  <span>${escapeHtml(formatMoney(payload.changeAmount ?? 0))}</span>
                </div>
              ` : ''}
              ${typeof payload.creditBalanceAfter === 'number' ? `
                <div class="total-row">
                  <span>Saldo fiado apos esta venda</span>
                  <span>${escapeHtml(formatMoney(payload.creditBalanceAfter))}</span>
                </div>
              ` : ''}
            </section>

            <footer class="footer">
              ${escapeHtml(footerMessage)}
            </footer>
          </article>
        </main>

        <script>
          ${attachBrowserPrintScript ? `
            window.onload = () => {
              window.focus();
              window.print();
            };
            window.onafterprint = () => window.close();
          ` : ''}
        </script>
      </body>
    </html>
  `;
};

export const openRetailCouponPrintWindow = async (
  payload: RetailCouponPrintPayload,
  options?: RetailCouponPrintOptions,
) => {
  if (typeof window === 'undefined') return false;

  const preferSilentPrint = options?.preferSilentPrint === true;
  const automaticPrint = options?.automaticPrint === true;
  const html = buildRetailCouponHtml(payload, {
    attachBrowserPrintScript: !preferSilentPrint && !automaticPrint,
  });

  if (preferSilentPrint && typeof window.electronAPI?.printHtml === 'function') {
    return window.electronAPI.printHtml(html);
  }

  if (automaticPrint) {
    const printed = await printRetailCouponWithIframe(html);

    if (printed) {
      return true;
    }
  }

  const printWindow = window.open('', '_blank', 'width=420,height=900');
  if (!printWindow) return false;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
};
