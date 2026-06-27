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
  targetWindow?: Window | null;
}

// The Epson TM PPD labels this as 80 mm roll, but its actual page width is
// 204.3 points (72.07 mm). Matching that value prevents CUPS from tiling the
// receipt into pages that the legacy raster filter silently discards.
const RECEIPT_PAPER_WIDTH_MM = 72.07;
const RECEIPT_PAGE_HEIGHT_MM = 2000;
const RECEIPT_PRINTABLE_WIDTH_MM = 68;

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
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = `${RECEIPT_PAPER_WIDTH_MM}mm`;
    iframe.style.height = `${RECEIPT_PAGE_HEIGHT_MM}mm`;
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

      const sendPrint = () => {
        try {
          frameWindow.focus();
          frameWindow.print();
          window.setTimeout(() => finalize(true), 1500);
        } catch {
          finalize(false);
        }
      };
      const waitForFonts = frameWindow.document.fonts?.ready?.catch(() => undefined)
        || Promise.resolve();
      const requestFrame = frameWindow.requestAnimationFrame?.bind(frameWindow)
        || window.requestAnimationFrame.bind(window);

      waitForFonts.then(() => {
        let printQueued = false;
        const queuePrint = () => {
          if (printQueued) return;
          printQueued = true;
          window.setTimeout(sendPrint, 250);
        };
        const fallbackTimer = window.setTimeout(queuePrint, 900);

        requestFrame(() => {
          requestFrame(() => {
            window.clearTimeout(fallbackTimer);
            queuePrint();
          });
        });
      });
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
};

