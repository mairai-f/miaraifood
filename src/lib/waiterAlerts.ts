const PREFERENCES_KEY = 'miar:waiter-alert-preferences';

export type WaiterAlertPreferences = {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
};

const defaults: WaiterAlertPreferences = {
  soundEnabled: true,
  notificationsEnabled: false,
};

export function readWaiterAlertPreferences(): WaiterAlertPreferences {
  try {
    const value = localStorage.getItem(PREFERENCES_KEY);
    return value ? { ...defaults, ...JSON.parse(value) } : defaults;
  } catch {
    return defaults;
  }
}

export function writeWaiterAlertPreferences(value: WaiterAlertPreferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
}

/** A brief, distinct two-tone alert for a real call made from the QR Menu. */
export function playWaiterCallAlert() {
  const { soundEnabled } = readWaiterAlertPreferences();
  if (!soundEnabled) return;

  try {
    const AudioContextCtor = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);

    [740, 988].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const startsAt = context.currentTime + index * 0.22;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      oscillator.connect(gain);
      gain.gain.setValueAtTime(0.22, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.16);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.18);
    });

    window.setTimeout(() => void context.close(), 650);
  } catch {
    // Audio can be blocked until the first user interaction; the visual alert remains available.
  }
}

export async function enableWaiterNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  const preferences = readWaiterAlertPreferences();
  writeWaiterAlertPreferences({ ...preferences, notificationsEnabled: permission === 'granted' });
  return permission === 'granted';
}

export function notifyWaiterCall(tableCode: string) {
  const { notificationsEnabled } = readWaiterAlertPreferences();
  if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification('Novo chamado de mesa', {
    body: `${tableCode} solicitou atendimento pelo QR Menu.`,
    icon: '/miar-collapsed-icon.svg',
    tag: `waiter-call-${tableCode}`,
  });
}
