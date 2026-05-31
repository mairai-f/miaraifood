type NotificationSoundVariant = "default" | "alert" | "success";
type AgendaSoundEvent =
  | "notification"
  | "new_appointment"
  | "reschedule"
  | "cancellation"
  | "completion";

type AgendaSoundSettings = {
  soundNotificationsEnabled?: boolean;
  soundNewAppointmentEnabled?: boolean;
  soundRescheduleEnabled?: boolean;
  soundCancellationEnabled?: boolean;
  soundCompletionEnabled?: boolean;
};

const getNotificationPattern = (variant: NotificationSoundVariant) => {
  switch (variant) {
    case "alert":
      return {
        frequencies: [740, 620, 740, 620],
        stepSeconds: 0.1,
        gainPeak: 0.28,
        stopSeconds: 0.58,
        wave: "triangle" as OscillatorType,
      };
    case "success":
      return {
        frequencies: [660, 880, 1046],
        stepSeconds: 0.11,
        gainPeak: 0.22,
        stopSeconds: 0.52,
        wave: "sine" as OscillatorType,
      };
    default:
      return {
        frequencies: [880, 1175, 988],
        stepSeconds: 0.12,
        gainPeak: 0.24,
        stopSeconds: 0.52,
        wave: "sine" as OscillatorType,
      };
  }
};

export const playNotificationSound = (variant: NotificationSoundVariant = "default") => {
  try {
    const audioWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const now = context.currentTime;
    const gain = context.createGain();
    const pattern = getNotificationPattern(variant);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(pattern.gainPeak, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    gain.connect(context.destination);

    pattern.frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = pattern.wave;
      oscillator.frequency.setValueAtTime(frequency, now + index * pattern.stepSeconds);
      oscillator.connect(gain);
      oscillator.start(now + index * pattern.stepSeconds);
      oscillator.stop(now + pattern.stopSeconds + index * pattern.stepSeconds);
    });

    window.setTimeout(() => {
      void context.close();
    }, 1000);
  } catch {
    // Alguns navegadores bloqueiam audio ate a primeira interacao do usuario.
  }
};

export const shouldPlayAgendaSound = (
  settings: AgendaSoundSettings | null | undefined,
  event: AgendaSoundEvent,
) => {
  if (!settings) return true;
  if (settings.soundNotificationsEnabled === false) return false;

  switch (event) {
    case "new_appointment":
      return settings.soundNewAppointmentEnabled !== false;
    case "reschedule":
      return settings.soundRescheduleEnabled !== false;
    case "cancellation":
      return settings.soundCancellationEnabled !== false;
    case "completion":
      return settings.soundCompletionEnabled !== false;
    default:
      return true;
  }
};
