const APP_SPLASH_SEEN_KEY = 'happycash:system:app-splash-seen';

export const hasSeenAppSplash = () => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(APP_SPLASH_SEEN_KEY) === '1';
};

export const markAppSplashSeen = () => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(APP_SPLASH_SEEN_KEY, '1');
};
