/**
 * Utilitário de áudio para alertas do sistema HappyCash.
 * Usa a Web Audio API para gerar beeps sintéticos sem dependência externa.
 */

/**
 * Toca um beep de alerta.
 * @param frequency Frequência em Hz (padrão 880 = lá5, agudo para chamar atenção)
 * @param duration Duração em ms
 * @param volume Volume de 0 a 1
 */
export function playAlertBeep(frequency = 880, duration = 220, volume = 0.4): void {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);

    oscillator.onended = () => {
      void ctx.close();
    };
  } catch {
    // silencioso se browser não suportar
  }
}

/**
 * Toca sequência de dois beeps para alertas de estoque ou vencimento.
 */
export function playDoubleAlertBeep(): void {
  playAlertBeep(880, 180, 0.35);
  setTimeout(() => playAlertBeep(660, 220, 0.3), 220);
}
