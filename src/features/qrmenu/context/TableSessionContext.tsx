import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { MenuItem, TableInfo, StepperAnswers, CartItem } from '../types';
import { guestKey, cartKey, lsGet, lsSet, stepperKey } from '../lib/storage';

export interface TableSessionContextType {
  qrToken: string;
  ready: boolean;
  error: string | null;
  establishmentName: string;
  table: TableInfo | null;
  products: MenuItem[];
  sessionOpen: boolean;
  guestToken: string | null;
  stepperAnswers: StepperAnswers | null;
  cart: CartItem[];
  ownOrders: Array<{
    id: string;
    total: number;
    status: string;
    createdAt: string;
    items: Array<{ product_name: string; quantity: number; total: number; notes?: string; status: string }>;
  }>;
  tableTotal: number;
  setStepperAnswers: (answers: StepperAnswers | null) => void;
  updateCart: (cart: CartItem[] | ((prev: CartItem[]) => CartItem[])) => void;
  callWaiter: () => Promise<{ success: boolean; alreadyOpen?: boolean; error?: string }>;
  submitOrder: (items: Array<{ productId: string; quantity: number; notes?: string }>) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  refresh: () => Promise<void>;
}

const TableSessionContext = createContext<TableSessionContextType | null>(null);

const fetchCatalogProducts = async (): Promise<MenuItem[]> => {
  try {
    const db = supabase as any;
    const [prodRes, menuRes] = await Promise.all([
      db.from('products').select('id, name, category, price').eq('deleted', false).order('name'),
      db.from('food_menu_products').select('product_id, description, image_url, active, featured, sort_order'),
    ]);

    if (prodRes.error || !prodRes.data) return [];

    const menuEntriesMap = new Map((menuRes.data || []).map((e: any) => [e.product_id, e]));

    const result: MenuItem[] = [];
    for (const prod of prodRes.data) {
      const entry = menuEntriesMap.get(prod.id);

      // If explicit menu entry exists and is set to active = false, hide from QR menu
      if (entry && entry.active === false) {
        continue;
      }

      result.push({
        id: prod.id,
        name: prod.name,
        category: prod.category?.trim() || 'Geral',
        price: Number(prod.price || 0),
        description: entry?.description || '',
        imageUrl: entry?.image_url || '',
        featured: Boolean(entry?.featured),
      });
    }

    return result;
  } catch (err) {
    console.error('Error fetching catalog products for QR menu:', err);
    return [];
  }
};

