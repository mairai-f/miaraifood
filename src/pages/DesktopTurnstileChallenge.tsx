import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { requestTurnstileToken } from '../../shared/security/turnstile';

const getRequestedAction = () => {
  const value = new URLSearchParams(window.location.search).get('action') ?? 'desktop-auth';
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32) || 'desktop-auth';
};

const getBrowserCallback = () => {
  const params = new URLSearchParams(window.location.search);
  const callbackValue = params.get('callback');
  const state = params.get('state') ?? '';
  if (!callbackValue || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) return null;

  try {
    const callbackUrl = new URL(callbackValue);
    const validPort = Number(callbackUrl.port) >= 1024 && Number(callbackUrl.port) <= 65535;
    if (
      callbackUrl.protocol !== 'http:'
      || callbackUrl.hostname !== '127.0.0.1'
      || callbackUrl.pathname !== '/turnstile-callback'
      || !validPort
      || callbackUrl.username
      || callbackUrl.password
    ) {
      return null;
    }
    callbackUrl.search = '';
    callbackUrl.hash = '';
    return { callbackUrl, state };
  } catch {
    return null;
  }
};

export default function DesktopTurnstileChallenge() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const runChallenge = async () => {
      const browserCallback = getBrowserCallback();
      if (!window.desktopTurnstile && !browserCallback) {
        setError('Esta verificacao deve ser aberta pelo HappyCash Desktop.');
        return;
      }

      try {
        const token = await requestTurnstileToken(getRequestedAction(), {
          visible: Boolean(browserCallback),
        });
        if (!token) throw new Error('A verificacao de seguranca nao retornou um token valido.');
        if (!active) return;
        if (browserCallback) {
          browserCallback.callbackUrl.searchParams.set('state', browserCallback.state);
          browserCallback.callbackUrl.searchParams.set('token', token);
          window.location.replace(browserCallback.callbackUrl.toString());
          return;
        }
        window.desktopTurnstile?.complete(token);
      } catch (challengeError) {
        if (!active) return;
        const message = challengeError instanceof Error
          ? challengeError.message
          : 'Nao foi possivel concluir a verificacao de seguranca.';
        setError(message);
        if (browserCallback) {
          browserCallback.callbackUrl.searchParams.set('state', browserCallback.state);
          browserCallback.callbackUrl.searchParams.set('error', message.slice(0, 240));
          window.location.replace(browserCallback.callbackUrl.toString());
          return;
        }
        window.desktopTurnstile?.cancel(message);
      }
    };

    void runChallenge();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] p-6 text-foreground">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border border-yellow-400/20 bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-300">
          {error ? <ShieldCheck className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Verificacao de seguranca</h1>
          <p className="text-sm text-muted-foreground">
            {error || 'Validando este acesso para continuar no HappyCash Desktop...'}
          </p>
        </div>
      </section>
    </main>
  );
}
