const MENU_SPLASH_SEEN_KEY = "happycash:menu:splash-seen";

export const hasSeenMenuSplash = () => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(MENU_SPLASH_SEEN_KEY) === "1";
};

export const markMenuSplashSeen = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(MENU_SPLASH_SEEN_KEY, "1");
};
