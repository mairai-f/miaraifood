type CorsOptions = {
  allowedHeaders?: string[];
  allowedMethods?: string[];
  allowOriginless?: boolean;
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:8085",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://localhost:4175",
  "https://happycash.vercel.app",
  "https://happycashsite.vercel.app",
  "https://www.happycashsite.com.br",
  "https://happycashsite.com.br",
  "https://app.happycashsite.com.br",
  "https://menu.happycashsite.com.br",
];

const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "accept-profile",
  "content-profile",
  "prefer",
  "x-region",
  "x-supabase-api-version",
];

const DEFAULT_ALLOWED_METHODS = ["POST", "OPTIONS"];

const getConfiguredOrigins = () => {
  const envValue = Deno.env.get("CORS_ALLOWED_ORIGINS") || "";
  const configured = envValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

export const getAllowedOrigins = () => getConfiguredOrigins();

export const isAllowedOriginValue = (origin: string | null, allowOriginless = true) =>
  isOriginAllowed(origin, allowOriginless);

const isOriginAllowed = (origin: string | null, allowOriginless: boolean) => {
  if (!origin) return allowOriginless;
  try {
    const parsed = new URL(origin);
    const isLocalDevelopmentOrigin =
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) &&
      ["http:", "https:"].includes(parsed.protocol);

    if (isLocalDevelopmentOrigin) return true;
  } catch {
    return false;
  }

  const allowedOrigins = getConfiguredOrigins();
  return allowedOrigins.has(origin);
};

export const buildCorsHeaders = (request: Request, options: CorsOptions = {}) => {
  const origin = request.headers.get("origin");
  const allowOriginless = options.allowOriginless ?? true;
  const allowed = isOriginAllowed(origin, allowOriginless);
  const allowedHeaders = options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
  const allowedMethods = options.allowedMethods ?? DEFAULT_ALLOWED_METHODS;

  const headers = new Headers({
    "Access-Control-Allow-Headers": allowedHeaders.join(", "),
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (origin && allowed) {
    headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin && allowOriginless) {
    headers.set("Access-Control-Allow-Origin", "null");
  }

  return { headers, allowed };
};

export const handleCorsPreflight = (request: Request, options: CorsOptions = {}) => {
  const { headers, allowed } = buildCorsHeaders(request, options);

  if (!allowed) {
    return new Response("Origin not allowed", {
      status: 403,
      headers,
    });
  }

  return new Response("ok", {
    status: 200,
    headers,
  });
};
