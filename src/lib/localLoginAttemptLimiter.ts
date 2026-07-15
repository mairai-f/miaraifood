const LOCAL_LOGIN_ATTEMPTS_STORAGE_KEY = "happycash:local-login-attempts";
const DEFAULT_MAX_FAILED_ATTEMPTS = 3;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

type LocalLoginAttemptRecord = {
  count: number;
  lockedUntil: number;
  updatedAt: number;
};

type LocalLoginAttemptState = Record<string, LocalLoginAttemptRecord>;

type LocalLoginAttemptOptions = {
  namespace: string;
  ownerUserId: string;
  identifier: string;
  maxAttempts?: number;
  windowMs?: number;
};

const isBrowser = () => typeof window !== "undefined";

const normalizeSegment = (value: string) => value.trim().toLowerCase();

const buildAttemptKey = ({ namespace, ownerUserId, identifier }: LocalLoginAttemptOptions) =>
  [
    normalizeSegment(namespace),
    normalizeSegment(ownerUserId),
    normalizeSegment(identifier),
  ].join(":");

const getLimitConfig = (options: LocalLoginAttemptOptions) => ({
  maxAttempts: Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_MAX_FAILED_ATTEMPTS)),
  windowMs: Math.max(1_000, Math.floor(options.windowMs ?? DEFAULT_WINDOW_MS)),
});

const readState = (): LocalLoginAttemptState => {
  if (!isBrowser()) return {};

  try {
    const stored = window.localStorage.getItem(LOCAL_LOGIN_ATTEMPTS_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as LocalLoginAttemptState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeState = (state: LocalLoginAttemptState) => {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(LOCAL_LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Login should continue to work even if localStorage is temporarily unavailable.
  }
};

const buildBlockMessage = (maxAttempts: number) =>
  `Login bloqueado apos ${maxAttempts} tentativas incorretas. Aguarde alguns minutos e tente novamente.`;

export const getLocalLoginBlockMessage = (options: LocalLoginAttemptOptions) => {
  if (!options.ownerUserId || !options.identifier) return null;

  const state = readState();
  const key = buildAttemptKey(options);
  const current = state[key];
  if (!current) return null;

  const now = Date.now();
  if (current.lockedUntil > now) {
    return buildBlockMessage(getLimitConfig(options).maxAttempts);
  }

  if (current.lockedUntil || now - current.updatedAt > getLimitConfig(options).windowMs) {
    delete state[key];
    writeState(state);
  }

  return null;
};

export const recordLocalLoginFailure = (options: LocalLoginAttemptOptions) => {
  if (!options.ownerUserId || !options.identifier) return null;

  const { maxAttempts, windowMs } = getLimitConfig(options);
  const state = readState();
  const key = buildAttemptKey(options);
  const now = Date.now();
  const current = state[key];
  const shouldReset = !current || (current.lockedUntil <= now && now - current.updatedAt > windowMs);
  const count = shouldReset ? 1 : Math.min(maxAttempts, current.count + 1);
  const lockedUntil = count >= maxAttempts ? now + windowMs : 0;

  state[key] = {
    count,
    lockedUntil,
    updatedAt: now,
  };
  writeState(state);

  return lockedUntil > now ? buildBlockMessage(maxAttempts) : null;
};

export const clearLocalLoginFailures = (options: LocalLoginAttemptOptions) => {
  if (!options.ownerUserId || !options.identifier) return;

  const state = readState();
  const key = buildAttemptKey(options);
  if (!(key in state)) return;

  delete state[key];
  writeState(state);
};
