import { formatCurrency, formatDateTime, getActiveLocale, translateCurrentText } from '../../shared/locale/format';

export interface RetailCouponPrintItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface RetailCouponPrintPayload {
  storeName: string;
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

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
};

const buildRetailCouponHtml = (
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
            size: 80mm auto;
            margin: 4mm;
          }

          body {
            margin: 0;
            background: #eef2f7;
            color: #111827;
            font-family: "Courier New", Courier, monospace;
          }

          .page {
            display: flex;
            justify-content: center;
            padding: 16px;
          }

          .coupon {
            width: 302px;
            background: #ffffff;
            border: 1px solid #d1d5db;
            padding: 16px 14px;
          }

          .center {
            text-align: center;
          }

          .brand-name {
            font-size: 18px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.18em;
          }

          .store-name {
            margin-top: 8px;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .system-brand {
            margin-top: 4px;
            color: #4b5563;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .title {
            margin-top: 8px;
            font-size: 15px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .subtitle {
            margin-top: 4px;
            color: #4b5563;
            font-size: 11px;
            line-height: 1.45;
          }

          .copy-label {
            display: inline-block;
            margin-top: 10px;
            padding: 4px 8px;
            border: 1px dashed #111827;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .divider {
            margin: 12px 0;
            border-top: 1px dashed #9ca3af;
          }

          .meta,
          .totals {
            display: grid;
            gap: 6px;
            font-size: 12px;
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
            color: #4b5563;
          }

          .meta-row span:last-child,
          .total-row span:last-child {
            text-align: right;
          }

          .items-title {
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }

          .items {
            display: grid;
            gap: 8px;
          }

          .item {
            padding-bottom: 8px;
            border-bottom: 1px dashed #d1d5db;
          }

          .item:last-child {
            padding-bottom: 0;
            border-bottom: 0;
          }

          .item-name {
            font-size: 12px;
            line-height: 1.4;
            word-break: break-word;
          }

          .item-meta {
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
            gap: 8px;
            color: #4b5563;
            font-size: 11px;
          }

          .item-meta strong {
            color: #111827;
            font-size: 12px;
          }

          .total-row.total {
            padding-top: 8px;
            border-top: 1px solid #111827;
            font-size: 14px;
            font-weight: 700;
          }

          .footer {
            margin-top: 12px;
            font-size: 11px;
            color: #4b5563;
            text-align: center;
            line-height: 1.5;
          }

          .empty-state {
            color: #6b7280;
            font-size: 12px;
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
              width: 100%;
              border: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <article class="coupon">
            <header class="center">
              <div class="brand-name">HappyCash</div>
              <div class="system-brand">${escapeHtml(systemBrandLabel)}</div>
              <div class="store-name">${escapeHtml(payload.storeName)}</div>
              <div class="title">Cupom nao fiscal</div>
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
              <div class="items-title">Itens</div>
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
    const printed = await window.electronAPI.printHtml(html);

    if (printed) {
      return true;
    }
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
