import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildRetailCouponHtml, openRetailCouponPrintWindow } from '@/lib/retailCoupon';

const payload = {
  storeName: 'Loja Teste',
  saleId: 'sale',
  saleDate: '2026-06-19T15:00:00-03:00',
  total: 10,
  items: [{ productName: 'Produto', quantity: 1, unitPrice: 10, total: 10 }],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete window.electronAPI;
});

describe('retail coupon', () => {
  it('prints store, item count and credit details without fiscal ambiguity', () => {
    const html = buildRetailCouponHtml({
      storeName: 'Loja Teste',
      storeTaxId: '12345678000190',
      storeAddress: 'Rua Central, 10',
      storePhone: '(11) 99999-9999',
      systemBrandLabel: 'Sistema HappyCash',
      saleId: '12345678-aaaa-bbbb-cccc-123456789000',
      saleDate: '2026-06-19T15:00:00-03:00',
      operatorName: 'Celio',
      customerName: 'Cliente Teste',
      paymentMethod: 'Fiado',
      total: 25,
      subtotal: 25,
      serviceTicketNumber: 42,
      creditBalanceAfter: 75,
      items: [{ productName: 'Produto', packagingName: 'FARDO COM 6', quantity: 2, unitPrice: 12.5, total: 25 }],
    }, { attachBrowserPrintScript: false });

    expect(html).toContain('Nao e documento fiscal');
    expect(html).toContain('HappyCash');
    expect(html).toContain('Sistema HappyCash');
    expect(html).toContain('Loja Teste');
    expect(html).toContain('12.345.678/0001-90');
    expect(html).toContain('Rua Central, 10');
    expect(html).toContain('Comanda');
    expect(html).toContain('#42');
    expect(html).toContain('Itens (2)');
    expect(html).toContain('Embalagem: FARDO COM 6');
    expect(html).toContain('Saldo fiado apos esta venda');
    expect(html).toContain('data-sale-id="12345678-aaaa-bbbb-cccc-123456789000"');
    expect(html).toContain('font-size: 12px');
    expect(html).toContain('width: 68mm');
    expect(html).toContain('padding: 8mm 0 14mm');
    expect(html).toContain('size: 72.07mm 2000mm');
    expect(html).not.toContain('data-receipt-min-height-mm');
    expect(html).not.toContain('size: 80mm auto');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).not.toContain('Imprimir cupom');
    expect(html).not.toContain('window.print()');
  });

  it('escapes user-provided receipt fields', () => {
    const html = buildRetailCouponHtml({
      storeName: '<script>alert(1)</script>',
      saleId: 'sale',
      saleDate: '2026-06-19T15:00:00-03:00',
      total: 1,
      items: [{ productName: '<img src=x>', quantity: 1, unitPrice: 1, total: 1 }],
    }, { attachBrowserPrintScript: false });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('keeps the first browser receipt as the original and closes after printing', () => {
    const html = buildRetailCouponHtml(payload);

    expect(html).toContain('Imprimir cupom');
    expect(html).toContain('size: 72.07mm 2000mm');
    expect(html).not.toContain('2ª via');
    expect(html).not.toContain('markHappyCashCouponAsCopy');
    expect(html).toContain('window.close()');
  });

  it('opens explicit receipt copies already marked as second copy', () => {
    const html = buildRetailCouponHtml({ ...payload, copyLabel: '2ª via' });

    expect(html).toContain('Imprimir 2ª via');
    expect(html).toContain('<div class="copy-label">2ª via</div>');
  });

  it('loads the coupon before attaching the automatic-print iframe', async () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const focus = vi.fn();
    let frameDocument: Document | null = null;

    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const iframe = node as HTMLIFrameElement;
      expect(iframe.srcdoc).toContain('Loja Teste');
      expect(iframe.style.width).toBe('72.07mm');
      expect(iframe.style.height).toBe('2000mm');
      frameDocument = document.implementation.createHTMLDocument('Cupom');
      frameDocument.body.innerHTML = '<article data-receipt-root style="height: 600px"></article>';
      vi.spyOn(frameDocument.querySelector('[data-receipt-root]') as HTMLElement, 'getBoundingClientRect')
        .mockReturnValue({ bottom: 600, height: 600 } as DOMRect);
      Object.defineProperty(frameDocument, 'fonts', {
        configurable: true,
        value: { ready: Promise.resolve() },
      });
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: {
          document: frameDocument,
          focus,
          print,
          onafterprint: null,
          requestAnimationFrame: (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
          },
        },
      });
      window.setTimeout(() => iframe.onload?.call(iframe, new Event('load')), 0);
      return node;
    });

    const result = openRetailCouponPrintWindow(payload, { automaticPrint: true });
    await vi.advanceTimersByTimeAsync(2200);

    await expect(result).resolves.toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
    expect(frameDocument?.head.querySelector('[data-happycash-page-size]')).toBeNull();
  });

  it('uses a preopened browser window before trying the automatic iframe', async () => {
    vi.useFakeTimers();
    const scheduleHappyCashCouponPrint = vi.fn();
    const printWindow = {
      closed: false,
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
      scheduleHappyCashCouponPrint,
    } as unknown as Window;
    const appendChild = vi.spyOn(document.body, 'appendChild');

    await expect(openRetailCouponPrintWindow(payload, {
      automaticPrint: true,
      targetWindow: printWindow,
    })).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(50);

    expect(printWindow.document.open).toHaveBeenCalledOnce();
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('window.print()'));
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Imprimir cupom'));
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('size: 72.07mm 2000mm'));
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.not.stringContaining('applyHappyCashReceiptPageSize'));
    expect(printWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('window.close()'));
    expect(printWindow.document.close).toHaveBeenCalledOnce();
    expect(printWindow.focus).toHaveBeenCalledOnce();
    expect(scheduleHappyCashCouponPrint).toHaveBeenCalledOnce();
    expect(appendChild).not.toHaveBeenCalled();
  });

  it('falls back when the preopened browser window is unavailable', async () => {
    const closedWindow = { closed: true } as unknown as Window;
    const fallbackWindow = {
      closed: false,
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(fallbackWindow);

    await expect(openRetailCouponPrintWindow(payload, {
      targetWindow: closedWindow,
    })).resolves.toBe(true);

    expect(open).toHaveBeenCalledOnce();
    expect(fallbackWindow.document.write).toHaveBeenCalledWith(expect.stringContaining('Loja Teste'));
    expect(fallbackWindow.focus).toHaveBeenCalledOnce();
  });

  it('keeps every product and totals in long receipts so the browser can paginate them', () => {
    const longItems = Array.from({ length: 40 }, (_, index) => ({
      productName: `Produto longo numero ${index + 1}`,
      quantity: 1,
      unitPrice: 2,
      total: 2,
    }));
    const html = buildRetailCouponHtml({
      ...payload,
      total: 80,
      subtotal: 80,
      items: longItems,
      footerMessage: 'FIM DO CUPOM',
    }, { attachBrowserPrintScript: false });

    expect(html).toContain('Produto longo numero 1');
    expect(html).toContain('Produto longo numero 40');
    expect(html).toContain('FIM DO CUPOM');
    expect(html).toContain('size: 72.07mm 2000mm');
    expect(html).not.toContain('pageRanges');
  });

  it('does not fall back to a second browser print after an Electron failure', async () => {
    const printHtml = vi.fn().mockResolvedValue(false);
    window.electronAPI = { printHtml } as unknown as Window['electronAPI'];
    const appendChild = vi.spyOn(document.body, 'appendChild');

    await expect(openRetailCouponPrintWindow(payload, {
      preferSilentPrint: true,
      automaticPrint: true,
    })).resolves.toBe(false);

    expect(printHtml).toHaveBeenCalledOnce();
    expect(appendChild).not.toHaveBeenCalled();
  });
});