const writeRetailCouponToPrintWindow = (
  printWindow: Window,
  html: string,
  options?: { triggerPrint?: boolean },
) => {
  if (printWindow.closed) return false;

  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    if (options?.triggerPrint) {
      window.setTimeout(() => {
        if (printWindow.closed) return;

        const printableWindow = printWindow as Window & {
          scheduleHappyCashCouponPrint?: () => void;
          printHappyCashCoupon?: () => void;
        };

        if (typeof printableWindow.scheduleHappyCashCouponPrint === 'function') {
          printableWindow.scheduleHappyCashCouponPrint();
          return;
        }

        printableWindow.printHappyCashCoupon?.();
      }, 50);
    }

    return true;
  } catch {
    return false;
  }
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
  const printButtonLabel = copyLabel ? 'Imprimir 2ª via' : 'Imprimir cupom';
  const browserPrintActionsHtml = attachBrowserPrintScript
    ? `
        <div class="print-actions">
          <button type="button" class="print-button" data-print-button onclick="window.printHappyCashCoupon()">
            ${escapeHtml(printButtonLabel)}
          </button>
        </div>
      `
    : '';

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
            size: ${RECEIPT_PAPER_WIDTH_MM}mm ${RECEIPT_PAGE_HEIGHT_MM}mm;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: ${RECEIPT_PAPER_WIDTH_MM}mm;
            height: auto;
            overflow: visible;
            overflow-x: hidden;
          }

          body {
            background: #ffffff;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.28;
          }

          .page {
            width: ${RECEIPT_PAPER_WIDTH_MM}mm;
            height: auto;
            margin: 0;
            padding: 0;
            overflow: visible;
          }

          .print-actions {
            width: ${RECEIPT_PAPER_WIDTH_MM}mm;
            padding: 8px 10px;
            background: #f7f7f7;
            border-bottom: 1px solid #d4d4d4;
          }

          .print-button {
            width: 100%;
            min-height: 40px;
            border: 1px solid #000000;
            border-radius: 4px;
            background: #000000;
            color: #ffffff;
            font: 700 14px Arial, Helvetica, sans-serif;
            cursor: pointer;
          }

          .coupon {
            width: ${RECEIPT_PRINTABLE_WIDTH_MM}mm;
            height: auto;
            min-height: 0;
            margin: 0 auto;
            background: #ffffff;
            padding: 8mm 0 14mm;
            overflow: visible;
          }

          .center {
            text-align: center;
          }

          .print-start-buffer {
            height: 0;
          }

          .brand-name {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .system-brand {
            margin-top: 4px;
            color: #000000;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .store-name {
            margin-top: 6px;
            font-size: 15px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            line-height: 1.25;
            overflow-wrap: anywhere;
          }

          .title {
            margin-top: 7px;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .subtitle {
            margin-top: 4px;
            color: #000000;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .store-details {
            margin-top: 6px;
            font-size: 11px;
            font-weight: 600;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .non-fiscal-warning {
            margin-top: 8px;
            padding: 4px;
            border: 1px solid #000000;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
          }

          .copy-label {
            display: inline-block;
            margin-top: 8px;
            padding: 3px 6px;
            border: 1px dashed #000000;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .divider {
            margin: 9px 0;
            border-top: 1px dashed #000000;
          }

          .meta,
          .totals {
            display: grid;
            gap: 4px;
            font-size: 12px;
            font-weight: 600;
          }

          .meta-row,
          .total-row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: flex-start;
          }

          .meta-row span,
          .total-row span {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .meta-row span:first-child,
          .total-row span:first-child {
            color: #000000;
            flex: 0 1 38%;
          }

          .meta-row span:last-child,
          .total-row span:last-child {
            flex: 1 1 62%;
            text-align: right;
          }

          .items-title {
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 800;
            text-transform: uppercase;
          }

          .items {
            display: grid;
            gap: 6px;
          }

          .item {
            padding-bottom: 6px;
            border-bottom: 1px dashed #000000;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .item:last-child {
            padding-bottom: 0;
            border-bottom: 0;
          }

          .item-name {
            font-size: 12px;
            font-weight: 700;
            line-height: 1.35;
            overflow-wrap: anywhere;
          }

          .item-meta {
            margin-top: 3px;
            display: flex;
            justify-content: space-between;
            gap: 6px;
            color: #000000;
            font-size: 11px;
            font-weight: 600;
          }

          .item-meta strong {
            color: #000000;
            font-size: 12px;
            font-weight: 800;
          }

          .total-row.total {
            padding-top: 6px;
            border-top: 2px solid #000000;
            font-size: 15px;
            font-weight: 900;
          }

          .footer {
            margin-top: 10px;
            font-size: 11px;
            color: #000000;
            font-weight: 600;
            text-align: center;
            line-height: 1.5;
            overflow-wrap: anywhere;
          }

          .empty-state {
            color: #000000;
            font-size: 12px;
            text-align: center;
            padding: 6px 0;
          }

          @media print {
            .print-actions {
              display: none;
            }

            html,
            body {
              background: #ffffff;
              width: ${RECEIPT_PAPER_WIDTH_MM}mm !important;
              height: auto !important;
              overflow: visible !important;
            }

            .page {
              padding: 0;
            }

            .page,
            .coupon {
              height: auto !important;
              overflow: visible !important;
            }

            .coupon {
              width: ${RECEIPT_PRINTABLE_WIDTH_MM}mm;
            }
          }
        </style>
      </head>
      <body>
        ${browserPrintActionsHtml}
        <main class="page">
          <article
            class="coupon"
            data-receipt-root
            data-sale-id="${escapeHtml(payload.saleId)}"
          >
            <header class="center">
              <div class="print-start-buffer" aria-hidden="true"></div>
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
            window.printHappyCashCoupon = () => {
              window.focus();
              window.print();
            };
            window.scheduleHappyCashCouponPrint = async () => {
              if (window.__happyCashCouponPrintScheduled) return;
              window.__happyCashCouponPrintScheduled = true;

              try {
                await document.fonts?.ready;
              } catch {}
              let printQueued = false;
              const queuePrint = () => {
                if (printQueued) return;
                printQueued = true;
                window.setTimeout(() => {
                  window.printHappyCashCoupon();
                }, 250);
              };
              const fallbackTimer = window.setTimeout(queuePrint, 900);

              if (typeof window.requestAnimationFrame !== 'function') {
                window.clearTimeout(fallbackTimer);
                queuePrint();
                return;
              }

              window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                  window.clearTimeout(fallbackTimer);
                  queuePrint();
                });
              });
            };
            window.onload = () => {
              window.scheduleHappyCashCouponPrint();
            };
            window.onafterprint = () => {
              window.setTimeout(() => window.close(), 1200);
            };
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
  const targetWindow = options?.targetWindow;
  const html = buildRetailCouponHtml(payload, {
    attachBrowserPrintScript: !preferSilentPrint && !automaticPrint,
  });

  if (preferSilentPrint && typeof window.electronAPI?.printHtml === 'function') {
    return window.electronAPI.printHtml(html);
  }

  const fallbackHtml = automaticPrint
    ? buildRetailCouponHtml(payload, { attachBrowserPrintScript: !preferSilentPrint })
    : html;
  if (targetWindow) {
    const writtenToReservedWindow = writeRetailCouponToPrintWindow(targetWindow, fallbackHtml, {
      triggerPrint: automaticPrint && !preferSilentPrint,
    });
    if (writtenToReservedWindow) return true;
  }

  if (automaticPrint) {
    const printed = await printRetailCouponWithIframe(html);

    if (printed) {
      return true;
    }
  }

  const printWindow = window.open('', '_blank', 'width=420,height=900');
  if (!printWindow) return false;

  return writeRetailCouponToPrintWindow(printWindow, fallbackHtml, {
    triggerPrint: automaticPrint && !preferSilentPrint,
  });
};
