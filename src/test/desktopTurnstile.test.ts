import { createRequire } from 'node:module';

import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { requestDesktopTurnstileToken } = require('../../electron/desktop-turnstile.cjs') as {
  requestDesktopTurnstileToken: (options: {
    action: string;
    appOrigin: string;
    openExternal: (url: string) => Promise<void>;
    timeoutMs: number;
  }) => Promise<{ success: boolean; token?: string; error?: string }>;
};

describe('Turnstile do Desktop no navegador padrao', () => {
  it('abre HTTPS e aceita somente o retorno local com estado de uso unico', async () => {
    let resolveOpenedUrl: (url: string) => void = () => undefined;
    const openedUrl = new Promise<string>((resolve) => {
      resolveOpenedUrl = resolve;
    });
    const openExternal = vi.fn(async (url: string) => {
      resolveOpenedUrl(url);
    });

    const resultPromise = requestDesktopTurnstileToken({
      action: 'App Login',
      appOrigin: 'https://app.miaraifood.com.br',
      openExternal,
      timeoutMs: 5_000,
    });
    const challengeUrl = new URL(await openedUrl);
    const callbackUrl = new URL(challengeUrl.searchParams.get('callback') ?? '');
    const state = challengeUrl.searchParams.get('state') ?? '';

    expect(challengeUrl.origin).toBe('https://app.miaraifood.com.br');
    expect(challengeUrl.pathname).toBe('/desktop-turnstile');
    expect(challengeUrl.searchParams.get('action')).toBe('app-login');
    expect(callbackUrl.hostname).toBe('127.0.0.1');
    expect(callbackUrl.pathname).toBe('/turnstile-callback');
    expect(state.length).toBeGreaterThanOrEqual(32);

    const invalidCallback = new URL(callbackUrl);
    invalidCallback.searchParams.set('state', 'estado-incorreto');
    invalidCallback.searchParams.set('token', 'token-que-nao-pode-ser-aceito');
    await expect(fetch(invalidCallback)).resolves.toMatchObject({ status: 400 });

    callbackUrl.searchParams.set('state', state);
    callbackUrl.searchParams.set('token', 'token-turnstile-valido-para-o-teste');
    await expect(fetch(callbackUrl)).resolves.toMatchObject({ status: 200 });
    await expect(resultPromise).resolves.toEqual({
      success: true,
      token: 'token-turnstile-valido-para-o-teste',
    });
    expect(openExternal).toHaveBeenCalledOnce();
  });

  it('falha sem deixar servidor pendurado quando o navegador nao abre', async () => {
    await expect(requestDesktopTurnstileToken({
      action: 'app-login',
      appOrigin: 'https://app.miaraifood.com.br',
      openExternal: async () => {
        throw new Error('navegador indisponivel');
      },
      timeoutMs: 5_000,
    })).resolves.toEqual({
      success: false,
      error: 'navegador indisponivel',
    });
  });
});
