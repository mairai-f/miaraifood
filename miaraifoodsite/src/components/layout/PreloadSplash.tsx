"use client";

import { useEffect, useState } from 'react';
import { Preloader } from '@/components/ui/Preloader';

const SESSION_KEY = 'miar-preload-site-seen';

export function PreloadSplash() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !sessionStorage.getItem(SESSION_KEY);
    } catch {
      return true;
    }
  });

  const handleComplete = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return <Preloader onComplete={handleComplete} />;
}
