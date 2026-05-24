import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import type { Database } from '@/integrations/supabase/types';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string | null;
  image_url: string | null;
  is_active: boolean;
}

type ProductOrderItem = Database['public']['Tables']['agenda_product_order_items']['Row'];
type ProductOrder = Database['public']['Tables']['agenda_product_orders']['Row'] & {
  agenda_product_order_items?: ProductOrderItem[];
};

interface ProductSalesTabProps {
  products: Product[];
}

const paymentLabel = (method: string, status: string) => {
  if (method === 'pix') {
    return status === 'paid' ? 'Pix confirmado' : 'Pix aguardando confirmacao';
  }

  return 'Pagar no local';
};

export function ProductSalesTab({ products }: ProductSalesTabProps) {
  const { settings } = useAgendaBranding();
  const [orders, setOrders] = useState<ProductOrder[]>([]);

  const totalProducts = products.length;
  const totalStock = products.reduce((sum, p) => sum + p.stock_quantity, 0);
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5);
  const outOfStock = products.filter(p => p.stock_quantity <= 0);
  const pendingPixOrders = orders.filter((order) => order.payment_method === 'pix' && order.payment_status !== 'paid');

  const fetchOrders = useCallback(async () => {
    if (!settings.storeAccountId) {
      setOrders([]);
      return;
    }

    const { data } = await supabase
      .from('agenda_product_orders')
      .select(`
        id,
        store_account_id,
        owner_user_id,
        client_id,
        client_name,
        client_phone,
        payment_method,
        payment_status,
        order_status,
        total_amount,
        notes,
        created_at,
        updated_at,
        agenda_product_order_items (
          id,
          order_id,
          product_id,
          product_name,
          unit_price,
          quantity,
          line_total,
          created_at
        )
      `)
      .eq('store_account_id', settings.storeAccountId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setOrders(data as ProductOrder[]);
  }, [settings.storeAccountId]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!settings.storeAccountId) return;

    const channel = supabase
      .channel(`agenda-product-orders-admin-${settings.storeAccountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_product_orders',
          filter: `store_account_id=eq.${settings.storeAccountId}`,
        },
        () => {
          void fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, settings.storeAccountId]);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produtos</p>
                <p className="text-3xl font-bold">{totalProducts}</p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Estoque</p>
                <p className="text-3xl font-bold">{totalStock}</p>
                <p className="text-xs text-muted-foreground">unidades total</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <ShoppingCart className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos</p>
                <p className="text-3xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">{pendingPixOrders.length} Pix pendentes</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <CalendarClock className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estoque Baixo</p>
                <p className="text-3xl font-bold text-amber-500">{lowStock.length}</p>
                <p className="text-xs text-muted-foreground">{outOfStock.length} esgotados</p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Pedidos recentes</h3>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum pedido de produto registrado ainda.
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent className="py-4 px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{order.client_name}</span>
                      <Badge variant={order.payment_method === 'pix' ? 'default' : 'secondary'}>
                        {paymentLabel(order.payment_method, order.payment_status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {order.client_phone ? ` - ${order.client_phone}` : ''}
                    </p>
                    <div className="mt-3 space-y-1 text-sm">
                      {(order.agenda_product_order_items || []).map((item) => (
                        <div key={item.id} className="flex justify-between gap-3">
                          <span>{item.quantity}x {item.product_name}</span>
                          <span className="font-medium">R$ {Number(item.line_total).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">R$ {Number(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Inventário de Produtos</h3>
        {products.map(product => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
                    {product.category && <Badge variant="secondary" className="text-[10px]">{product.category}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">R$ {product.price.toFixed(2)}</div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={product.stock_quantity <= 0 ? 'destructive' : product.stock_quantity <= 5 ? 'secondary' : 'default'}>
                    {product.stock_quantity <= 0 ? 'Esgotado' : `${product.stock_quantity} un`}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
