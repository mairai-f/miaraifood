import { useCallback, useEffect, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome }>;
}

const isDesktopRuntime = () => typeof window !== 'undefined'
  && Boolean((window as Window & { electronAPI?: unknown }).electronAPI);

let deferredInstallEvent: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<(event: BeforeInstallPromptEvent | null) => void>();

const publish = (event: BeforeInstallPromptEvent | null) => {
  deferredInstallEvent = event;
  subscribers.forEach((subscriber) => subscriber(event));
};

// Este listener é registrado ao carregar o bundle, antes de o usuário fechar
// o seletor de idioma. Assim o convite de instalação não se perde até o login.
if (typeof window !== 'undefined' && !isDesktopRuntime()) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    publish(event as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => publish(null));
}

/** Disponibiliza o prompt nativo de instalação somente no navegador web. */
export function usePwaInstall() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    setInstallEvent(deferredInstallEvent);
    const receive = (event: BeforeInstallPromptEvent | null) => setInstallEvent(event);
    subscribers.add(receive);
    return () => {
      subscribers.delete(receive);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome | null> => {
    if (!installEvent || isInstalling) return null;
    setIsInstalling(true);
    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') publish(null);
      return outcome;
    } finally {
      setIsInstalling(false);
    }
  }, [installEvent, isInstalling]);

  return { canInstall: Boolean(installEvent), isInstalling, install };
}
