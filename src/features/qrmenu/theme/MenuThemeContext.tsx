import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface MenuTheme {
  bg: string;
  cardBg: string;
  cardText: string;
  modalBg: string;
  modalText: string;
  text: string;
  primary: string;
  fontFamily: string;
}

export const DEFAULT_MENU_THEME: MenuTheme = {
  bg: '#050b14',
  cardBg: '#0d1726',
  cardText: '#f8fafc',
  modalBg: '#0f172a',
  modalText: '#f8fafc',
  text: '#f1f5f9',
  primary: '#007200',
  fontFamily: 'Inter',
};

const MenuThemeContext = createContext<{ theme: MenuTheme; updateTheme: (t: Partial<MenuTheme>) => void }>({
  theme: DEFAULT_MENU_THEME,
  updateTheme: () => {},
});

export function MenuThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<MenuTheme>(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      if (stored) return { ...DEFAULT_MENU_THEME, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_MENU_THEME;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'qrmenu_theme' && e.newValue) {
        try {
          setTheme({ ...DEFAULT_MENU_THEME, ...JSON.parse(e.newValue) });
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updateTheme = (newTheme: Partial<MenuTheme>) => {
    setTheme((prev) => {
      const updated = { ...prev, ...newTheme };
      localStorage.setItem('qrmenu_theme', JSON.stringify(updated));
      return updated;
    });
  };

  const value = useMemo(() => ({ theme, updateTheme }), [theme]);

  const cssVars = {
    '--menu-bg': theme.bg || DEFAULT_MENU_THEME.bg,
    '--menu-card-bg': theme.cardBg || DEFAULT_MENU_THEME.cardBg,
    '--menu-card-text': theme.cardText || DEFAULT_MENU_THEME.cardText,
    '--menu-modal-bg': theme.modalBg || DEFAULT_MENU_THEME.modalBg,
    '--menu-modal-text': theme.modalText || DEFAULT_MENU_THEME.modalText,
    '--menu-text': theme.text || DEFAULT_MENU_THEME.text,
    '--menu-primary': theme.primary || DEFAULT_MENU_THEME.primary,
    '--menu-font-family': theme.fontFamily || DEFAULT_MENU_THEME.fontFamily,
    fontFamily: `${theme.fontFamily || 'Inter'}, system-ui, sans-serif`,
  } as React.CSSProperties;

  return (
    <MenuThemeContext.Provider value={value}>
      <div style={cssVars} className="min-h-screen w-full font-sans antialiased bg-[var(--menu-bg)] text-[var(--menu-text)]">
        {children}
      </div>
    </MenuThemeContext.Provider>
  );
}

export function useMenuTheme() {
  return useContext(MenuThemeContext);
}
