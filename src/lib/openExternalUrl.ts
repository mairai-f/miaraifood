const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const INTERNET_REQUIRED_MESSAGE = 'Conecte-se à internet para enviar mensagens. O modo offline continua funcionando para vendas, clientes, estoque e fiado.';

export const isInternetUnavailable = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

export const openExternalUrl = (url: string) => {
  if (typeof window === 'undefined') return false;
  if (isInternetUnavailable()) return false;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return false;
  }

  if (typeof window.electronAPI?.openExternal === 'function') {
    return window.electronAPI.openExternal(parsedUrl.toString());
  }

  const openedWindow = window.open(parsedUrl.toString(), '_blank', 'noopener,noreferrer');

  if (!openedWindow) {
    return false;
  }

  try {
    openedWindow.opener = null;
  } catch {
    // Some browsers do not expose opener on all window handles.
  }

  return true;
};