export function TableSessionProvider({
  qrToken,
  children,
}: {
  qrToken: string;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState(() => localStorage.getItem('qrmenu_store_name') || 'Miaifood Bistro');
  const [table, setTable] = useState<TableInfo | null>(null);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(() => lsGet<string | null>(guestKey(qrToken), null));
  const [stepperAnswers, setStepperAnswersState] = useState<StepperAnswers | null>(() => lsGet<StepperAnswers | null>(stepperKey(qrToken), null));
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [ownOrders, setOwnOrders] = useState<TableSessionContextType['ownOrders']>([]);
  const [tableTotal, setTableTotal] = useState(0);

  // Initialize cart from localStorage once guestToken is resolved
  useEffect(() => {
    if (guestToken) {
      setCartState(lsGet<CartItem[]>(cartKey(qrToken, guestToken), []));
    }
  }, [qrToken, guestToken]);

  const updateCart = useCallback((action: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setCartState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (guestToken) {
        lsSet(cartKey(qrToken, guestToken), next);
      }
      return next;
    });
  }, [qrToken, guestToken]);

  const setStepperAnswers = useCallback((answers: StepperAnswers | null) => {
    setStepperAnswersState(answers);
    lsSet(stepperKey(qrToken), answers);
  }, [qrToken]);

  const resolveSession = useCallback(async () => {
    if (!qrToken) {
      setError('QR Code não informado.');
      setReady(true);
      return;
    }
    setError(null);
    try {
      // First try fetching real catalog products from Supabase
      const dbProducts = await fetchCatalogProducts();

      const { data, error: invokeErr } = await supabase.functions.invoke('food-qrmenu', {
        body: { action: 'resolve', token: qrToken, guestToken },
      });

      // O token "demo" é o único caminho explicitamente de demonstração.
      // Falhas reais não podem abrir uma mesa fictícia nem inventar produtos.
      if (qrToken === 'demo') {
        const storedName = localStorage.getItem('qrmenu_store_name');
        setEstablishmentName(storedName || 'Miaifood Bistro');
        setTable({ code: 'MESA-01', name: 'Mesa 01' });

        if (dbProducts.length > 0) {
          setProducts(dbProducts);
        } else {
          // Demo fallback items if store has no products yet
          setProducts([
            {
              id: 'demo-1',
              name: 'Hambúrguer Smash Artisan',
              description: 'Pão brioche, 2x smash burger 90g, queijo cheddar derretido, bacon crocante e maionese da casa.',
              price: 38.9,
              category: 'Hambúrgueres',
              imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
              featured: true,
            },
            {
              id: 'demo-2',
              name: 'Pizza Margherita Especial',
              description: 'Molho de tomate italiano, muçarela de búfala, manjericão fresco e azeite extravirgem.',
              price: 54.0,
              category: 'Pizzas',
              imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80',
              featured: true,
            },
            {
              id: 'demo-3',
              name: 'Batata Rústica Trufada',
              description: 'Porção de batatas rústicas com maionese trufada e parmesão ralado.',
              price: 28.0,
              category: 'Porções',
              imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
            },
            {
              id: 'demo-4',
              name: 'Suco Natural de Laranja 500ml',
              description: 'Feito na hora com laranjas selecionadas.',
              price: 12.0,
              category: 'Bebidas',
              imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
            },
            {
              id: 'demo-5',
              name: 'Petit Gâteau com Sorvete',
              description: 'Bolo quente de chocolate belga com sorvete de creme de baunilha.',
              price: 24.0,
              category: 'Sobremesas',
              imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
            },
          ]);
        }

        setSessionOpen(true);
        if (!guestToken) setGuestToken('guest-demo-123');
        setError(null);
        setReady(true);
        return;
      }

      if (invokeErr || !data || data.error) {
        throw new Error(data?.error || invokeErr?.message || 'QR Code inválido.');
      }

      setEstablishmentName(data.establishmentName || localStorage.getItem('qrmenu_store_name') || 'Miaifood');
      setTable(data.table || null);

      if (dbProducts.length > 0) {
        setProducts(dbProducts);
      } else if (data.products && data.products.length > 0) {
        setProducts(
          data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: Number(p.price || 0),
            category: p.category || 'Outros',
            imageUrl: p.image_url || p.imageUrl || '',
            featured: Boolean(p.featured),
          }))
        );
      }

      setSessionOpen(Boolean(data.sessionOpen));
      setOwnOrders(data.ownOrders || []);
      setTableTotal(Number(data.tableTotal || 0));

      // Ensure guest session is established if table session is open
      if (data.sessionOpen && !guestToken) {
        const appetiteMap: Record<string, string> = { pouca: 'low', moderada: 'moderate', muita: 'high' };
        const moodMap: Record<string, string> = { tranquilo: 'calm', 'com-pressa': 'fast', irritado: 'suggestions' };

        const { data: startData } = await supabase.functions.invoke('food-qrmenu', {
          body: {
            action: 'start_guest',
            token: qrToken,
            appetiteLevel: stepperAnswers ? appetiteMap[stepperAnswers.hunger] : null,
            experienceMode: stepperAnswers ? moodMap[stepperAnswers.mood] : null,
            partySizeHint: stepperAnswers ? stepperAnswers.headcount : null,
          },
        });

        if (startData?.guestToken) {
          setGuestToken(startData.guestToken);
          lsSet(guestKey(qrToken), startData.guestToken);
        }
      }
    } catch (err: any) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setReady(true);
    }
  }, [qrToken, guestToken, stepperAnswers]);

  useEffect(() => {
    void resolveSession();
  }, [resolveSession]);

  const callWaiter = useCallback(async () => {
    if (!qrToken || !guestToken) {
      return { success: false, error: 'Sessão da mesa indisponível.' };
    }
    const { data, error: err } = await supabase.functions.invoke('food-qrmenu', {
      body: { action: 'call_waiter', token: qrToken, guestToken },
    });
    if (err || !data || data.error) {
      return { success: false, error: data?.error || 'Erro ao chamar garçom.' };
    }
    return { success: true, alreadyOpen: Boolean(data.alreadyOpen) };
  }, [qrToken, guestToken]);

  const submitOrder = useCallback(
    async (items: Array<{ productId: string; quantity: number; notes?: string }>) => {
      if (!qrToken || !guestToken) {
        return { success: false, error: 'Sessão da mesa indisponível.' };
      }
      const { data, error: err } = await supabase.functions.invoke('food-qrmenu', {
        body: { action: 'submit', token: qrToken, guestToken, items },
      });
      if (!err && data?.code === 'GUEST_SESSION_REFRESH') {
        const { data: renewed } = await supabase.functions.invoke('food-qrmenu', { body: { action: 'start_guest', token: qrToken } });
        if (renewed?.guestToken) {
          setGuestToken(renewed.guestToken);
          lsSet(guestKey(qrToken), renewed.guestToken);
          const retry = await supabase.functions.invoke('food-qrmenu', { body: { action: 'submit', token: qrToken, guestToken: renewed.guestToken, items } });
          if (!retry.error && retry.data?.success) { updateCart([]); await resolveSession(); return { success: true, orderId: retry.data.orderId }; }
          return { success: false, error: retry.data?.error || 'Não foi possível enviar o pedido.' };
        }
      }
      if (err || !data || !data.success) {
        return { success: false, error: data?.error || 'Erro ao registrar o pedido.' };
      }
      // Clear local cart upon successful submit
      updateCart([]);
      await resolveSession();
      return { success: true, orderId: data.orderId };
    },
    [qrToken, guestToken, updateCart, resolveSession]
  );

  const value = useMemo(
    () => ({
      qrToken,
      ready,
      error,
      establishmentName,
      table,
      products,
      sessionOpen,
      guestToken,
      stepperAnswers,
      cart,
      ownOrders,
      tableTotal,
      setStepperAnswers,
      updateCart,
      callWaiter,
      submitOrder,
      refresh: resolveSession,
    }),
    [
      qrToken,
      ready,
      error,
      establishmentName,
      table,
      products,
      sessionOpen,
      guestToken,
      stepperAnswers,
      cart,
      ownOrders,
      tableTotal,
      setStepperAnswers,
      updateCart,
      callWaiter,
      submitOrder,
      resolveSession,
    ]
  );

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const ctx = useContext(TableSessionContext);
  if (!ctx) {
    throw new Error('useTableSession deve ser usado dentro de TableSessionProvider');
  }
  return ctx;
}
