import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { KdsOrder, KdsOrderStatus } from '../types';

export function useKdsOrders(locationId?: string) {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const db = supabase as any;
      let query = db
        .from('food_orders')
        .select(`
          id,
          table_session_id,
          source,
          status,
          subtotal,
          total,
          created_at,
          submitted_at,
          table_session:food_table_sessions (
            id,
            table:food_tables (
              code,
              name
            )
          ),
          items:food_order_items (
            id,
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total,
            notes,
            status
          )
        `)
        // A tela so renderiza estas tres colunas; buscar 'delivered' e
        // 'cancelled' significava baixar todo o historico do restaurante a
        // cada evento do Realtime, so para descartar no cliente.
        .in('status', ['submitted', 'preparing', 'ready'])
        .order('created_at', { ascending: false });

      if (locationId) {
        query = query.eq('location_id', locationId);
      }

      const { data, error: err } = await query;

      if (err) {
        throw err;
      }

      const mapped: KdsOrder[] = (data || []).map((o: any) => {
        const tableObj = o.table_session?.table;
        const tableCode = tableObj?.code || 'MESA';
        const tableName = tableObj?.name || tableCode;

        return {
          id: o.id,
          tableSessionId: o.table_session_id,
          tableCode,
          tableName,
          status: (o.status as KdsOrderStatus) || 'submitted',
          source: o.source === 'qrmenu' ? 'qrmenu' : 'waiter',
          subtotal: Number(o.subtotal || 0),
          total: Number(o.total || 0),
          createdAt: o.created_at,
          submittedAt: o.submitted_at,
          placedBy: o.source === 'qrmenu' ? { type: 'client' } : { type: 'waiter', name: 'Garçom' },
          items: (o.items || []).map((i: any) => ({
            id: i.id,
            orderId: i.order_id,
            productId: i.product_id,
            productName: i.product_name,
            quantity: Number(i.quantity || 1),
            unitPrice: Number(i.unit_price || 0),
            total: Number(i.total || 0),
            notes: i.notes || '',
            status: i.status || 'pending',
          })),
        };
      });

      knownOrderIdsRef.current = new Set(mapped.map((o) => o.id));
      setOrders(mapped);
    } catch (err: any) {
      console.error('Erro ao carregar pedidos do KDS:', err);
      setError('Não foi possível carregar os pedidos da cozinha.');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void fetchOrders();

    // Um pedido com 10 itens gerava 10 recargas completas. Agrupamos a rajada
    // numa unica consulta.
    const scheduleRefetch = () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        void fetchOrders();
      }, 400);
    };

    // Sem filtro, qualquer pedido de qualquer loja acordava esta cozinha.
    const orderFilter = locationId ? { filter: `location_id=eq.${locationId}` } : {};

    const channel = supabase
      .channel(`kds-orders-changes:${locationId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_orders', ...orderFilter },
        () => {
          scheduleRefetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_order_items' },
        (payload: { new?: { order_id?: string }; old?: { order_id?: string } }) => {
          // food_order_items nao tem location_id para filtrar no servidor:
          // descartamos aqui o que nao pertence a um pedido em tela, sem
          // gastar uma consulta.
          const orderId = payload.new?.order_id ?? payload.old?.order_id;
          if (orderId && !knownOrderIdsRef.current.has(orderId)) return;
          scheduleRefetch();
        }
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders, locationId]);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: KdsOrderStatus) => {
    try {
      const db = supabase as any;
      const { error: err } = await db
        .from('food_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (err) throw err;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao atualizar status no KDS:', err);
      return { success: false, error: 'Não foi possível atualizar o status do pedido.' };
    }
  }, []);

  return {
    orders,
    loading,
    error,
    refresh: fetchOrders,
    updateOrderStatus,
  };
}
