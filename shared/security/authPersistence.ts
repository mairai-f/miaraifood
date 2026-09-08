const isBrowser = () => typeof window !== "undefined";

export const createKeepConnectedReader = (key: string, fallback = false) => () => {
  if (!isBrowser()) return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "1";
  } catch {
    return fallback;
  }
};
