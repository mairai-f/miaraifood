type LocationSnapshot = {
  pathname: string;
  search: string;
};

const listeners = new Set<() => void>();

let snapshot: LocationSnapshot = {
  pathname: "/",
  search: "",
};

const readSnapshot = (): LocationSnapshot => ({
  pathname: window.location.pathname,
  search: window.location.search,
});

const notify = () => {
  snapshot = readSnapshot();
  listeners.forEach((listener) => listener());
};

const patchHistoryMethod = (method: "pushState" | "replaceState") => {
  const original = history[method].bind(history);

  history[method] = (...args: Parameters<History["pushState"]>) => {
    const result = original(...args);
    notify();
    return result;
  };
};

if (typeof window !== "undefined") {
  snapshot = readSnapshot();
  window.addEventListener("popstate", notify);
  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
}

export const subscribeAppLocation = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppLocationSnapshot = () => snapshot;
