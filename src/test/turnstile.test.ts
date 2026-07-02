import { afterEach, describe, expect, it, vi } from 'vitest';

import { isTurnstileConfigured, requestTurnstileToken } from '../../shared/security/turnstile';

describe('Cloudflare Turnstile', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('mantem os fluxos atuais quando a chave publica ainda nao foi configurada', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');

    expect(isTurnstileConfigured()).toBe(false);
    await expect(requestTurnstileToken('login')).resolves.toBeUndefined();
  });

  it('nao tenta abrir o desafio em runtimes nativos sem origem HTTPS', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-test');
    const originalSecureContext = window.isSecureContext;
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });

    await expect(requestTurnstileToken('login')).resolves.toBeUndefined();

    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecureContext });
  });

  it('usa a janela HTTPS do Electron para validar o Desktop online', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-test');
    const originalElectronApi = window.electronAPI;
    const requestToken = vi.fn().mockResolvedValue({ success: true, token: 'desktop-token-validado' });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { turnstile: { requestToken } },
    });

    await expect(requestTurnstileToken('App Login')).resolves.toBe('desktop-token-validado');
    expect(requestToken).toHaveBeenCalledWith('app-login');

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: originalElectronApi,
    });
  });
});
