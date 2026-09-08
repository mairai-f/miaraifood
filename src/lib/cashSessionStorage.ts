const CASH_SESSION_STORAGE_KEY_PREFIX = 'happycash-pdv-cash-session';

export interface ScopedCashSession {
  id?: string;
  openedAt: string;
  openingAmount: number;
  openedBy: string;
  ownerUserId: string;
  operatorUserId: string;
  locationId?: string | null;
  terminalId?: string | null;
}

const getCashSessionStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.electronAPI ? window.localStorage : window.sessionStorage;
};

export const getScopedCashSessionStorageKey = (ownerUserId: string, operatorUserId: string) =>
  `${CASH_SESSION_STORAGE_KEY_PREFIX}:${ownerUserId}:${operatorUserId}`;

const isValidScopedCashSession = (
  value: unknown,
  ownerUserId: string,
  operatorUserId: string,
): value is ScopedCashSession => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ScopedCashSession>;
  return (
    typeof candidate.openedAt === 'string'
    && typeof candidate.openingAmount === 'number'
    && typeof candidate.openedBy === 'string'
    && candidate.ownerUserId === ownerUserId
    && candidate.operatorUserId === operatorUserId
  );
};

export const readScopedCashSession = (ownerUserId: string, operatorUserId: string): ScopedCashSession | null => {
  const storage = getCashSessionStorage();
  if (!storage) return null;

  try {
    const stored = storage.getItem(getScopedCashSessionStorageKey(ownerUserId, operatorUserId));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as unknown;
    return isValidScopedCashSession(parsed, ownerUserId, operatorUserId) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeScopedCashSession = (
  ownerUserId: string,
  operatorUserId: string,
  session: Omit<ScopedCashSession, 'ownerUserId' | 'operatorUserId'> | ScopedCashSession | null,
) => {
  const storage = getCashSessionStorage();
  if (!storage) return;

  try {
    const storageKey = getScopedCashSessionStorageKey(ownerUserId, operatorUserId);

    if (!session) {
      storage.removeItem(storageKey);
      return;
    }

    storage.setItem(storageKey, JSON.stringify({
      ...session,
      ownerUserId,
      operatorUserId,
    } satisfies ScopedCashSession));
  } catch {
    // Ignore local storage failures and keep the in-memory state.
  }
};
