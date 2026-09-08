import { useEffect, useRef, useState } from 'react';

// Splash de vídeo mostrado uma vez por sessão do navegador (sessionStorage,
// não localStorage — reaparece se o usuário fechar a aba e abrir de novo,
// mas não a cada navegação interna do mesmo app). Fica por cima do app via
// overlay, enquanto o React já monta o resto por baixo — não bloqueia o
// boot, só cobre a tela até o vídeo acabar (ou falhar/travar, daí o timeout
// de segurança).
const SESSION_KEY = 'miar-preload-seen';
const TARGET_DURATION_S = 4;
const FALLBACK_TIMEOUT_MS = (TARGET_DURATION_S + 2) * 1000;
const VIDEO_SRC = `${import.meta.env.BASE_URL}preload/miarpreload.mp4`;

export default function PreloadSplash() {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });
  const hiddenRef = useRef(false);

  const hide = () => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* modo privado ou storage bloqueado — segue sem persistir */
    }
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(hide, FALLBACK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        // O vídeo já tem fundo branco embutido — o fundo do overlay precisa
        // bater exatamente com isso, senão fica uma borda/moldura visível
        // ao redor do vídeo (pedido explícito, 06/09/2026).
        background: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          if (video.duration > TARGET_DURATION_S) {
            video.playbackRate = video.duration / TARGET_DURATION_S;
          }
        }}
        onEnded={hide}
        onError={hide}
        // Centralizado e limitado de tamanho em qualquer tela — antes usava
        // 100% + object-fit:cover (tela inteira, cortando/distorcendo em
        // telas muito largas ou estreitas). Agora é uma caixa que nunca
        // passa de 90% da largura/altura da viewport nem de 480x480,
        // sempre centralizada, sem cortar o vídeo (object-fit:contain).
        style={{
          width: 'min(90vw, 480px)',
          height: 'min(90vh, 480px)',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
