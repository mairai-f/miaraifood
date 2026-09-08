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
  auth: 'miaraifood:site:auth',
  rememberAccount: 'miaraifood:site:remember-account',
  keepConnected: 'miaraifood:site:keep-connected',
  rememberedEmail: 'miaraifood:site:remembered-email',
  temporarySession: 'miaraifood:site:temporary-session',
  temporarySessionActive: 'miaraifood:site:temporary-session-active',
} as const;

const SIGN_OUT_TIMEOUT_MS = 1800;

const isBrowser = () => typeof window !== 'undefined';

const clearSiteRememberedIdentifiers = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(storageKeys.rememberedEmail);
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const readLocalStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const readBoolean = (key: string, fallback: boolean) => {
  const value = readLocalStorage(key);
  if (value === null) return fallback;
  return value === '1';
};

export const getSiteLoginPreferences = (): SiteLoginPreferences => {
  clearSiteRememberedIdentifiers();

  return {
    rememberAccount: readBoolean(storageKeys.rememberAccount, false),
    keepConnected: readBoolean(storageKeys.keepConnected, false),
    email: '',
  };
};

export const saveSiteLoginPreferences = ({
  rememberAccount,
  keepConnected,
  email,
}: SaveSiteLoginPreferencesOptions) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(storageKeys.rememberAccount, rememberAccount ? '1' : '0');
  window.localStorage.setItem(storageKeys.keepConnected, keepConnected ? '1' : '0');
  void email;
  clearSiteRememberedIdentifiers();
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

export const clearSiteStoredAuth = () => {
  if (!isBrowser()) return;

  const removeAuthKeys = (storage: Storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];

    keys.forEach((key) => {
      if (key === storageKeys.auth || key.startsWith(`${storageKeys.auth}-`)) {
        storage.removeItem(key);
      }
    });
  };

  removeAuthKeys(window.localStorage);
  removeAuthKeys(window.sessionStorage);
  clearSiteTemporarySessionPreference();
};

export const clearSiteLocalSession = async (client?: ScopedSignOutClient) => {
  clearSiteStoredAuth();

  if (!client) return;

  try {
    await withTimeout(client.auth.signOut({ scope: 'local' }), SIGN_OUT_TIMEOUT_MS);
  } catch {
    // Ignore sign-out errors because the local storage cleanup is enough
    // to prevent stale sessions from looping in the dashboard.
  }
};

export const startSiteLogout = async (client: ScopedSignOutClient, loginPath = '/') => {
  if (!isBrowser()) return;

  clearSiteStoredAuth();
  try {
    await withTimeout(client.auth.signOut(), SIGN_OUT_TIMEOUT_MS);
  } catch (error) {
    console.error('Logout error:', error);
  }
  window.location.replace(loginPath);
};

export const enforceSiteSessionPreference = async (client: ScopedSignOutClient) => {
  if (!isBrowser()) return;

  const hasTemporarySession = window.localStorage.getItem(storageKeys.temporarySession) === '1';
  const currentSessionIsActive = window.sessionStorage.getItem(storageKeys.temporarySessionActive) === '1';

  if (!hasTemporarySession || currentSessionIsActive) return;

  clearSiteTemporarySessionPreference();
  await client.auth.signOut({ scope: 'local' });
};
