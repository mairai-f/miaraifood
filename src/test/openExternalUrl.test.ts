import { afterEach, describe, expect, it, vi } from 'vitest';

import { openExternalUrl } from '@/lib/openExternalUrl';

describe('openExternalUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('abre links http/https sem expor opener', () => {
    const popup = { opener: window } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    expect(openExternalUrl('https://wa.me/5511999999999')).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/5511999999999',
      '_blank',
      'noopener,noreferrer'
    );
    expect(popup.opener).toBeNull();
  });

  it('bloqueia protocolos inseguros', () => {
    const openSpy = vi.spyOn(window, 'open');

    expect(openExternalUrl('javascript:alert(1)')).toBe(false);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('retorna false quando o navegador bloqueia o popup', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(openExternalUrl('https://wa.me/5511999999999')).toBe(false);
  });
});
