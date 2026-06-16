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

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toHex(new Uint8Array(digest));
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
  const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL")?.replace(/\/+$/, "");
  const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

  if (!redisUrl || !redisToken) {
    return { allowed: true, enabled: false, remaining: null, retryAfterSeconds: null };
  }

  const clientIp = extractClientIp(request) || "unknown";
  const scope = [clientIp, options.identifier || ""].join("|");
  const scopeHash = await sha256(scope);
  const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `happycash:rate:${options.namespace}:${windowId}:${scopeHash}`;

  try {
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds * 2],
      ]),
    });

    if (!response.ok) {
      console.warn("Rate limit Redis unavailable", { namespace: options.namespace, status: response.status });
      return { allowed: true, enabled: true, remaining: null, retryAfterSeconds: null };
    }

    const body = await response.json();
    const current = Number(Array.isArray(body) ? body[0]?.result : body?.result);
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
