export type SystemLoginMode = 'admin' | 'operator';

type ScopedSignOutClient = {
  auth: {
    signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<unknown>;
  };
};

type SaveSystemLoginPreferencesOptions = {
  loginMode: SystemLoginMode;
  rememberAccount: boolean;
  keepConnected: boolean;
  adminEmail: string;
  operatorUsername: string;
};

type SystemLoginPreferences = {
  loginMode: SystemLoginMode;
  rememberAccount: boolean;
  keepConnected: boolean;
  adminEmail: string;
  operatorUsername: string;
};

const storageKeys = {
  loginMode: 'happycash:system:last-login-mode',
  rememberAccount: 'happycash:system:remember-account',
  keepConnected: 'happycash:system:keep-connected',
  adminEmail: 'happycash:system:remembered-admin-email',
  operatorUsername: 'happycash:system:remembered-operator-username',
  temporarySession: 'happycash:system:temporary-session',
  temporarySessionActive: 'happycash:system:temporary-session-active',
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

export const getSystemLoginPreferences = (): SystemLoginPreferences => ({
  loginMode: readLocalStorage(storageKeys.loginMode) === 'operator' ? 'operator' : 'admin',
  rememberAccount: readBoolean(storageKeys.rememberAccount, false),
  keepConnected: readBoolean(storageKeys.keepConnected, false),
  adminEmail: readLocalStorage(storageKeys.adminEmail) ?? '',
  operatorUsername: readLocalStorage(storageKeys.operatorUsername) ?? '',
});

export const saveSystemLoginPreferences = ({
  loginMode,
  rememberAccount,
  keepConnected,
  adminEmail,
  operatorUsername,
}: SaveSystemLoginPreferencesOptions) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(storageKeys.loginMode, loginMode);
  window.localStorage.setItem(storageKeys.rememberAccount, rememberAccount ? '1' : '0');
  window.localStorage.setItem(storageKeys.keepConnected, keepConnected ? '1' : '0');

  if (rememberAccount) {
    const normalizedAdminEmail = adminEmail.trim();
    const normalizedOperatorUsername = operatorUsername.trim();

    if (normalizedAdminEmail) {
      window.localStorage.setItem(storageKeys.adminEmail, normalizedAdminEmail);
    } else {
      window.localStorage.removeItem(storageKeys.adminEmail);
    }

    if (normalizedOperatorUsername) {
      window.localStorage.setItem(storageKeys.operatorUsername, normalizedOperatorUsername);
    } else {
      window.localStorage.removeItem(storageKeys.operatorUsername);
    }
  } else {
    window.localStorage.removeItem(storageKeys.adminEmail);
    window.localStorage.removeItem(storageKeys.operatorUsername);
  }
};

export const applySystemSessionPreference = (keepConnected: boolean) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(storageKeys.keepConnected, keepConnected ? '1' : '0');

  if (keepConnected) {
    clearSystemTemporarySessionPreference();
    return;
  }

  window.localStorage.setItem(storageKeys.temporarySession, '1');
  window.sessionStorage.setItem(storageKeys.temporarySessionActive, '1');
};

export const clearSystemTemporarySessionPreference = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(storageKeys.temporarySession);
  window.sessionStorage.removeItem(storageKeys.temporarySessionActive);
};

export const enforceSystemSessionPreference = async (client: ScopedSignOutClient) => {
  if (!isBrowser()) return;

  const hasTemporarySession = window.localStorage.getItem(storageKeys.temporarySession) === '1';
  const currentSessionIsActive = window.sessionStorage.getItem(storageKeys.temporarySessionActive) === '1';

  if (!hasTemporarySession || currentSessionIsActive) return;

  clearSystemTemporarySessionPreference();
  await client.auth.signOut({ scope: 'local' });
};
