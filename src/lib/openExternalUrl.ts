const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const openExternalUrl = (url: string) => {
  if (typeof window === 'undefined') return false;

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

  if ('cordova' in window && typeof window.open === 'function') {
    window.open(parsedUrl.toString(), '_system', 'location=yes');
    return true;
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
