const SENSITIVE_KEY_PATTERN = /(password|senha|secret|token|hash|salt|apikey|api_key|authorization|auth|jwt|key|chave|pin|license|licen[cç]a|credential|credencial|service_role|mount)/i;
const SENSITIVE_TEXT_PATTERN = /(service_role|authorization|bearer\s+|jwt|password|senha|secret|token|hash|salt|apikey|api[_-]?key|access[_-]?token|refresh[_-]?token|private\s+key|license|licen[cç]a|chave|credential|credencial|mount)/i;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const LONG_SECRET_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

const REDACTED = "[redigido]";

export const isSensitiveKey = (key: string) => SENSITIVE_KEY_PATTERN.test(key);

export const redactSensitiveText = (value: string) =>
  value
    .replace(JWT_PATTERN, REDACTED)
    .replace(LONG_SECRET_PATTERN, (match) => (SENSITIVE_TEXT_PATTERN.test(value) ? REDACTED : match));

export const redactSensitiveData = (value: unknown, parentKey = "", seen = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;
  if (isSensitiveKey(parentKey)) return REDACTED;
  if (typeof value === "string") return redactSensitiveText(value);
  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, parentKey, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      redactSensitiveData(item, key, seen),
    ]),
  );
};

export const formatRedactedJson = (value: unknown) =>
  JSON.stringify(redactSensitiveData(value), null, 2);

export const getPublicErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : "";

  const normalized = message.trim();
  if (!normalized || SENSITIVE_TEXT_PATTERN.test(normalized)) return fallbackMessage;
  return redactSensitiveText(normalized);
};

export const getRedactedLogValue = (value: unknown) => redactSensitiveData(value);

export const maskEmail = (value: string | null | undefined) => {
  const email = value?.trim();
  if (!email) return "";
  const [user = "", domain = ""] = email.split("@");
  if (!domain) return `${user.slice(0, 2)}***`;
  return `${user.slice(0, 2)}***@${domain}`;
};

export const maskIpAddress = (value: string | null | undefined) => {
  const ip = value?.trim();
  if (!ip) return "";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length ? `${parts.slice(0, 2).join(":")}:****` : "****";
  }
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return "****";
};

export const maskDocument = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length < 6) return value ? "****" : "";
  return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
};
