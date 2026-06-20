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
      saleId: '12345678-aaaa-bbbb-cccc-123456789000',
      saleDate: '2026-06-19T15:00:00-03:00',
      operatorName: 'Celio',
      customerName: 'Cliente Teste',
      paymentMethod: 'Fiado',
      total: 25,
      subtotal: 25,
      serviceTicketNumber: 42,
      creditBalanceAfter: 75,
      items: [{ productName: 'Produto', quantity: 2, unitPrice: 12.5, total: 25 }],
    }, { attachBrowserPrintScript: false });

    expect(html).toContain('Nao e documento fiscal');
    expect(html).toContain('12.345.678/0001-90');
    expect(html).toContain('Rua Central, 10');
    expect(html).toContain('Comanda');
    expect(html).toContain('#42');
    expect(html).toContain('Itens (2)');
    expect(html).toContain('Saldo fiado apos esta venda');
    expect(html).toContain('font-size: 15px');
    expect(html).toContain('size: auto');
    expect(html).not.toContain('size: 80mm auto');
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

  it('loads the coupon before attaching the automatic-print iframe', async () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const focus = vi.fn();

    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const iframe = node as HTMLIFrameElement;
      expect(iframe.srcdoc).toContain('Loja Teste');
      Object.defineProperty(iframe, 'contentWindow', {
        configurable: true,
        value: { focus, print, onafterprint: null },
      });
      window.setTimeout(() => iframe.onload?.call(iframe, new Event('load')), 0);
      return node;
    });

    const result = openRetailCouponPrintWindow(payload, { automaticPrint: true });
    await vi.advanceTimersByTimeAsync(1700);

    await expect(result).resolves.toBe(true);
    expect(focus).toHaveBeenCalledOnce();
    expect(print).toHaveBeenCalledOnce();
  });

  it('does not fall back to a second browser print after an Electron failure', async () => {
    const printHtml = vi.fn().mockResolvedValue(false);
    window.electronAPI = { printHtml } as Window['electronAPI'];
    const appendChild = vi.spyOn(document.body, 'appendChild');

    await expect(openRetailCouponPrintWindow(payload, {
      preferSilentPrint: true,
      automaticPrint: true,
    })).resolves.toBe(false);

    expect(printHtml).toHaveBeenCalledOnce();
    expect(appendChild).not.toHaveBeenCalled();
  });
});
