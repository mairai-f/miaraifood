const FOOD_SPLASH_SEEN_KEY = "happycash:food:splash-seen";

export const hasSeenFoodSplash = () => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(FOOD_SPLASH_SEEN_KEY) === "1";
};

export const markFoodSplashSeen = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FOOD_SPLASH_SEEN_KEY, "1");
};
