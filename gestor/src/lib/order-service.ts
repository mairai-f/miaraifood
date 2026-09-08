import { supabase } from './supabase-client';

export interface OrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface CreateOrderInput {
  companyId: string;
  tableId?: string;
  waiterUserId?: string;
  cashSessionId?: string;
  customerName?: string;
  type: 'dine_in' | 'counter' | 'delivery' | 'drive_thru';
  paymentMethod: 'cash' | 'pix' | 'credit' | 'debit';
  subtotal: number;
  discount?: number;
  total: number;
  items: OrderItemInput[];
  // Chave de Idempotência enviada pelo cliente (UUID) para evitar duplicatas em reinstâncias de rede
  idempotencyKey?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  message?: string;
  idempotencyKey?: string;
  error?: any;
}

/**
 * Cria e finaliza um pedido no Supabase aplicando Chave de Idempotência.
 * A gravação dos itens em `order_items` ativa automaticamente os gatilhos no PostgreSQL
 * para baixa dos insumos do estoque com base na Ficha Técnica (`recipes`).
 */
export async function createAndCompleteOrder(input: CreateOrderInput): Promise<OrderResult> {
  const idempotencyKey = input.idempotencyKey || `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    // 1. Verifica se a chave de idempotência já existe (venda já processada)
    if (input.idempotencyKey) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, status')
        .eq('company_id', input.companyId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (existingOrder) {
        return {
          success: true,
          orderId: existingOrder.id,
          idempotencyKey: input.idempotencyKey,
          message: 'Venda já finalizada anteriormente (Idempotência confirmada).',
        };
      }
    }

    // 2. Inserir Pedido Principal
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        company_id: input.companyId,
        table_id: input.tableId || null,
        waiter_user_id: input.waiterUserId || null,
        cash_session_id: input.cashSessionId || null,
        customer_name: input.customerName || 'Cliente Balcão',
        type: input.type,
        status: 'completed', // Status finalizado ativa o gatilho de estoque
        subtotal: input.subtotal,
        discount: input.discount || 0,
        total: input.total,
        payment_method: input.paymentMethod,
        idempotency_key: idempotencyKey,
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (orderError) {
      // Se houver conflito de idempotência (violação do índice único)
      if (orderError.code === '23505' && orderError.message.includes('idempotency')) {
        return {
          success: true,
          message: 'Venda já processada por outra requisição (Idempotente).',
          idempotencyKey,
        };
      }
      throw orderError;
    }

    // 3. Inserir Itens do Pedido (Isso aciona o Trigger PostgreSQL de Baixa por Ficha Técnica)
    const orderItemsData = input.items.map((item) => ({
      company_id: input.companyId,
      order_id: newOrder.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.quantity * item.unitPrice,
      notes: item.notes || null,
      status: 'completed', // 'completed' força o abate automático do estoque
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) throw itemsError;

    return {
      success: true,
      orderId: newOrder.id,
      idempotencyKey,
      message: 'Venda finalizada com sucesso! Insumos baixados do estoque via Ficha Técnica.',
    };
  } catch (error: any) {
    console.error('❌ Erro ao criar e finalizar pedido:', error);
    return {
      success: false,
      message: error?.message || 'Erro inesperado ao registrar venda no banco.',
      error,
    };
  }
}

/**
 * Cancela um pedido ou item e aciona o estorno automático de insumos no estoque.
 */
export async function cancelOrder(companyId: string, orderId: string, reason: string = 'Cancelamento pelo caixa'): Promise<OrderResult> {
  try {
    // 1. Atualizar status do pedido para 'canceled'
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
      .eq('id', orderId);

    if (orderError) throw orderError;

    // 2. Atualizar os itens do pedido para 'canceled' (Isso aciona o Trigger PostgreSQL de Estorno)
    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ status: 'canceled' })
      .eq('company_id', companyId)
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    return {
      success: true,
      orderId,
      message: 'Pedido cancelado com sucesso. Insumos estornados de volta ao estoque.',
    };
  } catch (error: any) {
    console.error('❌ Erro ao cancelar pedido:', error);
    return {
      success: false,
      message: error?.message || 'Erro ao cancelar pedido no banco.',
      error,
    };
  }
}
