import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Heart, HeartOff, Star, MapPin, Loader2, MessageCircle, QrCode,
  ChevronDown, SlidersHorizontal, ArrowUpDown, DollarSign, Clock, Bike, Navigation,
  ShoppingBag, ShieldAlert, X, Check, ArrowRight, User, RefreshCw, Smartphone
} from 'lucide-react';
import { getFavorites, toggleFavorite, getHistory, getLoyalty } from '../lib/storage';
import type { Restaurant, FeedPost, UserProfile, ActiveOrder, MenuItem } from '../types';
import LeitorQR from '../components/LeitorQR';
import ProductDetailModal from '../components/ProductDetailModal';
import { useTranslation } from '../i18n/IdiomaContext';
import { getSupabaseClient } from '@workspace/api-client-react';

// Arrastar com o dedo (touch já funciona nativo no celular) OU com o mouse
// (desktop não rola horizontal sem isso) — usado nas fileiras de categorias/
// marcas. Um único hook, reaproveitado em todas as fileiras horizontais.
function useDragScroll<T extends HTMLElement>(options?: { touchOnly?: boolean }) {
  const ref = useRef<T | null>(null);
  const state = useRef({ dragging: false, startX: 0, startScroll: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    // Pedido explícito (06/09/2026): no menu de categorias do topo
    // (Início/Restaurantes/Mercados/...), arrastar com MOUSE no desktop
    // bloqueava o clique normal — no touch (celular) o scroll horizontal já
    // é nativo do navegador, não precisa desse hook nenhum. Com
    // touchOnly, o desktop nem entra no modo de arrasto: vira um clique
    // normal, sempre.
    if (options?.touchOnly && e.pointerType !== 'touch') return;
    state.current = { dragging: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !state.current.dragging) return;
    const delta = e.clientX - state.current.startX;
    // CORRIGIDO 05/09/2026: limiar de 3px era menor que o tremor natural de
    // qualquer toque/clique real — todo tap virava "arrasto" e cancelava o
    // clique em cima (categorias do Home ficaram inclicáveis). 8px é o
    // limiar comum pra diferenciar toque de arrasto de verdade.
    if (Math.abs(delta) > 8) {
      state.current.moved = true;
      el.scrollLeft = state.current.startScroll - delta;
    }
  };
  const endDrag = () => {
    state.current.dragging = false;
  };
  // Depois de um drag real, cancela o próximo clique (evita abrir um card sem
  // querer só porque o dedo/mouse soltou em cima dele).
  const onClickCapture = (e: React.MouseEvent) => {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      state.current.moved = false;
    }
  };

  return {
    ref,
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onClickCapture,
      className: 'cursor-grab active:cursor-grabbing select-none',
    },
  };
}

// Color Palette for MIAR Food Marketplace Dark Identity
export function getColors() {
  return {
    accent: '#38B000',
    light: '#16301F',
    bg: '#06100A',
    text: '#FFFFFF',
    surface: '#16301F',
    price: '#008000',
    category: '#0B1A10',
    promo: '#38B000',
  };
}

interface HomeProps {
  user: UserProfile | null;
  activeOrder: ActiveOrder | null;
  onSelectRestaurant: (r: Restaurant) => void;
  onOpenTracking: () => void;
  onRequireLogin: () => void;
  initialTab?: 'rests' | 'feed';
}

// Haversine formula to calculate distance between two coordinates in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 16 Subcategories with 3D/Colored Illustrations (Restaurantes)
const SUBCATEGORIES_RESTAURANTES = [
  { id: 'brasileira', label: 'Brasileira', icon: '🍛' },
  { id: 'marmita', label: 'Marmita', icon: '🍱' },
  { id: 'lanches', label: 'Lanches', icon: '🍔' },
  { id: 'promocoes', label: 'Promoções', icon: '🛍️' },
  { id: 'economia', label: 'Mais economia', icon: '🚚' },
  { id: 'rapido', label: 'Mais rápido', icon: '⚡' },
  { id: 'pizza', label: 'Pizza', icon: '🍕' },
  { id: 'japonesa', label: 'Japonesa', icon: '🍣' },
  { id: 'doces', label: 'Doces & Bolos', icon: '🍮' },
  { id: 'acai', label: 'Açaí', icon: '🫐' },
  { id: 'saudavel', label: 'Saudável', icon: '🥗' },
  { id: 'italiana', label: 'Italiana', icon: '🍝' },
  { id: 'padarias', label: 'Padarias', icon: '🥐' },
  { id: 'arabe', label: 'Árabe', icon: '🥙' },
  { id: 'chinesa', label: 'Chinesa', icon: '🥢' },
  { id: 'salgados', label: 'Salgados', icon: '🥟' },
];

const SUBCATEGORIES_BEBIDAS = [
  { id: 'cervejas', label: 'Cervejas', icon: '🍺' },
  { id: 'vinhos', label: 'Vinhos', icon: '🍷' },
  { id: 'nao_alcoolicos', label: 'Não Alcoólicos', icon: '🥤' },
  { id: 'destilados', label: 'Destilados', icon: '🥃' },
];

const SUBCATEGORIES_FARMACIAS = [
  { id: 'ofertas', label: 'Ofertas', icon: '🏷️' },
  { id: 'entrega_rapida', label: 'Entrega rápida', icon: '⚡' },
  { id: 'laboratorio', label: 'Desconto de Laboratório', icon: '💊' },
];

