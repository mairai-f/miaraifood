type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const noopStorage: BrowserStorageLike = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const isBrowser = () => typeof window !== "undefined";

export const getLocalStorageSafe = (): BrowserStorageLike => {
  if (!isBrowser()) return noopStorage;
  try {
    return window.localStorage;
  } catch {
    return noopStorage;
  }
};

export const getSessionStorageSafe = (): BrowserStorageLike => {
  if (!isBrowser()) return noopStorage;
  try {
    return window.sessionStorage;
  } catch {
    return noopStorage;
  }
};

export const createAdaptiveStorage = (
  shouldPersist: () => boolean,
): BrowserStorageLike => {
  const local = getLocalStorageSafe();
  const session = getSessionStorageSafe();

  const getPreferredStorage = () => (shouldPersist() ? local : session);
  const getSecondaryStorage = () => (shouldPersist() ? session : local);

  return {
    getItem(key) {
      const preferred = getPreferredStorage();
      const secondary = getSecondaryStorage();
      const preferredValue = preferred.getItem(key);

      if (preferredValue !== null) return preferredValue;

      // Only migrate from session to local when the user explicitly chose persistent login.
      if (shouldPersist()) {
        const fallbackValue = secondary.getItem(key);
        if (fallbackValue !== null) {
          preferred.setItem(key, fallbackValue);
          secondary.removeItem(key);
        }
        return fallbackValue;
      }

      return null;
    },
    setItem(key, value) {
      const preferred = getPreferredStorage();
      const secondary = getSecondaryStorage();
      preferred.setItem(key, value);
      secondary.removeItem(key);
    },
    removeItem(key) {
      local.removeItem(key);
      session.removeItem(key);
    },
  };
};
