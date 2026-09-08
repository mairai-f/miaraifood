import { useEffect, useRef, useState } from 'react';

const SESSION_KEY = 'miar-preload-seen';
const TARGET_DURATION_S = 4;
const FALLBACK_TIMEOUT_MS = (TARGET_DURATION_S + 2) * 1000;
const VIDEO_SRC = '/preload/miarpreload.mp4';

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
      /* modo privado ou storage bloqueado */
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
        style={{
          width: 'min(90vw, 480px)',
          height: 'min(90vh, 480px)',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
