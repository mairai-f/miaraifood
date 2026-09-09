const crypto = require('node:crypto');
const http = require('node:http');

const normalizeAction = (value) => {
  const normalized = String(value || 'desktop-auth')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 32);
  return normalized || 'desktop-auth';
};

const buildChallengeUrl = ({ action, appOrigin, callbackUrl, state }) => {
  const url = new URL('/desktop-turnstile', appOrigin);
  if (url.protocol !== 'https:') {
    throw new Error('A verificacao do Desktop exige o dominio HTTPS oficial do MIAR AI/FOOD.');
  }
  url.searchParams.set('action', normalizeAction(action));
  url.searchParams.set('callback', callbackUrl);
  url.searchParams.set('state', state);
  return url.toString();
};

const matchesState = (receivedState, expectedState) => {
  const received = Buffer.from(String(receivedState || ''));
  const expected = Buffer.from(expectedState);
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

const responsePage = (kind) => {
  if (kind === 'success') {
    return '<!doctype html><meta charset="utf-8"><title>MIAR AI/FOOD</title><body style="font-family:system-ui;background:#050505;color:#fff;text-align:center;padding:64px"><h1>Verificacao concluida</h1><p>Volte ao MIAR AI/FOOD. Esta aba ja pode ser fechada.</p></body>';
  }
  if (kind === 'failure') {
    return '<!doctype html><meta charset="utf-8"><title>MIAR AI/FOOD</title><body style="font-family:system-ui;background:#050505;color:#fff;text-align:center;padding:64px"><h1>Verificacao nao concluida</h1><p>Volte ao MIAR AI/FOOD e tente novamente.</p></body>';
  }
  return '<!doctype html><meta charset="utf-8"><title>MIAR AI/FOOD</title><body style="font-family:system-ui;background:#050505;color:#fff;text-align:center;padding:64px"><h1>Retorno invalido</h1><p>Feche esta aba e tente novamente pelo MIAR AI/FOOD.</p></body>';
};

const requestDesktopTurnstileToken = ({
  action,
  appOrigin,
  openExternal,
  timeoutMs = 130_000,
}) => new Promise((resolve) => {
  let settled = false;
  let timeoutId;
  const state = crypto.randomBytes(32).toString('base64url');
  const server = http.createServer();

  const finish = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    if (server.listening) server.close();
    resolve(result);
  };

  server.on('request', (request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (request.method !== 'GET' || requestUrl.pathname !== '/turnstile-callback') {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }

    const receivedState = requestUrl.searchParams.get('state');
    const token = requestUrl.searchParams.get('token')?.trim() || '';
    const error = requestUrl.searchParams.get('error')?.trim() || '';
    const stateMatches = matchesState(receivedState, state);
    const tokenIsValid = token.length >= 10 && token.length <= 4096;

    response.statusCode = stateMatches ? 200 : 400;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(responsePage(!stateMatches ? 'invalid' : error || !tokenIsValid ? 'failure' : 'success'));

    if (!stateMatches) return;
    if (error) {
      finish({ success: false, error: error.slice(0, 240) });
      return;
    }
    if (!tokenIsValid) {
      finish({ success: false, error: 'A verificacao de seguranca retornou um token invalido.' });
      return;
    }
    finish({ success: true, token });
  });

  server.once('error', (error) => {
    finish({
      success: false,
      error: error instanceof Error
        ? `Nao foi possivel preparar o retorno seguro: ${error.message}`
        : 'Nao foi possivel preparar o retorno seguro da verificacao.',
    });
  });

  timeoutId = setTimeout(() => {
    finish({ success: false, error: 'A verificacao de seguranca expirou. Tente novamente.' });
  }, timeoutMs);

  server.listen(0, '127.0.0.1', async () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      finish({ success: false, error: 'Nao foi possivel preparar o retorno seguro da verificacao.' });
      return;
    }

    const callbackUrl = `http://127.0.0.1:${address.port}/turnstile-callback`;
    try {
      const challengeUrl = buildChallengeUrl({ action, appOrigin, callbackUrl, state });
      await openExternal(challengeUrl);
    } catch (error) {
      finish({
        success: false,
        error: error instanceof Error ? error.message : 'Nao foi possivel abrir a verificacao de seguranca.',
      });
    }
  });
});

module.exports = {
  buildChallengeUrl,
  requestDesktopTurnstileToken,
};