const SUBCATEGORIES_PETS = [
  { id: 'ofertas', label: 'Ofertas', icon: '🛍️' },
  { id: 'entrega_rapida', label: 'Entrega rápida', icon: '⚡' },
  { id: 'caes', label: 'Cães', icon: '🐶' },
  { id: 'gatos', label: 'Gatos', icon: '🐱' },
];

const SUBCATEGORIES_SHOPPING = [
  { id: 'entrega_rapida', label: 'Entrega Rápida', icon: '⚡' },
  { id: 'presentes', label: 'Presentes', icon: '🎁' },
  { id: 'perfumaria', label: 'Beleza & Perfumaria', icon: '🧴' },
];

// Hero Swiper Banners
const HERO_BANNERS = [
  {
    id: 'b1',
    badge: 'Até 35% OFF',
    title: 'Desconto até 35% OFF',
    subtitle: 'Pratos incríveis com até 35% de desconto no MIAR',
    bg: 'from-[#38B000] via-[#0B1A10] to-[#16301F]',
    tagBg: 'bg-[#008000] text-[#06100A]',
    image: '🍔',
  },
  {
    id: 'b2',
    badge: 'Frete Grátis',
    title: 'Semana do Cliente',
    subtitle: 'Mercado com 30% OFF e entrega 100% grátis',
    bg: 'from-[#16301F] via-[#0B1A10] to-[#06100A]',
    tagBg: 'bg-[#38B000] text-[#FFFFFF]',
    image: '🛒',
  },
];

// Promoted Brands (Top Carousel)
const PROMOTED_BRANDS = [
  { id: 'p1', name: "McDonald's", logo: '🍔', rating: '4.8', distance: '1.2 km', info: 'Validade dos Vouchers' },
  { id: 'p2', name: 'Fritos na Hora Putim', logo: '🍟', rating: '4.9', distance: '0.8 km', info: 'Porções & Lanches' },
  { id: 'p3', name: 'Cacau Show - Putim', logo: '🍫', rating: '4.9', distance: '1.5 km', info: 'Doces & Chocolates' },
  { id: 'p4', name: 'Habib\'s', logo: '🥙', rating: '4.6', distance: '2.4 km', info: 'Esfihas & Pratos' },
];

