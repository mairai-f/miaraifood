export type StoreLocationType = 'headquarters' | 'branch' | 'warehouse';
export type PosTerminalType = 'desktop' | 'web' | 'mobile' | 'totem';

export interface OperationalLocation {
  id: string;
  code: string;
  name: string;
  locationType: StoreLocationType;
  isHeadquarters: boolean;
}

export interface OperationalTerminal {
  id: string;
  locationId: string;
  code: string;
  name: string;
  terminalType: PosTerminalType;
}

export interface OperationalScope {
  location: OperationalLocation;
  terminal: OperationalTerminal | null;
}

export const storeLocationTypeLabels: Record<StoreLocationType, string> = {
  headquarters: 'Matriz',
  branch: 'Filial',
  warehouse: 'Deposito',
};

export const posTerminalTypeLabels: Record<PosTerminalType, string> = {
  desktop: 'Desktop',
  web: 'Web',
  mobile: 'Mobile',
  totem: 'Totem',
};

/** Gera codigos previsiveis para integracoes e importacoes futuras. */
export const normalizeStoreScopeCode = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 32);

export const isValidStoreScopeCode = (value: string) =>
  /^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(value);

const operationalScopeCachePrefix = 'happycash:operational-scope';

export const getOperationalScopeCacheKey = (
  ownerUserId: string,
  userId: string,
  runtime: 'web' | 'desktop',
) => `${operationalScopeCachePrefix}:${ownerUserId}:${userId}:${runtime}`;

export const readOperationalScopeCache = (
  ownerUserId: string,
  userId: string,
  runtime: 'web' | 'desktop',
): OperationalScope | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawValue = window.localStorage.getItem(getOperationalScopeCacheKey(ownerUserId, userId, runtime));
    return rawValue ? JSON.parse(rawValue) as OperationalScope : null;
  } catch {
    return null;
  }
};

export const writeOperationalScopeCache = (
  ownerUserId: string,
  userId: string,
  runtime: 'web' | 'desktop',
  scope: OperationalScope,
) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getOperationalScopeCacheKey(ownerUserId, userId, runtime),
      JSON.stringify(scope),
    );
  } catch {
    // O escopo continua valido em memoria quando o armazenamento estiver indisponivel.
  }
};
