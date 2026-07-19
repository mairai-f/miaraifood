const STORE_DATA_CACHE_VERSION = 1;
const STORE_DATA_CACHE_PREFIX = `happycash:store-data-cache:v${STORE_DATA_CACHE_VERSION}`;

type StoreDataCacheKeyParts = {
  ownerUserId: string;
  userId: string;
  scopeKey: string;
  module: string;
};

type StoreDataCacheEntry<T> = StoreDataCacheKeyParts & {
  version: number;
  signature: string;
  savedAt: string;
  data: T;
};

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const normalizeSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const buildStoreDataScopeKey = (locationId: string | null | undefined) =>
  `location:${normalizeSegment(locationId || 'all')}`;

const buildStoreDataCacheKey = ({ ownerUserId, userId, scopeKey, module }: StoreDataCacheKeyParts) => [
  STORE_DATA_CACHE_PREFIX,
  normalizeSegment(ownerUserId),
  normalizeSegment(userId),
  normalizeSegment(scopeKey),
  normalizeSegment(module),
].join(':');

export const readStoreDataModuleCache = <T>(
  keyParts: StoreDataCacheKeyParts & { signature: string | null | undefined },
): T | null => {
  if (!isBrowser() || !keyParts.ownerUserId || !keyParts.userId || !keyParts.signature) return null;

  try {
    const rawValue = window.localStorage.getItem(buildStoreDataCacheKey(keyParts));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<StoreDataCacheEntry<T>>;
    if (
      parsed.version !== STORE_DATA_CACHE_VERSION
      || parsed.ownerUserId !== keyParts.ownerUserId
      || parsed.userId !== keyParts.userId
      || parsed.scopeKey !== keyParts.scopeKey
      || parsed.module !== keyParts.module
      || parsed.signature !== keyParts.signature
      || parsed.data === undefined
    ) {
      return null;
    }

    return parsed.data as T;
  } catch {
    return null;
  }
};

export const readLatestStoreDataModuleCache = <T>(
  keyParts: StoreDataCacheKeyParts,
): T | null => {
  if (!isBrowser() || !keyParts.ownerUserId || !keyParts.userId) return null;

  try {
    const rawValue = window.localStorage.getItem(buildStoreDataCacheKey(keyParts));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<StoreDataCacheEntry<T>>;
    if (
      parsed.version !== STORE_DATA_CACHE_VERSION
      || parsed.ownerUserId !== keyParts.ownerUserId
      || parsed.userId !== keyParts.userId
      || parsed.scopeKey !== keyParts.scopeKey
      || parsed.module !== keyParts.module
      || parsed.data === undefined
    ) {
      return null;
    }

    return parsed.data as T;
  } catch {
    return null;
  }
};

export const writeStoreDataModuleCache = <T>(
  keyParts: StoreDataCacheKeyParts & { signature: string | null | undefined; data: T },
) => {
  if (!isBrowser() || !keyParts.ownerUserId || !keyParts.userId) return;

  try {
    const entry: StoreDataCacheEntry<T> = {
      version: STORE_DATA_CACHE_VERSION,
      ownerUserId: keyParts.ownerUserId,
      userId: keyParts.userId,
      scopeKey: keyParts.scopeKey,
      module: keyParts.module,
      signature: keyParts.signature || 'latest',
      savedAt: new Date().toISOString(),
      data: keyParts.data,
    };
    window.localStorage.setItem(buildStoreDataCacheKey(keyParts), JSON.stringify(entry));
  } catch {
    // Cache is best-effort; login and sales must keep working if storage is full or blocked.
  }
};
