export type TableStatus = "free" | "occupied" | "closing";
export type OrderStatus = "open" | "sent" | "preparing" | "ready" | "served" | "closing" | "paid";
export type KitchenStatus = "received" | "preparing" | "ready" | "delivered" | "cancelled";
export type Station = "kitchen" | "bar" | "counter";
export type PaymentMethod = "pix" | "debit" | "credit" | "voucher" | "card" | "cash" | "mixed" | "fiado";
export type DeliveryStatus = "new" | "preparing" | "out" | "delivered";
export type FoodRole = "admin" | "waiter" | "cashier" | "kitchen" | "customer";
export type CommissionMode = "percent" | "cash";
export type FoodUnit = "kg" | "litro" | "unidade" | "caixa";
export type StockMovementType = "entrada" | "venda" | "perda" | "producao" | "inventario";
export type TableServiceRequestType = "call_waiter" | "request_bill" | "talk_to_staff";
export type TableServiceRequestStatus = "new" | "acknowledged" | "done" | "cancelled";

export interface FoodTable {
  id: string;
  number: string;
  area: string;
  seats: number;
  status: TableStatus;
  customerName?: string;
  openedAt?: string;
  waiterName?: string;
}

export interface MenuProductSize {
  id: string;
  name: string;
  price: number;
}

export interface MenuProductOptionValue {
  id: string;
  name: string;
  priceDelta: number;
}

export interface MenuProductOptionGroup {
  id: string;
  name: string;
  required: boolean;
  type: "single" | "multiple" | "quantity";
  values: MenuProductOptionValue[];
}

export interface MenuProduct {
  id: string;
  code: number;
  name: string;
  category: string;
  description: string;
  price: number;
  costPrice: number;
  station: Station;
  stock: number;
  prepMinutes: number;
  active: boolean;
  qrVisible: boolean;
  tags: string[];
  ingredients: string[];
  sizes: MenuProductSize[];
  options: MenuProductOptionGroup[];
}

export interface FoodOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  station: Station;
  notes: string;
  ingredients: string[];
  selectedOptions: string[];
  status: KitchenStatus;
  createdAt: string;
}

export interface FoodOrder {
  id: string;
  tableId: string;
  customerName: string;
  waiterName: string;
  openedAt: string;
  status: OrderStatus;
  items: FoodOrderItem[];
  serviceFeePercent: number;
  discount: number;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  tableNumber: string;
  station: Station;
  status: KitchenStatus;
  createdAt: string;
  items: FoodOrderItem[];
}

export interface DeliveryOrder {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  neighborhood?: string;
  courierName?: string;
  estimatedMinutes?: number;
  trackingCode?: string;
  couponCode?: string;
  status: DeliveryStatus;
  createdAt: string;
  deliveryFee: number;
  paymentMethod: PaymentMethod;
  items: FoodOrderItem[];
}

export interface PaymentSplit {
  id: string;
  label: string;
  amount: number;
  method: PaymentMethod;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: FoodUnit;
  currentStock: number;
  minimumStock: number;
  averageCost: number;
  supplier: string;
  expirationDate?: string;
  productionArea?: string;
  lastMovementAt: string;
}

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  type: StockMovementType;
  quantity: number;
  unit: FoodUnit;
  unitCost: number;
  reason: string;
  source: string;
  createdAt: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: FoodUnit;
}

export interface ProductTechnicalSheet {
  id: string;
  productId: string;
  productName: string;
  yieldQuantity: number;
  ingredients: RecipeIngredient[];
  packagingCost: number;
  wastePercent: number;
  notes: string;
}

export interface FoodWaiter {
  id: string;
  name: string;
  username: string;
  pin: string;
  commissionMode: CommissionMode;
  commissionValue: number;
  active: boolean;
}

export interface FoodUser {
  id: string;
  name: string;
  username: string;
  role: FoodRole;
  tableId?: string;
  ownerUserId?: string;
}

export interface CustomerPaymentRequest {
  id: string;
  tableId: string;
  orderId: string;
  requestedAt: string;
  status: "new" | "acknowledged";
}

export interface TableServiceRequest {
  id: string;
  tableId: string;
  tableNumber: string;
  type: TableServiceRequestType;
  status: TableServiceRequestStatus;
  customerName: string;
  customerPhone: string;
  note: string;
  requestedAt: string;
}

export interface FoodClosureReceipt {
  id: string;
  orderId: string;
  tableId: string;
  tableNumber: string;
  paidAt: string;
  method: PaymentMethod;
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  paidBy: string;
  waiterName: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
}
