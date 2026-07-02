import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { requestTurnstileToken } from '../../shared/security/turnstile';

const getRequestedAction = () => {
  const value = new URLSearchParams(window.location.search).get('action') ?? 'desktop-auth';
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32) || 'desktop-auth';
};

export default function DesktopTurnstileChallenge() {
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const runChallenge = async () => {
      if (!window.desktopTurnstile) {
        setError('Esta verificacao deve ser aberta pelo HappyCash Desktop.');
        return;
      }

      try {
        const token = await requestTurnstileToken(getRequestedAction());
        if (!token) throw new Error('A verificacao de seguranca nao retornou um token valido.');
        if (!active) return;
        window.desktopTurnstile.complete(token);
      } catch (challengeError) {
        if (!active) return;
        const message = challengeError instanceof Error
          ? challengeError.message
          : 'Nao foi possivel concluir a verificacao de seguranca.';
        setError(message);
        window.desktopTurnstile.cancel(message);
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
