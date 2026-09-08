import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, ShoppingCart, Receipt } from 'lucide-react';
import { TableSessionProvider, useTableSession } from './context/TableSessionContext';
import { MenuThemeProvider, DEFAULT_MENU_THEME, type MenuTheme } from '@workspace/menu-theme';
import StepperScreen from './screens/StepperScreen';
import MenuScreen from './screens/MenuScreen';
import CartScreen from './screens/CartScreen';
import BillScreen from './screens/BillScreen';

const NAV_ITEMS = [
  { href: '/menu', label: 'Cardápio', icon: UtensilsCrossed },
  { href: '/cart', label: 'Carrinho', icon: ShoppingCart },
  { href: '/bill', label: 'Fechar conta', icon: Receipt },
];

function Nav() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
      style={{ background: 'var(--menu-surface)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = location.pathname === href;
        return (
          <button
            key={href}
            type="button"
            onClick={() => navigate({ pathname: href, search: location.search })}
            className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition-colors"
            style={{ color: active ? 'var(--menu-primary)' : 'var(--menu-text)', opacity: active ? 1 : 0.55 }}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function Shell() {
  const session = useTableSession();
  const [skippedOrDone, setSkippedOrDone] = useState(() => Boolean(session.stepperAnswers) || sessionStorage.getItem('miar_qrmenu_stepper_seen') === '1');
  const [theme, setTheme] = useState<MenuTheme>(DEFAULT_MENU_THEME);

  useEffect(() => {
    if (!session.restaurantId) return;
    let cancelled = false;
    fetch(`/api/restaurants/${session.restaurantId}/menu-theme`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MenuTheme | null) => { if (!cancelled && data) setTheme(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session.restaurantId]);

  if (session.error) {
    return (
      <MenuThemeProvider theme={theme}>
        <div className="flex min-h-screen items-center justify-center p-6 text-center" style={{ background: 'var(--menu-bg)', color: 'var(--menu-text)' }}>
          <div>
            <p className="text-lg font-semibold">Não foi possível abrir a mesa</p>
            <p className="mt-2 text-sm opacity-60">{session.error}</p>
          </div>
        </div>
      </MenuThemeProvider>
    );
  }

  if (!session.ready) {
    return (
      <MenuThemeProvider theme={theme}>
        <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--menu-bg)', color: 'var(--menu-text)', opacity: 0.6 }}>
          Abrindo sua mesa…
        </div>
      </MenuThemeProvider>
    );
  }

  if (!skippedOrDone) {
    return (
      <StepperScreen
        onDone={() => {
          sessionStorage.setItem('miar_qrmenu_stepper_seen', '1');
          setSkippedOrDone(true);
        }}
      />
    );
  }

  return (
    <MenuThemeProvider theme={theme}>
      <div className="min-h-screen pb-28 pt-4" style={{ background: 'var(--menu-bg)', color: 'var(--menu-text)' }}>
        <Routes>
          <Route path="/menu" element={<MenuScreen />} />
          <Route path="/cart" element={<CartScreen />} />
          <Route path="/bill" element={<BillScreen />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
        <Nav />
      </div>
    </MenuThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TableSessionProvider>
        <Shell />
      </TableSessionProvider>
    </BrowserRouter>
  );
}
