const isBrowser = () => typeof window !== 'undefined';

const LEGACY_AUTH_PATTERNS = [
  /^sb-[a-z0-9_-]+-auth-token$/i,
  /^supabase\.auth\.token$/i,
];

const matchesStorageKey = (key: string, storageKey: string) =>
  key === storageKey || key.startsWith(`${storageKey}-`);

export const cleanupLegacySupabaseAuthStorage = (
  currentStorageKey: string,
  legacyStorageKeys: string[] = [],
) => {
  if (!isBrowser()) return;

  const cleanupStorage = (storage: Storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];

    keys.forEach((key) => {
      if (matchesStorageKey(key, currentStorageKey)) {
        return;
      }

      if (legacyStorageKeys.some((legacyKey) => matchesStorageKey(key, legacyKey))) {
        storage.removeItem(key);
        return;
      }

      if (LEGACY_AUTH_PATTERNS.some((pattern) => pattern.test(key))) {
        storage.removeItem(key);
      }
    });
  };

  cleanupStorage(window.localStorage);
  cleanupStorage(window.sessionStorage);
};
