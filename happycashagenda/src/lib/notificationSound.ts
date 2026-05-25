export const playNotificationSound = () => {
  try {
    const audioWindow = window as Window & typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextConstructor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    gain.connect(context.destination);

    [880, 1175, 988].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.12);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + 0.52 + index * 0.12);
    });

    window.setTimeout(() => {
      void context.close();
    }, 1000);
  } catch {
    // Alguns navegadores bloqueiam audio ate a primeira interacao do usuario.
  }
};
