import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { KdsOrder, KdsOrderStatus } from '../types';

export function useKdsOrders(locationId?: string) {
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .neq('status', 'cancelled')
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

    // Supabase Realtime Subscription for instantaneous order updates
    const channel = supabase
      .channel('kds-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_orders' },
        () => {
          void fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'food_order_items' },
        () => {
          void fetchOrders();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

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
