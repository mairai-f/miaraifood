type RateLimitOptions = {
  namespace: string;
  identifier?: string | null;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  enabled: boolean;
  remaining: number | null;
  retryAfterSeconds: number | null;
};

const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
};

type RedisCommandResult = { result?: unknown; error?: string };

export const getRedisConfig = () => {
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL")?.replace(/\/+$/, "");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!redisUrl || !redisToken) return null;
  return { redisUrl, redisToken };
};

export const runRedisPipeline = async (
  config: { redisUrl: string; redisToken: string },
  commands: unknown[][],
) => {
  const response = await fetch(`${config.redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Redis unavailable: ${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body) ? body as RedisCommandResult[] : [body as RedisCommandResult];
};

export const extractClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip") ||
    request.headers.get("fly-client-ip") ||
    null
  );
};

const readNumberEnv = (name: string, fallback: number) => {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readRateLimitEnv = (name: string, fallback: number) => readNumberEnv(name, fallback);

export const checkRedisRateLimit = async (
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) {
    return { allowed: true, enabled: false, remaining: null, retryAfterSeconds: null };
  }

  const clientIp = extractClientIp(request) || "unknown";
  const scope = [clientIp, options.identifier || ""].join("|");
  const scopeHash = await sha256(scope);
  const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `happycash:rate:${options.namespace}:${windowId}:${scopeHash}`;

  try {
    const body = await runRedisPipeline(redisConfig, [
      ["INCR", key],
      ["EXPIRE", key, windowSeconds * 2],
    ]);
    const current = Number(body[0]?.result);
    if (!Number.isFinite(current)) {
      return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
    }

    const remaining = Math.max(0, options.limit - current);
    const allowed = current <= options.limit;
    const elapsedInWindow = Math.floor((Date.now() / 1000) % windowSeconds);
    const retryAfterSeconds = allowed ? null : Math.max(1, windowSeconds - elapsedInWindow);

    return { allowed, enabled: true, remaining, retryAfterSeconds };
  } catch (error) {
    console.warn("Rate limit check failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
  }
};

const buildRedisLoginAttemptKey = async (
  request: Request,
  options: Pick<RateLimitOptions, "namespace" | "identifier">,
) => {
  const clientIp = extractClientIp(request) || "unknown";
  const scopeHash = await sha256([clientIp, options.identifier || ""].join("|"));
  return `happycash:login:${options.namespace}:${scopeHash}`;
};

export const checkRedisLoginAttemptLimit = async (
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) {
    return { allowed: true, enabled: false, remaining: null, retryAfterSeconds: null };
  }

  const key = await buildRedisLoginAttemptKey(request, options);

  try {
    const body = await runRedisPipeline(redisConfig, [
      ["GET", key],
      ["TTL", key],
    ]);
    const current = Number(body[0]?.result || 0);
    const rawTtl = Number(body[1]?.result);
    const retryAfterSeconds = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : options.windowSeconds;
    const allowed = current < options.limit;
    const remaining = Math.max(0, options.limit - current);

    return {
      allowed,
      enabled: true,
      remaining,
      retryAfterSeconds: allowed ? null : retryAfterSeconds,
    };
  } catch (error) {
    console.warn("Login attempt limit check failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
  }
};

export const recordRedisLoginFailure = async (
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) {
    return { allowed: true, enabled: false, remaining: null, retryAfterSeconds: null };
  }

  const key = await buildRedisLoginAttemptKey(request, options);
  const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));

  try {
    const body = await runRedisPipeline(redisConfig, [
      ["INCR", key],
      ["EXPIRE", key, windowSeconds],
      ["TTL", key],
    ]);
    const current = Number(body[0]?.result);
    const rawTtl = Number(body[2]?.result);
    const retryAfterSeconds = Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : windowSeconds;

    if (!Number.isFinite(current)) {
      return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
    }

    const allowed = current < options.limit;

    return {
      allowed,
      enabled: true,
      remaining: Math.max(0, options.limit - current),
      retryAfterSeconds: allowed ? null : retryAfterSeconds,
    };
  } catch (error) {
    console.warn("Login failure record failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
  }
};

export const clearRedisLoginFailures = async (
  request: Request,
  options: Pick<RateLimitOptions, "namespace" | "identifier">,
) => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) return;

  try {
    const key = await buildRedisLoginAttemptKey(request, options);
    await runRedisPipeline(redisConfig, [["DEL", key]]);
  } catch (error) {
    console.warn("Login failure clear failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
};

type RedisLoginValueOptions = Pick<RateLimitOptions, "namespace" | "identifier"> & {
  value: string;
  windowSeconds: number;
};

export const writeRedisLoginValue = async (
  request: Request,
  options: RedisLoginValueOptions,
) => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) return false;

  try {
    const key = await buildRedisLoginAttemptKey(request, options);
    const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));
    await runRedisPipeline(redisConfig, [["SET", key, options.value, "EX", windowSeconds]]);
    return true;
  } catch (error) {
    console.warn("Login value write failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
};

export const readRedisLoginValue = async (
  request: Request,
  options: Pick<RateLimitOptions, "namespace" | "identifier">,
) => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) return null;

  try {
    const key = await buildRedisLoginAttemptKey(request, options);
    const body = await runRedisPipeline(redisConfig, [["GET", key]]);
    const value = body[0]?.result;
    return typeof value === "string" ? value : null;
  } catch (error) {
    console.warn("Login value read failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
};

export const clearRedisLoginValue = async (
  request: Request,
  options: Pick<RateLimitOptions, "namespace" | "identifier">,
) => {
  const redisConfig = getRedisConfig();

  if (!redisConfig) return;

  try {
    const key = await buildRedisLoginAttemptKey(request, options);
    await runRedisPipeline(redisConfig, [["DEL", key]]);
  } catch (error) {
    console.warn("Login value clear failed", {
      namespace: options.namespace,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
};
