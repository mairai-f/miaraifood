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

  it('nao abre Turnstile no executavel', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const originalElectronApi = window.electronAPI;
    const requestToken = vi.fn();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { turnstile: { requestToken } },
    });

    await expect(requestTurnstileToken('App Login')).resolves.toBeUndefined();
    expect(requestToken).not.toHaveBeenCalled();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: originalElectronApi,
    });
  });

  it('mostra o widget visivel no navegador externo sem executar o modo invisivel', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-test');
    const originalSecureContext = window.isSecureContext;
    const originalTurnstile = window.turnstile;
    const originalElectronApi = window.electronAPI;
    const execute = vi.fn();
    const remove = vi.fn();
    const render = vi.fn((_container: HTMLElement, options: { callback: (token: string) => void }) => {
      queueMicrotask(() => options.callback('browser-token-validado'));
      return 'widget-visible';
    });

    Object.defineProperty(window, 'electronAPI', { configurable: true, value: undefined });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(window, 'turnstile', {
      configurable: true,
      value: { render, execute, remove },
    });

    await expect(requestTurnstileToken('App Login', { visible: true })).resolves.toBe('browser-token-validado');
    expect(render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      appearance: 'always',
      execution: 'render',
    }));
    expect(execute).not.toHaveBeenCalled();

    Object.defineProperty(window, 'turnstile', { configurable: true, value: originalTurnstile });
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: originalElectronApi });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalSecureContext });
  });
});
