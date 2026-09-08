import { registerPlugin, Capacitor } from '@capacitor/core';

interface KioskModePlugin {
  start(): Promise<{ active: boolean }>;
  stop(): Promise<{ active: boolean }>;
}

const KioskMode = registerPlugin<KioskModePlugin>('KioskMode');

// Screen Pinning "modo simples" (ver android/.../KioskModePlugin.java) — só
// faz sentido dentro do app nativo Android. No navegador (web/PWA) essas
// funções são no-op silencioso, então o mesmo código de login funciona nos
// dois ambientes sem precisar de checagem de plataforma espalhada por aí.
export async function startKioskMode(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await KioskMode.start();
  } catch {
    // Sem permissão/API indisponível (ex.: emulador antigo) — segue sem
    // travar o app, login continua funcionando normalmente.
  }
}

export async function stopKioskMode(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await KioskMode.stop();
  } catch {
    // idem acima
  }
}
