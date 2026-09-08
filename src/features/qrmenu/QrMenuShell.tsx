import { useState } from 'react';
import { UtensilsCrossed, ShoppingBag, Receipt } from 'lucide-react';
import { TableSessionProvider, useTableSession } from './context/TableSessionContext';
import { MenuThemeProvider } from './theme/MenuThemeContext';
import StepperScreen from './screens/StepperScreen';
import MenuScreen from './screens/MenuScreen';
import CartScreen from './screens/CartScreen';
import BillScreen from './screens/BillScreen';

export type QrMenuTab = 'menu' | 'cart' | 'bill';

function BottomNav({ activeTab, onTabChange }: { activeTab: QrMenuTab; onTabChange: (t: QrMenuTab) => void }) {
  const { cart } = useTableSession();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const items = [
    { id: 'menu' as const, label: 'Cardápio', icon: UtensilsCrossed },
    { id: 'cart' as const, label: 'Carrinho', icon: ShoppingBag, badge: cartCount },
    { id: 'bill' as const, label: 'Fechar conta', icon: Receipt },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-slate-800/80 bg-[#0d1726]/95 backdrop-blur-lg px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
      {items.map(({ id, label, icon: Icon, badge }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition ${
              active ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {Boolean(badge) && (
                <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-slate-950">
                  {badge}
                </span>
              )}
            </div>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function InnerShell() {
  const session = useTableSession();
  const [activeTab, setActiveTab] = useState<QrMenuTab>('menu');
  const [stepperSeen, setStepperSeen] = useState(
    () => Boolean(session.stepperAnswers) || sessionStorage.getItem('miar_qrmenu_stepper_seen') === '1'
  );

  if (session.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center bg-[#050b14] text-slate-100">
        <div className="max-w-sm space-y-3 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
          <p className="text-lg font-bold text-slate-200">Não foi possível abrir a mesa</p>
          <p className="text-sm text-slate-400">{session.error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!session.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b14] text-slate-400 text-sm">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Abrindo sua mesa…</span>
        </div>
      </div>
    );
  }

  if (!stepperSeen) {
    return (
      <StepperScreen
        onDone={() => {
          sessionStorage.setItem('miar_qrmenu_stepper_seen', '1');
          setStepperSeen(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050b14] text-slate-100 pb-20">
      {activeTab === 'menu' && <MenuScreen onOpenCart={() => setActiveTab('cart')} />}
      {activeTab === 'cart' && (
        <CartScreen onBackToMenu={() => setActiveTab('menu')} onGoToBill={() => setActiveTab('bill')} />
      )}
      {activeTab === 'bill' && <BillScreen onBackToMenu={() => setActiveTab('menu')} />}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default function QrMenuShell({ qrToken }: { qrToken: string }) {
  return (
    <TableSessionProvider qrToken={qrToken}>
      <MenuThemeProvider>
        <InnerShell />
      </MenuThemeProvider>
    </TableSessionProvider>
  );
}
