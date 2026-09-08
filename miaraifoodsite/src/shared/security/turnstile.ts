const TURNSTILE_SCRIPT_ID = 'miaraifood-cloudflare-turnstile';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_TIMEOUT_MS = 120_000;

interface TurnstileRenderOptions {
  sitekey: string;
  action: string;
  appearance: 'interaction-only' | 'always';
  execution: 'execute' | 'render';
  theme: 'auto';
  size: 'flexible';
  callback: (token: string) => void;
  'error-callback': (errorCode: string | number) => boolean;
  'expired-callback': () => void;
  'timeout-callback': () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    electronAPI?: any;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

export const getTurnstileSiteKey = () =>
  String(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();

export const isTurnstileConfigured = () => Boolean(getTurnstileSiteKey());

const loadTurnstile = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('A verificacao de seguranca esta disponivel somente no navegador.'));
  }

  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    let checksRemaining = 200;

    const resolveWhenReady = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      checksRemaining -= 1;
      if (checksRemaining <= 0) {
        scriptPromise = null;
        reject(new Error('A verificacao de seguranca demorou para carregar. Tente novamente.'));
        return;
      }

      window.setTimeout(resolveWhenReady, 50);
    };

    script.addEventListener('load', resolveWhenReady, { once: true });
    script.addEventListener('error', () => {
      scriptPromise = null;
      reject(new Error('Nao foi possivel carregar a verificacao de seguranca.'));
    }, { once: true });

    if (!existingScript) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      resolveWhenReady();
    }
  });

  return scriptPromise;
};

const normalizeAction = (action: string) => {
  const normalized = action.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
  return normalized || 'auth';
};

interface TurnstileRequestOptions {
  visible?: boolean;
}

export const requestTurnstileToken = async (
  action: string,
  options: TurnstileRequestOptions = {},
): Promise<string | undefined> => {
  if (typeof window !== 'undefined' && window.electronAPI?.turnstile?.requestToken) {
    const result = await window.electronAPI.turnstile.requestToken(normalizeAction(action));
    if (result.success && result.token) return result.token;
    throw new Error(result.error || 'Nao foi possivel concluir a verificacao de seguranca no Desktop.');
  }

  const sitekey = getTurnstileSiteKey();
  if (!sitekey) return undefined;

  if (
    typeof window === 'undefined'
    || !/^https?:$/.test(window.location.protocol)
    || !window.isSecureContext
  ) {
    // Runtimes sem origem HTTPS nao conseguem executar o widget web.
    return undefined;
  }

  const turnstile = await loadTurnstile();
  const container = document.createElement('div');
  container.setAttribute('aria-label', 'Verificacao de seguranca');
  Object.assign(container.style, {
    position: 'fixed',
    right: '16px',
    bottom: '16px',
    width: 'min(320px, calc(100vw - 32px))',
    zIndex: '2147483647',
  });
  document.body.appendChild(container);

  return new Promise<string>((resolve, reject) => {
    let widgetId = '';
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      if (widgetId) {
        try {
          turnstile.remove(widgetId);
        } catch {
          // The widget may already have removed itself after navigation.
        }
      }
      container.remove();
    };

    const finish = (token?: string, errorMessage?: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (token) {
        resolve(token);
      } else {
        reject(new Error(errorMessage || 'Nao foi possivel concluir a verificacao de seguranca.'));
      }
    };

    const timeoutId = window.setTimeout(() => {
      finish(undefined, 'A verificacao de seguranca expirou. Tente novamente.');
    }, TURNSTILE_TIMEOUT_MS);

    const execution = options.visible ? 'render' : 'execute';
    widgetId = turnstile.render(container, {
      sitekey,
      action: normalizeAction(action),
      appearance: options.visible ? 'always' : 'interaction-only',
      execution,
      theme: 'auto',
      size: 'flexible',
      callback: token => finish(token),
      'error-callback': errorCode => {
        finish(undefined, `Falha na verificacao de seguranca (codigo ${String(errorCode)}). Tente novamente.`);
        return true;
      },
      'expired-callback': () => finish(undefined, 'A verificacao de seguranca expirou. Tente novamente.'),
      'timeout-callback': () => finish(undefined, 'A verificacao de seguranca expirou. Tente novamente.'),
    });

    if (execution === 'execute') turnstile.execute(widgetId);
  });
};
