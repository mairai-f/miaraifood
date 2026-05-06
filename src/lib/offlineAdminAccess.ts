export interface OfflineAdminAccessRecord {
  version: 1;
  userId: string;
  ownerUserId: string;
  username: string;
  email: string | null;
  pinSalt: string;
  pinHash: string;
  createdAt: string;
  updatedAt: string;
}

interface SaveOfflineAdminAccessInput {
  userId: string;
  ownerUserId: string;
  username: string;
  email?: string | null;
  pin: string;
}

const OFFLINE_ADMIN_ACCESS_VERSION = 1;
const OFFLINE_ADMIN_ACCESS_ITERATIONS = 120_000;
const OFFLINE_ADMIN_ACCESS_STORAGE_PREFIX = 'happycash:desktop:offline-admin';
const OFFLINE_ADMIN_USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
const OFFLINE_ADMIN_PIN_PATTERN = /^\d{4,8}$/;

const isBrowser = () => typeof window !== 'undefined';

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const getStorageKey = (ownerUserId: string) => `${OFFLINE_ADMIN_ACCESS_STORAGE_PREFIX}:${ownerUserId}`;

const createSalt = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
};

const constantTimeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
};

const derivePinHash = async (pin: string, salt: string) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(salt),
      iterations: OFFLINE_ADMIN_ACCESS_ITERATIONS,
    },
    keyMaterial,
    256,
  );

  return toBase64(new Uint8Array(derivedBits));
};

export const normalizeOfflineAdminUsername = (value: string) => value.trim().toLowerCase();

export const isValidOfflineAdminUsername = (value: string) =>
  OFFLINE_ADMIN_USERNAME_PATTERN.test(normalizeOfflineAdminUsername(value));

export const isValidOfflineAdminPin = (value: string) => OFFLINE_ADMIN_PIN_PATTERN.test(value.trim());

export const offlineAdminUsernameHelpText =
  'Use de 3 a 32 caracteres com letras, numeros, ponto, traco ou underline.';

export const offlineAdminPinHelpText = 'Use um PIN de 4 a 8 digitos.';

export const readOfflineAdminAccess = (ownerUserId: string) => {
  if (!isBrowser() || !ownerUserId) return null;

  try {
    const stored = window.localStorage.getItem(getStorageKey(ownerUserId));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as OfflineAdminAccessRecord;
    if (
      parsed.version !== OFFLINE_ADMIN_ACCESS_VERSION
      || !parsed.userId
      || !parsed.ownerUserId
      || !parsed.username
      || !parsed.pinSalt
      || !parsed.pinHash
    ) {
      return null;
    }

    return {
      ...parsed,
      username: normalizeOfflineAdminUsername(parsed.username),
      email: parsed.email ?? null,
    } satisfies OfflineAdminAccessRecord;
  } catch {
    return null;
  }
};

export const hasOfflineAdminAccess = (ownerUserId: string) => Boolean(readOfflineAdminAccess(ownerUserId));

export const clearOfflineAdminAccess = (ownerUserId: string) => {
  if (!isBrowser() || !ownerUserId) return;
  window.localStorage.removeItem(getStorageKey(ownerUserId));
};

export const saveOfflineAdminAccess = async ({
  userId,
  ownerUserId,
  username,
  email = null,
  pin,
}: SaveOfflineAdminAccessInput) => {
  if (!isBrowser()) {
    throw new Error('O acesso offline do administrador so pode ser configurado no navegador.');
  }

  const normalizedUsername = normalizeOfflineAdminUsername(username);
  const normalizedPin = pin.trim();

  if (!userId || !ownerUserId) {
    throw new Error('Nao foi possivel identificar o administrador desta loja.');
  }

  if (!isValidOfflineAdminUsername(normalizedUsername)) {
    throw new Error(offlineAdminUsernameHelpText);
  }

  if (!isValidOfflineAdminPin(normalizedPin)) {
    throw new Error(offlineAdminPinHelpText);
  }

  const current = readOfflineAdminAccess(ownerUserId);
  const salt = current?.pinSalt || createSalt();
  const pinHash = await derivePinHash(normalizedPin, salt);
  const now = new Date().toISOString();

  const record: OfflineAdminAccessRecord = {
    version: OFFLINE_ADMIN_ACCESS_VERSION,
    userId,
    ownerUserId,
    username: normalizedUsername,
    email: email?.trim() || null,
    pinSalt: salt,
    pinHash,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  window.localStorage.setItem(getStorageKey(ownerUserId), JSON.stringify(record));
  return record;
};

export const verifyOfflineAdminAccess = async (payload: {
  ownerUserId: string;
  username: string;
  pin: string;
}) => {
  const record = readOfflineAdminAccess(payload.ownerUserId);
  if (!record) {
    return {
      success: false as const,
      error: 'O acesso offline deste administrador ainda nao foi configurado nesta maquina.',
    };
  }

  const normalizedUsername = normalizeOfflineAdminUsername(payload.username);
  const normalizedPin = payload.pin.trim();

  if (!isValidOfflineAdminUsername(normalizedUsername) || !isValidOfflineAdminPin(normalizedPin)) {
    return {
      success: false as const,
      error: 'Usuario admin ou PIN incorretos.',
    };
  }

  if (record.username !== normalizedUsername) {
    return {
      success: false as const,
      error: 'Usuario admin ou PIN incorretos.',
    };
  }

  const pinHash = await derivePinHash(normalizedPin, record.pinSalt);
  if (!constantTimeEqual(record.pinHash, pinHash)) {
    return {
      success: false as const,
      error: 'Usuario admin ou PIN incorretos.',
    };
  }

  return {
    success: true as const,
    record,
  };
};