export default function Home({
  user,
  activeOrder,
  onSelectRestaurant,
  onOpenTracking,
  onRequireLogin,
  initialTab = 'rests',
}: HomeProps) {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(getFavorites());
  const [tab, setTab] = useState<'rests' | 'feed'>(initialTab);
  
  // Category Switcher
  const [mainCategory, setMainCategory] = useState<string>('Inicio');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  // Address Selector & GPS Geolocation State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('Próximo de Putim');
  const [addressInput, setAddressInput] = useState('');
  const [locatingGps, setLocatingGps] = useState(false);

  // Hero Banner Swiper state
  const [bannerIndex, setBannerIndex] = useState(0);
  const categoryTabsDrag = useDragScroll<HTMLDivElement>({ touchOnly: true });
  const categoryBadgesDrag = useDragScroll<HTMLDivElement>();
  const promotedBrandsDrag = useDragScroll<HTMLDivElement>();
  const restaurantRowDrag = useDragScroll<HTMLDivElement>();

  // Filter Bar state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterTab, setFilterTab] = useState<'basicos' | 'categorias' | 'pagamentos'>('basicos');
  const [sortBy, setSortBy] = useState<'padrao' | 'preco' | 'avaliacao' | 'tempo' | 'taxa' | 'distancia'>('padrao');
  const [deliveryMode, setDeliveryMode] = useState<'entrega' | 'retirar'>('entrega');
  const [onlyFreeDelivery, setOnlyFreeDelivery] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number>(20);

  // Bot Protection / Human Captcha Modal
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaHolding, setCaptchaHolding] = useState(false);
  const [captchaProgress, setCaptchaProgress] = useState(0);
  const captchaTimerRef = useRef<any>(null);

  // QR Mesa Scanner state
  const [lerQR, setLerQR] = useState(false);
  const [mesaLida, setMesaLida] = useState('');

  // Product Detail Modal State
  const [selectedProduct, setSelectedProduct] = useState<(MenuItem & { imageUrl?: string | null; restaurantName?: string }) | null>(null);

  const history = getHistory();
  const lastOrder = history.length > 0 ? history[history.length - 1] : null;

  // Load restaurants and feed
  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSupabaseClient().from('miaifood_public_menu').select('*').order('sort_order', { ascending: true }),
      fetch('/api/feed').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([restaurantResult, feedData]) => {
      const rows = restaurantResult.data ?? [];
      const byRestaurant = new Map<string, any>();
      for (const row of rows) {
        const current = byRestaurant.get(row.restaurant_id) ?? {
          id: row.restaurant_id,
          name: row.restaurant_name,
          segment: row.segment,
          address: row.city && row.state ? `${row.city} - ${row.state}` : row.city,
          openNow: true,
          menuItems: [],
        };
        current.menuItems.push({ id: row.product_id, name: row.name, category: row.category, price: Number(row.price), description: row.description, imageUrl: row.image_url, featured: row.featured });
        byRestaurant.set(row.restaurant_id, current);
      }
      setRestaurants(Array.from(byRestaurant.values()) as Restaurant[]);
      setFeed(feedData as FeedPost[]);
      setLoading(false);
    });
  }, []);

  // Banner Carousel auto-play
  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % HERO_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Swipe do banner principal — mobile (touch) e desktop (mouse), com o
  // mesmo padrão de "arrastar sem ativar clique sem querer" das fileiras de
  // categoria abaixo (useDragScroll), mas aqui é troca de slide, não scroll.
  const heroSwipeRef = useRef({ startX: 0, dragging: false, moved: false });
  const onHeroPointerDown = (e: React.PointerEvent) => {
    heroSwipeRef.current = { startX: e.clientX, dragging: true, moved: false };
  };
  const onHeroPointerMove = (e: React.PointerEvent) => {
    const state = heroSwipeRef.current;
    if (!state.dragging) return;
    if (Math.abs(e.clientX - state.startX) > 8) state.moved = true;
  };
  const endHeroSwipe = (e: React.PointerEvent) => {
    const state = heroSwipeRef.current;
    if (!state.dragging) return;
    state.dragging = false;
    const delta = e.clientX - state.startX;
    const threshold = 40;
    if (delta > threshold) {
      setBannerIndex((prev) => (prev - 1 + HERO_BANNERS.length) % HERO_BANNERS.length);
    } else if (delta < -threshold) {
      setBannerIndex((prev) => (prev + 1) % HERO_BANNERS.length);
    }
  };
  // Depois de um arrasto de verdade, cancela o clique seguinte — sem isso,
  // soltar o dedo em cima do botão "Ver ofertas" no fim do swipe dispara o
  // clique dele sem querer.
  const onHeroClickCapture = (e: React.MouseEvent) => {
    if (heroSwipeRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      heroSwipeRef.current.moved = false;
    }
  };

  // Press & Hold Captcha Logic
  useEffect(() => {
    if (captchaHolding) {
      captchaTimerRef.current = setInterval(() => {
        setCaptchaProgress((p) => {
          if (p >= 100) {
            clearInterval(captchaTimerRef.current);
            setShowCaptchaModal(false);
            return 100;
          }
          return p + 4;
        });
      }, 50);
    } else {
      clearInterval(captchaTimerRef.current);
      setCaptchaProgress(0);
    }
    return () => clearInterval(captchaTimerRef.current);
  }, [captchaHolding]);

  // GPS Exact Geolocation Handler
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada neste aparelho.');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            const addr = data.address?.suburb || data.address?.road || data.address?.city || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
            setDeliveryAddress(addr);
          } else {
            setDeliveryAddress(`GPS (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
          }
        } catch {
          setDeliveryAddress(`GPS (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`);
        } finally {
          // Calculate distance to all restaurants
          setRestaurants((prev) =>
            prev.map((r: any) => {
              if (r.lat && r.lng) {
                const dist = calculateDistanceKm(latitude, longitude, r.lat, r.lng);
                return { ...r, distance: Math.round(dist * 10) / 10 };
              }
              return r;
            })
          );
          setLocatingGps(false);
          setShowAddressModal(false);
        }
      },
      (err) => {
        setLocatingGps(false);
        alert('Não foi possível obter sua localização. Permita a permissão de GPS no navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Filter restaurants logic
  const seg = (r: Restaurant) => r.segment ?? r.cuisine ?? '';
  const filteredRestaurants = restaurants.filter((r) => {
    const query = search.toLowerCase();
    const matchesSearch =
      r.name.toLowerCase().includes(query) || seg(r).toLowerCase().includes(query);
    const matchesSubCategory = selectedSubCategory
      ? seg(r).toLowerCase().includes(selectedSubCategory.toLowerCase()) ||
        r.name.toLowerCase().includes(selectedSubCategory.toLowerCase())
      : true;
    const matchesFreeDelivery = onlyFreeDelivery
      ? r.pricePerPerson === 0 || (r.distance && r.distance < 1.5)
      : true;
    const matchesDistance = r.distance ? r.distance <= maxDistance : true;

    return matchesSearch && matchesSubCategory && matchesFreeDelivery && matchesDistance;
  });

  // Sorted restaurants
  const sortedRestaurants = [...filteredRestaurants].sort((a, b) => {
    if (sortBy === 'preco') return (a.pricePerPerson ?? 0) - (b.pricePerPerson ?? 0);
    if (sortBy === 'avaliacao') return (b.rating ?? 0) - (a.rating ?? 0);
    if (sortBy === 'distancia') return (a.distance ?? 0) - (b.distance ?? 0);
    if (sortBy === 'tempo') return (a.waitTime ?? 0) - (b.waitTime ?? 0);
    return 0;
  });

  const handleToggleFav = (id: string) => {
    if (user?.isGuest) {
      onRequireLogin();
      return;
    }
    setFavorites(toggleFavorite(id));
  };

  // Get active subcategory array
  const getSubcategories = () => {
    if (mainCategory === 'Bebidas') return SUBCATEGORIES_BEBIDAS;
    if (mainCategory === 'Farmácias') return SUBCATEGORIES_FARMACIAS;
    if (mainCategory === 'Pets') return SUBCATEGORIES_PETS;
    if (mainCategory === 'Shopping') return SUBCATEGORIES_SHOPPING;
    return SUBCATEGORIES_RESTAURANTES;
  };

  return (
    <div className="client-app-shell client-dark-theme min-h-screen bg-[#06100A] text-white pb-28 font-sans selection:bg-[#38B000] selection:text-white">
      {/* ── TOP RED/DARK BRAND HEADER (FULL WIDTH ON DESKTOP) ────────────────── */}
      <header className="sticky top-0 z-30 bg-[#0B1A10] text-white shadow-xl border-b border-[#16301F]">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-3">
          {/* Row 1: Logo, Location Picker & Actions */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Logo */}
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setMainCategory('Inicio');
                setSelectedSubCategory(null);
              }}
            >
              <span className="font-extrabold text-2xl tracking-tighter text-white font-sans italic">
                MIAR<span className="text-[#008000]">.</span>
              </span>
              <span className="bg-[#38B000] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline-block">
                Food
              </span>
            </div>

            {/* Delivery Address GPS Picker */}
            <button
              onClick={() => setShowAddressModal(true)}
              className="flex items-center gap-2 bg-[#16301F] hover:bg-[#16301F] active:scale-95 px-4 py-2 rounded-full text-xs font-semibold transition border border-[#008000]/30 shadow-sm"
            >
              <MapPin className="h-4 w-4 text-[#008000] shrink-0" />
              <span className="truncate max-w-[150px] sm:max-w-[280px] text-white font-medium">
                {deliveryAddress}
              </span>
              <ChevronDown className="h-4 w-4 text-[#008000] opacity-80" />
            </button>

            {/* Right Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => (user?.isGuest ? onRequireLogin() : setShowCaptchaModal(true))}
                className="p-2 bg-[#16301F] hover:bg-[#16301F] rounded-full transition text-white border border-[#0B1A10]"
                title="Proteção Human Captcha"
              >
                <User className="h-4 w-4" />
              </button>

              <button
                onClick={() => setLerQR(true)}
                className="flex items-center gap-1.5 bg-[#008000] hover:bg-[#70E000] text-[#06100A] transition text-xs font-bold px-3 py-1.5 rounded-full shadow-md active:scale-95"
              >
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">Mesa</span>
              </button>
            </div>
          </div>

          {/* Row 2: Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busque por prato, restaurante ou categoria..."
              className="w-full bg-[#06100A] text-white placeholder-slate-400 pl-10 pr-9 py-2.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#008000] border border-[#0B1A10] shadow-inner"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── CATEGORY RIBBON TABS ────────────────────────────────────────── */}
        <div ref={categoryTabsDrag.ref} {...categoryTabsDrag.dragProps} className={`bg-[#16301F] border-t border-[#0B1A10]/40 px-4 overflow-x-auto no-scrollbar ${categoryTabsDrag.dragProps.className}`}>
          <div className="w-full max-w-7xl mx-auto flex gap-6 text-sm font-bold pt-2.5 pb-2">
            {[
              { id: 'Inicio', label: 'Início' },
              { id: 'Restaurantes', label: 'Restaurantes' },
              { id: 'Mercados', label: 'Mercados' },
              { id: 'Bebidas', label: 'Bebidas' },
              { id: 'Farmacias', label: 'Farmácias' },
              { id: 'Pets', label: 'Pets' },
              { id: 'Shopping', label: 'Shopping' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setMainCategory(cat.id);
                  setSelectedSubCategory(null);
                }}
                className={`relative whitespace-nowrap pb-2 transition ${
                  mainCategory === cat.id
                    ? 'text-[#008000] font-extrabold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
                {mainCategory === cat.id && (
                  <motion.div
                    layoutId="categoryUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008000] rounded-full"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER (FULL WIDTH ON DESKTOP) ─────────────────── */}
      <main className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-6">
        {/* Banner Section Title */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
            Pedir seu delivery no MIAR é rápido e prático! Conheça as categorias
          </h1>
        </div>

        {/* ── 3D CATEGORIES BADGES GRID / SCROLL ───────────────────────────── */}
        <div ref={categoryBadgesDrag.ref} {...categoryBadgesDrag.dragProps} className={`mb-8 overflow-x-auto pb-2 no-scrollbar ${categoryBadgesDrag.dragProps.className}`}>
          <div className="grid grid-flow-col auto-cols-[90px] sm:auto-cols-[105px] gap-3">
            {getSubcategories().map((sub) => {
              const isSelected = selectedSubCategory === sub.label;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubCategory(isSelected ? null : sub.label)}
                  className={`group flex flex-col items-center p-3 rounded-2xl transition transform active:scale-95 text-center border ${
                    isSelected
                      ? 'bg-[#0B1A10] border-[#008000] text-white shadow-lg'
                      : 'bg-[#16301F] border-[#0B1A10]/60 text-slate-200 hover:border-[#008000]/50'
                  }`}
                >
                  <div
                    className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-2xl sm:text-3xl mb-1.5 transition group-hover:scale-110 ${
                      isSelected ? 'bg-[#38B000]' : 'bg-[#06100A]/60'
                    }`}
                  >
                    {sub.icon}
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold leading-tight text-white">
                    {sub.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── HERO BANNER CAROUSEL SLIDER ──────────────────────────────────── */}
        <div
          className="mb-8 relative overflow-hidden rounded-3xl shadow-2xl border border-[#0B1A10] cursor-grab active:cursor-grabbing select-none touch-pan-y"
          onPointerDown={onHeroPointerDown}
          onPointerMove={onHeroPointerMove}
          onPointerUp={endHeroSwipe}
          onPointerLeave={endHeroSwipe}
          onClickCapture={onHeroClickCapture}
        >
          <div className="relative h-48 sm:h-60 w-full">
            {HERO_BANNERS.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: i === bannerIndex ? 1 : 0, x: i === bannerIndex ? 0 : -50 }}
                transition={{ duration: 0.4 }}
                className={`absolute inset-0 bg-gradient-to-r ${b.bg} text-white p-6 sm:p-8 flex flex-col justify-between ${
                  i === bannerIndex ? 'pointer-events-auto' : 'pointer-events-none'
                }`}
              >
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${b.tagBg}`}>
                    {b.badge}
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight drop-shadow-md">
                    {b.title}
                  </h2>
                  <p className="text-xs sm:text-base font-normal opacity-90 mt-2 max-w-xl">
                    {b.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setMainCategory('Restaurantes')}
                    className="bg-[#38B000] hover:bg-[#70E000] text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-full transition shadow-lg flex items-center gap-2 active:scale-95"
                    style={{ fontWeight: 600 }}
                  >
                    Ver ofertas <ArrowRight className="h-4 w-4" />
                  </button>
                  <span className="text-5xl sm:text-7xl select-none">{b.image}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {HERO_BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === bannerIndex ? 'w-6 bg-[#008000]' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── PROMOTED BRANDS ("Famosos no MIAR") ─────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-white">Famosos no MIAR</h2>
            <button
              onClick={() => setMainCategory('Restaurantes')}
              className="text-xs font-bold text-[#008000] hover:underline"
            >
              Ver mais
            </button>
          </div>

          <div ref={promotedBrandsDrag.ref} {...promotedBrandsDrag.dragProps} className={`flex gap-4 overflow-x-auto pb-2 no-scrollbar ${promotedBrandsDrag.dragProps.className}`}>
            {PROMOTED_BRANDS.map((brand) => (
              <motion.button
                key={brand.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => {
                  const found = restaurants.find((r) =>
                    r.name.toLowerCase().includes(brand.name.toLowerCase())
                  );
                  if (found) onSelectRestaurant(found);
                  else if (restaurants.length > 0) onSelectRestaurant(restaurants[0]);
                }}
                className="flex items-center gap-3.5 bg-[#16301F] border border-[#0B1A10] hover:border-[#008000] p-3.5 rounded-2xl shadow-md min-w-[240px] shrink-0 text-left transition"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0B1A10] text-2xl shrink-0">
                  {brand.logo}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate" style={{ fontWeight: 500 }}>
                    {brand.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{brand.info}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                    <span className="flex items-center gap-0.5 text-[#008000]">
                      <Star className="h-3.5 w-3.5 fill-current" /> {brand.rating}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300">{brand.distance}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── FILTER PILLS & ACTION BAR ────────────────────────────────────── */}
        <div ref={restaurantRowDrag.ref} {...restaurantRowDrag.dragProps} className={`mb-6 overflow-x-auto pb-1 no-scrollbar ${restaurantRowDrag.dragProps.className}`}>
          <div className="flex gap-2 text-xs font-semibold">
            <button
              onClick={() => setShowFilterModal(true)}
              className="flex items-center gap-1.5 bg-[#0B1A10] border border-[#0B1A10] hover:border-[#008000] px-4 py-2 rounded-full text-white shadow-sm transition"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#008000]" />
              <span>Filtros</span>
            </button>

            <button
              onClick={() => {
                setFilterTab('basicos');
                setShowFilterModal(true);
              }}
              className="flex items-center gap-1 bg-[#16301F] border border-[#0B1A10] hover:border-[#008000] px-4 py-2 rounded-full text-slate-200 transition"
            >
              <span>Ordenar</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#008000]" />
            </button>

            <button
              onClick={() => setOnlyFreeDelivery(!onlyFreeDelivery)}
              className={`flex items-center gap-1 px-4 py-2 rounded-full border transition ${
                onlyFreeDelivery
                  ? 'bg-[#38B000] text-white border-[#38B000]'
                  : 'bg-[#16301F] text-slate-200 border-[#0B1A10] hover:border-[#008000]'
              }`}
            >
              <span>Entrega Grátis</span>
            </button>

            <button
              onClick={() => {
                setFilterTab('pagamentos');
                setShowFilterModal(true);
              }}
              className="flex items-center gap-1 bg-[#16301F] border border-[#0B1A10] hover:border-[#008000] px-4 py-2 rounded-full text-slate-200 transition"
            >
              <span>Vale-refeição</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#008000]" />
            </button>

            {(selectedSubCategory || onlyFreeDelivery || sortBy !== 'padrao') && (
              <button
                onClick={() => {
                  setSelectedSubCategory(null);
                  setOnlyFreeDelivery(false);
                  setSortBy('padrao');
                  setMaxDistance(20);
                }}
                className="bg-[#0B1A10] text-slate-200 hover:text-white px-4 py-2 rounded-full transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* ── ACTIVE ORDER STATUS BANNER ───────────────────────────────────── */}
        {activeOrder && (
          <button
            onClick={onOpenTracking}
            className="mb-6 flex w-full items-center gap-4 bg-[#16301F] border border-[#38B000] p-4 rounded-2xl shadow-xl hover:bg-[#16301F] transition text-left"
          >
            <Loader2 className="h-6 w-6 animate-spin text-[#38B000] shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[#008000]">
                Pedido em andamento
              </p>
              <p className="text-base font-bold text-white">{activeOrder.restaurantName}</p>
              <p className="text-xs text-slate-300">Toque para acompanhar o status em tempo real →</p>
            </div>
            <MessageCircle className="h-6 w-6 text-[#38B000] shrink-0" />
          </button>
        )}

        {/* ── REPEAT LAST ORDER CARD ──────────────────────────────────────── */}
        {lastOrder && !activeOrder && (
          <div className="mb-6 flex items-center justify-between bg-[#16301F] border border-[#0B1A10] p-4 rounded-2xl shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1A10] text-xl text-[#008000]">
                🔁
              </div>
              <div>
                <p className="text-xs font-bold text-white">Pedir de novo</p>
                <p className="text-xs text-slate-400">
                  {lastOrder.restaurantName} • <span className="text-[#008000] font-bold">R$ {lastOrder.total.toFixed(2)}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (user?.isGuest) {
                  onRequireLogin();
                  return;
                }
                const r = restaurants.find((x) => x.id === lastOrder.restaurantId);
                if (r) onSelectRestaurant(r);
              }}
              className="bg-[#38B000] hover:bg-[#70E000] text-white font-semibold text-xs px-4 py-2 rounded-full transition shadow-md"
              style={{ fontWeight: 600 }}
            >
              Pedir
            </button>
          </div>
        )}

        {/* ── STORES / RESTAURANTS GRID HEADER ─────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {selectedSubCategory ? `Lojas de ${selectedSubCategory}` : 'Lojas no MIAR'}
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {sortedRestaurants.length} estabelecimentos
          </span>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-[#16301F] border border-[#0B1A10] p-4 rounded-2xl flex gap-3"
              >
                <div className="h-16 w-16 rounded-2xl bg-[#0B1A10]/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#0B1A10]/60 rounded w-1/2" />
                  <div className="h-3 bg-[#0B1A10]/60 rounded w-3/4" />
                  <div className="h-3 bg-[#0B1A10]/60 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty Search State */}
        {!loading && sortedRestaurants.length === 0 && (
          <div className="bg-[#16301F] border border-[#0B1A10] p-8 rounded-3xl text-center my-6 shadow-md">
            <div className="text-5xl mb-3">🍽️</div>
            <p className="font-bold text-white text-base">Nenhum estabelecimento encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Tente buscar por outros termos ou limpar os filtros selecionados.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedSubCategory(null);
                setOnlyFreeDelivery(false);
              }}
              className="mt-4 bg-[#38B000] text-white font-semibold text-xs px-5 py-2.5 rounded-full shadow-md hover:bg-[#70E000] transition"
              style={{ fontWeight: 600 }}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* Store Cards Responsive Grid (1 col on mobile, 2 col on tablet, 3-4 col on desktop PC) */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedRestaurants.map((r) => {
              const isFav = favorites.includes(r.id);
              const segmentName = seg(r) || 'Restaurante';
              const distanceKm = r.distance ? `${r.distance.toFixed(1)} km` : '1.9 km';
              const deliveryTime = r.waitTime ? `${r.waitTime}-${r.waitTime + 10} min` : '35-45 min';
              const deliveryFee = r.pricePerPerson === 0 || r.distance === 0 ? 'Grátis' : 'R$ 3,99';

              return (
                <motion.div
                  key={r.id}
                  whileHover={{ scale: 1.01 }}
                  className="group bg-[#16301F] border border-[#0B1A10] hover:border-[#008000] p-4 rounded-2xl shadow-lg transition flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div onClick={() => onSelectRestaurant(r)} className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Store Logo / Avatar */}
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0B1A10] text-2xl font-bold text-[#008000] border border-[#008000]/30 shadow-md">
                      {r.name.charAt(0)}
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#38B000] text-white text-[9px] font-bold">
                        ★
                      </span>
                    </div>

                    {/* Store Info */}
                    <div className="min-w-0">
                      <h3
                        className="font-medium text-white text-base truncate group-hover:text-[#008000] transition"
                        style={{ fontWeight: 500 }}
                      >
                        {r.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-0.5">
                        <span className="flex items-center gap-0.5 text-[#008000] font-bold" style={{ fontWeight: 700 }}>
                          <Star className="h-3.5 w-3.5 fill-current" /> {r.rating ?? '4.7'}
                        </span>
                        <span className="text-slate-500">•</span>
                        <span className="capitalize truncate">{segmentName}</span>
                        <span className="text-slate-500">•</span>
                        <span>{distanceKm}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mt-1">
                        <span>{deliveryTime}</span>
                        <span className="text-slate-500">•</span>
                        <span className={deliveryFee === 'Grátis' ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                          {deliveryFee}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Favorite Toggle Button */}
                  <button
                    onClick={() => handleToggleFav(r.id)}
                    className="p-2.5 rounded-full hover:bg-[#0B1A10] text-slate-400 hover:text-[#38B000] transition shrink-0"
                  >
                    {isFav ? (
                      <Heart className="h-5 w-5 fill-[#38B000] text-[#38B000]" />
                    ) : (
                      <HeartOff className="h-5 w-5 opacity-60" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── PWA INSTALL PROMO CARD ────────────────────────────────────────── */}
        <div className="mt-10 mb-8 bg-[#16301F] border border-[#0B1A10] text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#38B000] text-white text-3xl">
              📱
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Adicione o MIAR à tela inicial</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Aproveite a experiência completa do MIAR em seu aplicativo.
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              alert(
                'Para instalar no celular, abra as opções do navegador e toque em "Adicionar à Tela Inicial".'
              )
            }
            className="bg-[#38B000] hover:bg-[#70E000] text-white font-semibold text-xs px-5 py-2.5 rounded-full shadow-md shrink-0 transition"
            style={{ fontWeight: 600 }}
          >
            Adicionar
          </button>
        </div>
      </main>

      {/* ── ADDRESS SELECTOR & GPS MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16301F] border border-[#0B1A10] rounded-3xl max-w-md w-full p-6 shadow-2xl text-white relative"
            >
              {/* Close Button 'X' */}
              <button
                onClick={() => setShowAddressModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-black/30"
              >
                <X className="h-5 w-5" />
              </button>

              <h3 className="text-lg font-bold text-white mb-1">Onde você quer receber seu pedido?</h3>
              <p className="text-xs text-slate-300 mb-4">
                Informe sua localização para encontrar os restaurantes da sua região
              </p>

              {/* Address Search Input */}
              <div className="relative mb-4">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="Rua, número, bairro ou CEP"
                  className="w-full bg-[#06100A] border border-[#0B1A10] text-white placeholder-slate-400 pl-10 pr-4 py-2.5 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#008000]"
                />
              </div>

              {/* Use GPS High Accuracy Button */}
              <button
                onClick={handleGetGpsLocation}
                disabled={locatingGps}
                className="w-full flex items-center justify-center gap-2.5 bg-[#0B1A10] hover:bg-[#800512] text-white font-bold text-xs p-3 rounded-2xl transition mb-4 border border-[#008000]/40"
              >
                {locatingGps ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#008000]" />
                ) : (
                  <Navigation className="h-4 w-4 text-[#008000]" />
                )}
                <span>{locatingGps ? 'Obtendo localização via GPS...' : 'Usar minha localização exata (GPS)'}</span>
              </button>

              {/* Saved Addresses List */}
              <div className="space-y-2 mb-5">
                <p className="text-[11px] font-bold uppercase text-[#008000]/80 tracking-wider">
                  Endereços salvos
                </p>
                {['Próximo de Putim', 'Rua Andromeda, 450 - Jd. Satélite', 'Av. Brasil, 1200'].map((addr) => (
                  <button
                    key={addr}
                    onClick={() => {
                      setDeliveryAddress(addr);
                      setShowAddressModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left text-xs font-semibold transition ${
                      deliveryAddress === addr
                        ? 'border-[#008000] bg-[#0B1A10] text-white'
                        : 'border-[#0B1A10] bg-[#06100A] text-slate-300 hover:border-[#008000]/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#008000] shrink-0" />
                      <span className="truncate">{addr}</span>
                    </div>
                    {deliveryAddress === addr && <Check className="h-4 w-4 text-[#008000] shrink-0" />}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (addressInput.trim()) {
                    setDeliveryAddress(addressInput.trim());
                    setShowAddressModal(false);
                  }
                }}
                className="w-full bg-[#38B000] hover:bg-[#70E000] text-white font-semibold text-sm py-3 rounded-2xl shadow-lg transition"
                style={{ fontWeight: 600 }}
              >
                Confirmar Endereço
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FILTER MODAL ("FILTROS") ──────────────────────────────────────── */}
      <AnimatePresence>
        {showFilterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-[#16301F] border border-[#0B1A10] rounded-3xl max-w-md w-full p-6 shadow-2xl text-white relative max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button 'X' */}
              <button
                onClick={() => setShowFilterModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-black/30"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center justify-between border-b border-[#0B1A10] pb-3 mb-4 pr-8">
                <h3 className="text-lg font-bold text-white">Filtros</h3>
                <button
                  onClick={() => {
                    setSelectedSubCategory(null);
                    setOnlyFreeDelivery(false);
                    setSortBy('padrao');
                  }}
                  className="text-xs font-bold text-[#008000] hover:underline"
                >
                  Limpar todos
                </button>
              </div>

              {/* Filter Tabs Header */}
              <div className="flex border-b border-[#0B1A10] mb-5">
                {[
                  { id: 'basicos', label: 'Básicos' },
                  { id: 'categorias', label: 'Categorias' },
                  { id: 'pagamentos', label: 'Pagamentos' },
                ].map((ft) => (
                  <button
                    key={ft.id}
                    onClick={() => setFilterTab(ft.id as any)}
                    className={`flex-1 pb-2.5 text-xs font-bold text-center transition border-b-2 ${
                      filterTab === ft.id ? 'border-[#008000] text-[#008000]' : 'border-transparent text-slate-400'
                    }`}
                  >
                    {ft.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Básicos */}
              {filterTab === 'basicos' && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">Modo de entrega</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDeliveryMode('entrega')}
                        className={`py-2.5 rounded-full text-xs font-bold transition border ${
                          deliveryMode === 'entrega'
                            ? 'bg-[#0B1A10] border-[#008000] text-white'
                            : 'bg-[#06100A] border-[#0B1A10] text-slate-300'
                        }`}
                      >
                        Entrega
                      </button>
                      <button
                        onClick={() => setDeliveryMode('retirar')}
                        className={`py-2.5 rounded-full text-xs font-bold transition border ${
                          deliveryMode === 'retirar'
                            ? 'bg-[#0B1A10] border-[#008000] text-white'
                            : 'bg-[#06100A] border-[#0B1A10] text-slate-300'
                        }`}
                      >
                        Pra retirar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-3">Ordenar por</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'padrao', label: 'Ordenação Padrão', icon: ArrowUpDown },
                        { id: 'preco', label: 'Preço', icon: DollarSign },
                        { id: 'avaliacao', label: 'Avaliação', icon: Star },
                        { id: 'tempo', label: 'Tempo de Entrega', icon: Clock },
                        { id: 'taxa', label: 'Taxa de Entrega', icon: Bike },
                        { id: 'distancia', label: 'Menor distância', icon: Navigation },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSel = sortBy === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSortBy(item.id as any)}
                            className="flex flex-col items-center gap-1.5 p-2 text-center"
                          >
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                                isSel
                                  ? 'bg-[#0B1A10] border-[#008000] text-[#008000]'
                                  : 'bg-[#06100A] border-[#0B1A10] text-slate-400'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className={`text-[11px] font-bold leading-tight ${isSel ? 'text-[#008000]' : 'text-slate-300'}`}>
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-300">Distância máxima</span>
                      <span className="text-[#008000]">{maxDistance} km</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(Number(e.target.value))}
                      className="w-full accent-[#38B000]"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Categorias */}
              {filterTab === 'categorias' && (
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {SUBCATEGORIES_RESTAURANTES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedSubCategory(cat.label)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center gap-2 transition ${
                        selectedSubCategory === cat.label
                          ? 'border-[#008000] bg-[#0B1A10] text-white'
                          : 'border-[#0B1A10] bg-[#06100A] text-slate-300 hover:border-[#008000]/40'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tab 3: Pagamentos */}
              {filterTab === 'pagamentos' && (
                <div className="space-y-2">
                  {['Pix no Checkout', 'Cartão de Crédito', 'Vale-Refeição (VR/VA)', 'Dinheiro'].map((pay) => (
                    <div
                      key={pay}
                      className="flex items-center justify-between p-3 rounded-2xl border border-[#0B1A10] bg-[#06100A]"
                    >
                      <span className="text-xs font-bold text-slate-200">{pay}</span>
                      <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#38B000]" />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowFilterModal(false)}
                className="mt-6 w-full bg-[#38B000] hover:bg-[#70E000] text-white font-semibold text-sm py-3 rounded-2xl shadow-lg transition"
                style={{ fontWeight: 600 }}
              >
                Ver resultados ({sortedRestaurants.length})
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── HUMAN CAPTCHA MODAL ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showCaptchaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#16301F] border border-[#0B1A10] rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative text-white"
            >
              {/* Close Button 'X' */}
              <button
                onClick={() => setShowCaptchaModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full bg-black/30"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[#0B1A10] text-5xl">
                🛸
              </div>

              <h3 className="text-xl font-bold text-white mb-2">Antes de continuarmos...</h3>
              <p className="text-xs text-slate-300 mb-6 font-medium leading-relaxed">
                Pressione e segure para confirmar que você é um humano (e não um bot).
              </p>

              <div className="relative mx-auto w-full max-w-[220px]">
                <button
                  onMouseDown={() => setCaptchaHolding(true)}
                  onMouseUp={() => setCaptchaHolding(false)}
                  onMouseLeave={() => setCaptchaHolding(false)}
                  onTouchStart={() => setCaptchaHolding(true)}
                  onTouchEnd={() => setCaptchaHolding(false)}
                  className="relative w-full overflow-hidden border-2 border-[#008000] text-[#008000] font-bold text-sm py-3 rounded-full shadow-md active:scale-95 transition"
                >
                  <div
                    className="absolute inset-0 bg-[#008000] transition-all duration-75"
                    style={{ width: `${captchaProgress}%` }}
                  />
                  <span className={`relative z-10 ${captchaProgress > 50 ? 'text-[#06100A] font-black' : 'text-[#008000]'}`}>
                    {captchaProgress >= 100 ? 'Confirmado! ✓' : 'Pressione e segure'}
                  </span>
                </button>
              </div>

              <p className="text-[10px] text-slate-500 mt-6 font-mono">
                MIAR Security Bot Protection
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── QR CODE MESA READER MODAL ────────────────────────────────────── */}
      {lerQR && (
        <LeitorQR
          onSuccess={(mesa) => {
            setMesaLida(mesa);
            setLerQR(false);
          }}
          onClose={() => setLerQR(false)}
          onFechar={() => setLerQR(false)}
        />
      )}

      {/* ── PRODUCT DETAIL MODAL ──────────────────────────────────────────── */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(item, qty, obs, adicionais, ingredientesRemovidos) => {
            const adicionaisTexto = adicionais.length > 0 ? ` + ${adicionais.map((a) => a.label).join(', ')}` : '';
            const semTexto = ingredientesRemovidos.length > 0 ? ` sem ${ingredientesRemovidos.join(', ')}` : '';
            alert(`Adicionado ao carrinho: ${qty}x ${item.name}${adicionaisTexto}${semTexto} ${obs ? `(${obs})` : ''}`);
          }}
        />
      )}
    </div>
  );
}
