import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Home as HomeIcon, Search, Newspaper, Bot, User, TrendingUp, Music, Receipt } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';

import {
  getUser, setUser, isOnboarded, isSetupDone, setSetupDone as setSetupDoneStored, clearSetupDone,
  getActiveOrder, setActiveOrder, addHistory, replaceHistory, clearHistory, addPoints, markRated, lsGet, lsSet,
  clearClientToken,
  setSavedAddresses,
} from './lib/storage';
import type { UserProfile, Restaurant, CartItem, OrderMode, ActiveOrder, AppTab } from './types';
import { getSupabaseClient } from '@workspace/api-client-react';

import Onboarding from './views/Onboarding';
import ProfileSetup from './views/ProfileSetup';
import Home from './views/Home';
import Menu from './views/Menu';
import Tracking from './views/Tracking';
import ProfileTab from './views/ProfileTab';
import AIChat from './views/AIChat';
import Reservation from './views/Reservation';
import DemandTrends from './views/DemandTrends';
import Feed from './views/Feed';
import Jobs from './views/Jobs';
import EspacoArtista from './views/EspacoArtista';
import SearchView from './views/SearchView';
import OrdersView from './views/OrdersView';
import { IdiomaProvider } from './i18n/IdiomaContext';
import { InstallPrompt } from './components/InstallPrompt';
import { createAppQueryClient } from '../../src/lib/queryClient';

const queryClient = createAppQueryClient();

type SubView = 'menu' | 'tracking' | 'reservation' | 'profile-setup' | null;

type NavigationState = {
  clientNavigation: true;
  tab: AppTab;
  subView: SubView;
};

