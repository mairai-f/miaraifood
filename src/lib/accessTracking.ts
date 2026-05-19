import { getRedactedLogValue } from '../../shared/security/redaction';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CLIENT_SESSION_STORAGE_KEY = "happycash:system:client-session-id";

export const ACCESS_HEARTBEAT_INTERVAL_MS = 60_000;
export const ACCESS_ACTIVE_WINDOW_MS = 5 * 60_000;

type TrackAccessEventType = "heartbeat" | "logout";

const isBrowser = () => typeof window !== "undefined";

const generateSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getSystemClientSessionId = () => {
  if (!isBrowser()) return "server-session";

  const current = window.sessionStorage.getItem(CLIENT_SESSION_STORAGE_KEY);
  if (current) return current;

  const next = generateSessionId();
  window.sessionStorage.setItem(CLIENT_SESSION_STORAGE_KEY, next);
  return next;
};

export const clearSystemClientSessionId = () => {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
};

export const trackSystemAccessEvent = async (
  accessToken: string,
  eventType: TrackAccessEventType,
) => {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !accessToken) return false;

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/track-access`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType,
        source: "system",
        clientSessionId: getSystemClientSessionId(),
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Erro ao registrar evento de acesso:", getRedactedLogValue(error));
    return false;
  }
};
