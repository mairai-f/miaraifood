type ScopedSignOutClient = {
  auth: {
    signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<unknown>;
  };
};

type SaveSiteLoginPreferencesOptions = {
  rememberAccount: boolean;
  keepConnected: boolean;
  email: string;
};

type SiteLoginPreferences = {
  rememberAccount: boolean;
  keepConnected: boolean;
  email: string;
};

const storageKeys = {
  rememberAccount: 'happycash:site:remember-account',
  keepConnected: 'happycash:site:keep-connected',
  rememberedEmail: 'happycash:site:remembered-email',
  temporarySession: 'happycash:site:temporary-session',
  temporarySessionActive: 'happycash:site:temporary-session-active',
} as const;

const isBrowser = () => typeof window !== 'undefined';

const readLocalStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const readBoolean = (key: string, fallback: boolean) => {
  const value = readLocalStorage(key);
  if (value === null) return fallback;
  return value === '1';
};

export const getSiteLoginPreferences = (): SiteLoginPreferences => ({
  rememberAccount: readBoolean(storageKeys.rememberAccount, true),
  keepConnected: readBoolean(storageKeys.keepConnected, true),
  email: readLocalStorage(storageKeys.rememberedEmail) ?? '',
});

export const saveSiteLoginPreferences = ({
  rememberAccount,
  keepConnected,
  email,
}: SaveSiteLoginPreferencesOptions) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(storageKeys.rememberAccount, rememberAccount ? '1' : '0');
  window.localStorage.setItem(storageKeys.keepConnected, keepConnected ? '1' : '0');

  if (rememberAccount && email.trim()) {
    window.localStorage.setItem(storageKeys.rememberedEmail, email.trim());
    return;
  }

  window.localStorage.removeItem(storageKeys.rememberedEmail);
};

export const applySiteSessionPreference = (keepConnected: boolean) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(storageKeys.keepConnected, keepConnected ? '1' : '0');

  if (keepConnected) {
    clearSiteTemporarySessionPreference();
    return;
  }

  window.localStorage.setItem(storageKeys.temporarySession, '1');
  window.sessionStorage.setItem(storageKeys.temporarySessionActive, '1');
};

export const clearSiteTemporarySessionPreference = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(storageKeys.temporarySession);
  window.sessionStorage.removeItem(storageKeys.temporarySessionActive);
};

export const enforceSiteSessionPreference = async (client: ScopedSignOutClient) => {
  if (!isBrowser()) return;

  const hasTemporarySession = window.localStorage.getItem(storageKeys.temporarySession) === '1';
  const currentSessionIsActive = window.sessionStorage.getItem(storageKeys.temporarySessionActive) === '1';

  if (!hasTemporarySession || currentSessionIsActive) return;

  clearSiteTemporarySessionPreference();
  await client.auth.signOut({ scope: 'local' });
};
