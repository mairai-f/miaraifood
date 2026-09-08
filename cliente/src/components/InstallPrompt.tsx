import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const DISMISS_KEY = 'miar-install-dismissed';

function isIos() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isInstalled() { return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as unknown as { standalone?: boolean }).standalone); }

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if (isInstalled() || sessionStorage.getItem(DISMISS_KEY)) return;
    setVisible(true); setIos(isIos());
    const handler = (value: Event) => { value.preventDefault(); setEvent(value as InstallEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!visible) return null;
  const install = async () => {
    if (!event) return;
    await event.prompt();
    if ((await event.userChoice).outcome === 'accepted') setVisible(false);
    setEvent(null);
  };
  const dismiss = () => { setVisible(false); sessionStorage.setItem(DISMISS_KEY, '1'); };
  return <aside role="status" className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-[#16301F] px-4 py-3 text-sm text-white shadow-xl">
    <span>{ios ? 'Use Compartilhar e Adicionar à Tela de Início.' : 'Instale a MIAR neste aparelho.'}</span>
    <div className="flex shrink-0 gap-2">
      {!ios && <button type="button" onClick={() => void install()} disabled={!event} className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-[#06100A] disabled:opacity-50">Instalar</button>}
      <button type="button" onClick={dismiss} aria-label="Fechar" className="rounded-lg px-2 py-1.5 text-slate-300 hover:text-white">X</button>
    </div>
  </aside>;
}