function BottomNav({
  tab, setTab, isGuest, onRequireLogin, isArtista,
}: {
  tab: AppTab;
  setTab: (t: AppTab) => void;
  isGuest: boolean;
  onRequireLogin: () => void;
  isArtista?: boolean;
}) {
  const items: { id: AppTab; icon: React.ReactNode; label: string }[] = [
    { id: 'home',    icon: <HomeIcon className="h-5 w-5" />,      label: 'Início' },
    { id: 'search',  icon: <Search className="h-5 w-5" />,        label: 'Buscar' },
    { id: 'pedidos', icon: <Receipt className="h-5 w-5" />,       label: 'Pedidos' },
    { id: 'feed',    icon: <Newspaper className="h-5 w-5" />,     label: 'Feed' },
    ...(isArtista
      ? [{ id: 'artista' as AppTab, icon: <Music className="h-5 w-5" />, label: 'Artista' }]
      : []),
    { id: 'profile', icon: <User className="h-5 w-5" />,          label: 'Perfil' },
  ];
  return (
    <nav className="client-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {items.map(item => (
          <button key={item.id} onClick={() => {
            if (isGuest && item.id === 'profile') {
              onRequireLogin();
              return;
            }
            setTab(item.id);
          }}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition
              ${tab === item.id ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}>
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function AppInner() {
  const [onboarded, setOnboarded] = useState(isOnboarded());
  const [setupDone, setSetupDone] = useState(isSetupDone());
  const [user, setUserState] = useState<UserProfile | null>(getUser());
  const [tab, setTab] = useState<AppTab>('home');
  const [subView, setSubView] = useState<SubView>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [qrToken, setQrToken] = useState<string | undefined>();
  const [qrTableId, setQrTableId] = useState<string | undefined>();
  const [qrGuestId, setQrGuestId] = useState<string | undefined>();
  const [qrRestaurantId, setQrRestaurantId] = useState<string | undefined>();
  const [activeOrder, setActiveOrderState] = useState<ActiveOrder | null>(getActiveOrder());
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const navigationReady = useRef(false);
  const skipNavigationPush = useRef(true);
  const restoringNavigation = useRef(false);

  useEffect(() => {
    const initialState: NavigationState = { clientNavigation: true, tab: 'home', subView: null };
    window.history.replaceState(initialState, '');
    navigationReady.current = true;

    const onPopState = (event: PopStateEvent) => {
      const state = event.state as Partial<NavigationState> | null;
      if (!state?.clientNavigation) return;
      restoringNavigation.current = true;
      setTab(state.tab ?? 'home');
      setSubView(state.subView ?? null);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!navigationReady.current) return;
    if (skipNavigationPush.current) {
      skipNavigationPush.current = false;
      return;
    }
    if (restoringNavigation.current) {
      restoringNavigation.current = false;
      return;
    }
    const state: NavigationState = { clientNavigation: true, tab, subView };
    window.history.pushState(state, '');
  }, [tab, subView]);

  useEffect(() => {
    void getSupabaseClient().from('miaifood_public_menu').select('restaurant_id,restaurant_name,segment,city,state').then(({ data }) => {
      const unique = new Map<string, Restaurant>();
      (data ?? []).forEach((row: any) => unique.set(row.restaurant_id, {
        id: row.restaurant_id,
        name: row.restaurant_name || 'Estabelecimento',
        segment: row.segment ?? undefined,
        address: [row.city, row.state].filter(Boolean).join(' - ') || undefined,
      }));
      setRestaurants([...unique.values()]);
    });
  }, []);

  // QR público de mesa: o token só é resolvido pelo Edge Function. O UUID
  // interno da mesa nunca é deduzido pelo navegador.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('qr') ?? params.get('qrToken');
    if (!token) return;
    setQrToken(token);
    void getSupabaseClient().functions.invoke('food-qrmenu', { body: { action: 'resolve', token } })
      .then(({ data }) => {
        if (!data?.table?.id) return;
        setQrTableId(data.table.id);
        if (data.restaurantId) setQrRestaurantId(data.restaurantId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!qrToken || !qrTableId) return;
    const guestStorageKey = `miar_table_guest_${qrToken}`;
    const rememberedGuestId = lsGet<string | null>(guestStorageKey, null);
    let cancelled = false;
    if (rememberedGuestId) {
      setQrGuestId(rememberedGuestId);
      return () => { cancelled = true; };
    }
    getSupabaseClient().functions.invoke('food-qrmenu', { body: { action: 'start_guest', token: qrToken } }).then(({ data }) => {
      if (cancelled || !data?.guestToken) return;
      setQrGuestId(data.guestToken);
      lsSet(guestStorageKey, data.guestToken);
    }).catch(() => {
      if (!cancelled) setQrGuestId(undefined);
    });
    return () => { cancelled = true; };
  }, [qrToken, qrTableId, user?.name]);

  useEffect(() => {
    if (!onboarded || !qrRestaurantId || !restaurants.length) return;
    const qrRestaurant = restaurants.find(r => r.id === qrRestaurantId);
    if (qrRestaurant) {
      setSelectedRestaurant(qrRestaurant);
      setSubView('menu');
    }
  }, [onboarded, qrRestaurantId, restaurants]);

  useEffect(() => {
    if (!onboarded || !user || user.isGuest) return;
    getSupabaseClient().auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const me = { id: data.user.id, name: String(data.user.user_metadata?.full_name ?? data.user.email ?? ''), email: data.user.email ?? '', phone: data.user.user_metadata?.phone, onboardingCompleted: false };
      const currentUser = getUser();
      if (me.onboardingCompleted) setSetupDoneStored();
      else clearSetupDone();
      const hydratedUser = currentUser ? {
        ...currentUser,
        id: me.id,
        name: me.name,
        email: me.email,
        phone: me.phone ?? undefined,
        shareDataWithRestaurants: me.shareDataWithRestaurants ?? currentUser.shareDataWithRestaurants,
        allowAIMemory: me.allowAIMemory ?? currentUser.allowAIMemory,
        discoveryPreferences: Array.isArray(me.discoveryPreferences) ? me.discoveryPreferences as UserProfile['discoveryPreferences'] : currentUser.discoveryPreferences,
      } : currentUser;
      if (hydratedUser) {
        setUser(hydratedUser);
        setUserState(hydratedUser);
      }
      if (Array.isArray(me.savedAddresses)) setSavedAddresses((me.savedAddresses as UserProfile['savedAddresses']) ?? []);
    }).catch(() => {});
    getSupabaseClient().from('food_orders').select('id,store_account_id,source,status,total,created_at,food_order_items(product_id,product_name,quantity,unit_price)').eq('customer_user_id', user?.id ?? '').order('created_at', { ascending: true }).then(({ data: rows }) => {
      const serverOrders = (rows ?? []).map((row: any) => ({ id: row.id, restaurantId: row.store_account_id, mode: row.source === 'delivery' ? 'delivery' : row.source === 'pickup' ? 'pickup' : 'dine-in', total: Number(row.total), createdAt: row.created_at, items: (row.food_order_items ?? []).map((item: any) => ({ name: item.product_name, quantity: Number(item.quantity), menuItemId: item.product_id ?? '', price: Number(item.unit_price) })) }));
      const records = serverOrders.map(order => ({
        id: order.id,
        restaurantName: restaurants.find(r => r.id === order.restaurantId)?.name ?? 'Restaurante',
        restaurantId: order.restaurantId ?? '',
        mode: order.mode ?? 'dine-in',
        total: order.total,
        createdAt: order.createdAt,
        items: order.items,
      }));
      replaceHistory(records);
      const currentOrder = serverOrders.find(order => order.id === getActiveOrder()?.id) ?? serverOrders.at(-1);
      if (currentOrder) {
        const restored = {
          id: currentOrder.id,
          restaurantName: restaurants.find(r => r.id === currentOrder.restaurantId)?.name ?? 'Restaurante',
          restaurantId: currentOrder.restaurantId ?? '',
          mode: currentOrder.mode ?? 'dine-in',
        };
        setActiveOrderState(restored);
        setActiveOrder(restored);
      }
    }).catch(() => {});
  }, [onboarded, user?.id, restaurants]);

  useEffect(() => {
    if (!user?.id || !onboarded) return;
    const refreshOrders = async () => {
      const { data: rows } = await getSupabaseClient().from('food_orders').select('id,store_account_id,source,status,total,created_at,food_order_items(product_id,product_name,quantity,unit_price)').eq('customer_user_id', user.id).order('created_at', { ascending: true });
      if (!rows) return;
      replaceHistory(rows.map((row: any) => ({ id: row.id, restaurantName: restaurants.find(r => r.id === row.store_account_id)?.name ?? 'Restaurante', restaurantId: row.store_account_id, mode: row.source === 'delivery' ? 'delivery' : row.source === 'pickup' ? 'pickup' : 'dine-in', total: Number(row.total), createdAt: row.created_at, items: (row.food_order_items ?? []).map((item: any) => ({ name: item.product_name, quantity: Number(item.quantity), menuItemId: item.product_id ?? '', price: Number(item.unit_price) })) })));
    };
    const channel = getSupabaseClient().channel(`client-orders-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_orders', filter: `customer_user_id=eq.${user.id}` }, () => { void refreshOrders(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_order_items' }, () => { void refreshOrders(); })
      .subscribe();
    return () => { void getSupabaseClient().removeChannel(channel); };
  }, [onboarded, user?.id, restaurants]);

  // ── Auth ──────────────────────────────────────────────────────────────
  if (!onboarded) {
    return <Onboarding onDone={() => {
      setOnboarded(true);
      setUserState(getUser());
      // Show profile setup for non-guests who haven't done it
      const u = getUser();
      if (u && !u.isGuest && !isSetupDone()) setSubView('profile-setup');
    }} />;
  }

  // ── Profile setup wizard ──────────────────────────────────────────────
  if (subView === 'profile-setup') {
    return <ProfileSetup onDone={() => {
      setSetupDone(true);
      setUserState(getUser());
      setSubView(null);
    }} />;
  }

  // ── Restaurant → Menu ─────────────────────────────────────────────────
  const openRestaurant = (r: Restaurant) => {
    setSelectedRestaurant(r); setSubView('menu');
  };

  const doLogout = () => {
    void getSupabaseClient().auth.signOut().catch(() => {});
    clearClientToken();
    localStorage.removeItem('miar_user');
    localStorage.removeItem('miar_onboarded');
    localStorage.removeItem('miar_setup_done');
    clearHistory();
    setActiveOrder(null);
    setOnboarded(false);
    setUserState(null);
    setTab('home');
    setSubView(null);
  };

  const startAccountFlow = () => {
    setShowLoginPrompt(false);
    doLogout();
  };

  // ── Order placed callback ──────────────────────────────────────────────
  const handleOrderPlaced = (orderId: string, mode: OrderMode, items: CartItem[], total: number) => {
    const order: ActiveOrder = {
      id: orderId,
      restaurantName: selectedRestaurant?.name ?? 'Restaurante',
      restaurantId: selectedRestaurant?.id ?? '',
      mode,
    };
    setActiveOrderState(order);
    setActiveOrder(order);
    addHistory({
      id: orderId,
      restaurantName: selectedRestaurant?.name ?? 'Restaurante',
      restaurantId: selectedRestaurant?.id ?? '',
      mode, total,
      createdAt: new Date().toISOString(),
      items: items.map(i => ({ name: i.name, quantity: i.qty, menuItemId: i.id, price: i.price })),
    });
    // Pontos locais continuam disponíveis offline. A pontuação definitiva será
    // calculada no banco junto do programa de fidelidade do estabelecimento.
    addPoints(total);
    setSubView('tracking');
  };

  // ── Sub-views (full screen) ────────────────────────────────────────────
  if (subView === 'menu' && selectedRestaurant) {
    return (
      <>
        <AnimatePresence mode="wait">
          <motion.div key="menu" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Menu
              restaurant={selectedRestaurant}
              tableId={qrTableId}
              tableToken={qrToken}
              guestId={qrGuestId}
              onBack={() => setSubView(null)}
              onOrderPlaced={handleOrderPlaced}
              isGuest={Boolean(user?.isGuest)}
              onRequireLogin={() => setShowLoginPrompt(true)}
              onOpenReservation={() => setSubView('reservation')}
            />
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  if (subView === 'tracking' && activeOrder) {
    return (
      <>
        <AnimatePresence mode="wait">
          <motion.div key="tracking" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Tracking
              orderId={activeOrder.id}
              restaurantName={activeOrder.restaurantName}
              restaurantId={activeOrder.restaurantId}
              mode={activeOrder.mode}
              userId={user?.id}
              onBack={() => { setSubView(null); setTab('home'); }}
              onRate={(id) => {
                markRated(id);
                setActiveOrderState(null);
                setActiveOrder(null);
              }}
            />
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  if (subView === 'reservation' && selectedRestaurant) {
    return (
      <AnimatePresence mode="wait">
        <motion.div key="reservation" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
          <Reservation restaurant={selectedRestaurant} onBack={() => setSubView(null)} />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Main tabbed layout ─────────────────────────────────────────────────
  return (
    <div className="client-app-shell bg-slate-950 min-h-screen text-slate-100">
      <AnimatePresence mode="wait">
        {tab === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Home
              user={user}
              activeOrder={activeOrder}
              onSelectRestaurant={openRestaurant}
              onOpenTracking={() => {
                if (user?.isGuest) setShowLoginPrompt(true);
                else if (activeOrder) setSubView('tracking');
              }}
              onRequireLogin={() => setShowLoginPrompt(true)}
            />
          </motion.div>
        )}
        {tab === 'feed' && (
          <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Feed user={user} onRequireLogin={() => setShowLoginPrompt(true)} onBack={() => setTab('home')} />
          </motion.div>
        )}
        {tab === 'search' && (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SearchView user={user} onBack={() => setTab('home')} onSelectRestaurant={openRestaurant} />
          </motion.div>
        )}
        {tab === 'pedidos' && (
          <motion.div key="pedidos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OrdersView
              user={user}
              activeOrder={activeOrder}
              onOpenTracking={() => {
                if (user?.isGuest) setShowLoginPrompt(true);
                else if (activeOrder) setSubView('tracking');
              }}
              onSelectRestaurant={openRestaurant}
              onRequireLogin={() => setShowLoginPrompt(true)}
            />
          </motion.div>
        )}
        {tab === 'jobs' && (
          <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Jobs onBack={() => setTab('home')} />
          </motion.div>
        )}
        {tab === 'chat' && (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AIChat
              restaurants={restaurants}
              onBack={() => setTab('home')}
            />
          </motion.div>
        )}
        {tab === 'trends' && (
          <motion.div key="trends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DemandTrends onBack={() => setTab('home')} />
          </motion.div>
        )}
        {tab === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ProfileTab
              onEditProfile={() => setSubView('profile-setup')}
              onLogout={doLogout}
            />
          </motion.div>
        )}
        {tab === 'artista' && (
          <motion.div key="artista" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EspacoArtista onBack={() => setTab('profile')} />
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav
        tab={tab}
        setTab={setTab}
        isGuest={Boolean(user?.isGuest)}
        onRequireLogin={() => setShowLoginPrompt(true)}
        isArtista={Boolean(user?.ehArtista && user?.desejaAgregarAppArtista)}
      />
      {showLoginPrompt && (
        <div className="client-login-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-slate-100">Entre para continuar</p>
                <p className="mt-1 text-sm text-slate-400">
                  Crie sua conta ou entre para favoritar, pedir, reservar e usar a IA.
                </p>
              </div>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="rounded-full bg-slate-800 px-2.5 py-1 text-slate-400 hover:text-slate-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <button
              onClick={startAccountFlow}
              className="w-full rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white hover:bg-emerald-400"
            >
              Criar conta ou entrar
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Você ainda pode consultar restaurantes e cardápios sem cadastro.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <IdiomaProvider>
      <QueryClientProvider client={queryClient}>
        <AppInner />
        <Toaster />
        <InstallPrompt />
      </QueryClientProvider>
    </IdiomaProvider>
  );
}
