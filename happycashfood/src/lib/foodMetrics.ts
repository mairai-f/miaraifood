import type { DeliveryOrder, FoodOrder, FoodOrderItem, FoodTable, FoodWaiter, KitchenStatus, MenuProduct } from "@/types";

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const minutesOpen = (iso?: string) => {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
};

export const formatElapsed = (iso?: string) => {
  const minutes = minutesOpen(iso);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
};

export const itemTotal = (item: FoodOrderItem) =>
  item.status === "cancelled" ? 0 : item.quantity * item.unitPrice;

export const orderSubtotal = (order: Pick<FoodOrder, "items">) =>
  order.items.reduce((sum, item) => sum + itemTotal(item), 0);

export const orderServiceFee = (order: FoodOrder) =>
  orderSubtotal(order) * (order.serviceFeePercent / 100);

export const orderTotal = (order: FoodOrder) =>
  Math.max(0, orderSubtotal(order) + orderServiceFee(order) - order.discount);

export const deliveryTotal = (order: DeliveryOrder) =>
  order.items.reduce((sum, item) => sum + itemTotal(item), 0) + order.deliveryFee;

export const tableOrder = (orders: FoodOrder[], tableId: string) =>
  orders.find((order) => order.tableId === tableId && order.status !== "paid");

export const tableNumberValue = (tableNumber: string) => {
  const numeric = Number.parseInt(tableNumber.replace(/\D/g, ""), 10);
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
};

export const sortTablesByNumber = (tables: FoodTable[]) =>
  [...tables].sort((left, right) => {
    const byNumber = tableNumberValue(left.number) - tableNumberValue(right.number);
    return byNumber === 0 ? left.number.localeCompare(right.number, "pt-BR") : byNumber;
  });

export const sortOrdersByTableNumber = (orders: FoodOrder[], tables: FoodTable[]) =>
  [...orders].sort((left, right) => {
    const leftTable = tables.find((table) => table.id === left.tableId);
    const rightTable = tables.find((table) => table.id === right.tableId);
    return tableNumberValue(leftTable?.number ?? "") - tableNumberValue(rightTable?.number ?? "");
  });

export const statusLabel: Record<KitchenStatus, string> = {
  received: "Recebido",
  preparing: "Preparando",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const statusTone = {
  free: "border-emerald-500/35 bg-emerald-500/12 text-emerald-100",
  occupied: "border-sky-500/35 bg-sky-500/12 text-sky-100",
  closing: "border-amber-400/35 bg-amber-400/12 text-amber-50",
};

export const nextKitchenStatus = (status: KitchenStatus): KitchenStatus => {
  if (status === "received") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return "delivered";
  return "delivered";
};

export const buildTicketId = () =>
  `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const buildItemFromProduct = (
  product: MenuProduct,
  notes: string,
  selectedOptions: string[] = [],
  unitPrice = product.price,
): FoodOrderItem => ({
  id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  productId: product.id,
  productName: product.name,
  quantity: 1,
  unitPrice,
  station: product.station,
  notes,
  ingredients: product.ingredients,
  selectedOptions,
  status: "received",
  createdAt: new Date().toISOString(),
});

export const occupiedTables = (tables: FoodTable[]) =>
  tables.filter((table) => table.status !== "free");

export const productPriceLabel = (product: MenuProduct) => {
  if (product.sizes.length === 0) return currency.format(product.price);
  const prices = product.sizes.map((size) => size.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? currency.format(min) : `${currency.format(min)} a ${currency.format(max)}`;
};

export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const productMatchesSearch = (product: MenuProduct, query: string) => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;

  const haystack = normalizeSearch([
    product.name,
    product.category,
    product.description,
    product.code.toString(),
    product.ingredients.join(" "),
    product.tags.join(" "),
  ].join(" "));

  return haystack.includes(normalizedQuery);
};

export const waiterCommission = (waiter: FoodWaiter, orders: FoodOrder[]) => {
  const waiterRevenue = orders
    .filter((order) => order.waiterName === waiter.name)
    .reduce((sum, order) => sum + orderTotal(order), 0);

  if (waiter.commissionMode === "cash") {
    return orders.filter((order) => order.waiterName === waiter.name).length * waiter.commissionValue;
  }

  return waiterRevenue * (waiter.commissionValue / 100);
};
