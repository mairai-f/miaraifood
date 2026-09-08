import { isOperatorPin } from "../../shared/security/operatorCredential";

export type OfflineStaffRole = "operator" | "waiter";

export interface OfflineOperatorAccessRecord {
  version: 1;
  userId: string;
  ownerUserId: string;
  username: string;
  email: string | null;
  role: OfflineStaffRole;
  secretSalt: string;
  secretHash: string;
  secretKind: "password" | "pin";
  createdAt: string;
  updatedAt: string;
}

interface SaveOfflineOperatorAccessInput {
  userId: string;
  ownerUserId: string;
  username: string;
  email?: string | null;
  role?: OfflineStaffRole;
  secret: string;
}

const OFFLINE_OPERATOR_ACCESS_VERSION = 1;
const OFFLINE_OPERATOR_ACCESS_ITERATIONS = 120_000;
const OFFLINE_OPERATOR_ACCESS_STORAGE_PREFIX = "happycash:desktop:offline-operator";
const OFFLINE_OPERATOR_USERNAME_PATTERN = /^[a-z0-9._-]{3,24}$/;

const isBrowser = () => typeof window !== "undefined";

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

export const normalizeOfflineOperatorUsername = (value: string) => value.trim().toLowerCase();

export const isValidOfflineOperatorUsername = (value: string) =>
  OFFLINE_OPERATOR_USERNAME_PATTERN.test(normalizeOfflineOperatorUsername(value));

const normalizeOfflineStaffRole = (value: string | null | undefined): OfflineStaffRole =>
  value === "waiter" ? "waiter" : "operator";

const getStorageKey = (ownerUserId: string, username: string) =>
  `${OFFLINE_OPERATOR_ACCESS_STORAGE_PREFIX}:${ownerUserId}:${normalizeOfflineOperatorUsername(username)}`;

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

const deriveSecretHash = async (secret: string, salt: string) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: fromBase64(salt),
      iterations: OFFLINE_OPERATOR_ACCESS_ITERATIONS,
    },
    keyMaterial,
    256,
  );

  return toBase64(new Uint8Array(derivedBits));
};

export const readOfflineOperatorAccess = (ownerUserId: string, username: string) => {
  if (!isBrowser() || !ownerUserId || !username) return null;

  try {
    const stored = window.localStorage.getItem(getStorageKey(ownerUserId, username));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as OfflineOperatorAccessRecord;
    if (
      parsed.version !== OFFLINE_OPERATOR_ACCESS_VERSION
      || !parsed.userId
      || !parsed.ownerUserId
      || !parsed.username
      || !parsed.secretSalt
      || !parsed.secretHash
    ) {
      return null;
    }

    return {
      ...parsed,
      username: normalizeOfflineOperatorUsername(parsed.username),
      email: parsed.email ?? null,
      role: normalizeOfflineStaffRole(parsed.role),
      secretKind: parsed.secretKind === "pin" ? "pin" : "password",
    } satisfies OfflineOperatorAccessRecord;
  } catch {
    return null;
  }
};

export const deleteOfflineOperatorAccess = (ownerUserId: string, username: string) => {
  if (!isBrowser() || !ownerUserId || !username) return;

  try {
    window.localStorage.removeItem(getStorageKey(ownerUserId, username));
  } catch {
    // Local cleanup should never block online access handling.
  }
};

export const saveOfflineOperatorAccess = async ({
  userId,
  ownerUserId,
  username,
  email = null,
  role = "operator",
  secret,
}: SaveOfflineOperatorAccessInput) => {
  if (!isBrowser()) {
    throw new Error("O acesso offline do operador so pode ser configurado no navegador.");
  }

  const normalizedUsername = normalizeOfflineOperatorUsername(username);
  const normalizedSecret = secret.trim();

  if (!userId || !ownerUserId) {
    throw new Error("Nao foi possivel identificar o operador desta loja.");
  }

  if (!isValidOfflineOperatorUsername(normalizedUsername)) {
    throw new Error("Usuario do operador invalido.");
  }

  if (!normalizedSecret) {
    throw new Error("A senha ou PIN do operador nao pode ficar vazia.");
  }

  const current = readOfflineOperatorAccess(ownerUserId, normalizedUsername);
  const salt = current?.secretSalt || createSalt();
  const secretHash = await deriveSecretHash(normalizedSecret, salt);
  const now = new Date().toISOString();

  const record: OfflineOperatorAccessRecord = {
    version: OFFLINE_OPERATOR_ACCESS_VERSION,
    userId,
    ownerUserId,
    username: normalizedUsername,
    email: email?.trim() || null,
    role: normalizeOfflineStaffRole(role),
    secretSalt: salt,
    secretHash,
    secretKind: isOperatorPin(normalizedSecret) ? "pin" : "password",
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };

  window.localStorage.setItem(getStorageKey(ownerUserId, normalizedUsername), JSON.stringify(record));
  return record;
};

export const verifyOfflineOperatorAccess = async (payload: {
  ownerUserId: string;
  username: string;
  secret: string;
}) => {
  const normalizedUsername = normalizeOfflineOperatorUsername(payload.username);
  const normalizedSecret = payload.secret.trim();

  if (!isValidOfflineOperatorUsername(normalizedUsername) || !normalizedSecret) {
    return {
      success: false as const,
      error: "Usuario ou PIN/senha incorretos.",
    };
  }

  const record = readOfflineOperatorAccess(payload.ownerUserId, normalizedUsername);
  if (!record) {
    return {
      success: false as const,
      error: "Este operador ainda nao fez um primeiro login online nesta maquina. Conecte a internet e entre uma vez para liberar o offline.",
    };
  }

  const secretHash = await deriveSecretHash(normalizedSecret, record.secretSalt);
  if (!constantTimeEqual(record.secretHash, secretHash)) {
    return {
      success: false as const,
      error: "Usuario ou PIN/senha incorretos.",
    };
  }

  return {
    success: true as const,
    record,
  };
};
