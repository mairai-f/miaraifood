export type KdsOrderStatus = 'submitted' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface KdsOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  status?: string;
}

export interface KdsOrder {
  id: string;
  tableSessionId?: string;
  tableCode: string;
  tableName?: string;
  status: KdsOrderStatus;
  source: 'qrmenu' | 'waiter' | 'pos';
  subtotal: number;
  total: number;
  createdAt: string;
  submittedAt?: string;
  items: KdsOrderItem[];
  placedBy?: {
    type: 'client' | 'waiter';
    name?: string;
  };
}

export type KdsColumn = 'submitted' | 'preparing' | 'ready';
