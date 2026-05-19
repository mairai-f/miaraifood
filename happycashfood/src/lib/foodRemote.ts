import { foodSupabase } from "@/lib/foodAuth";
import type { DeliveryOrder, DeliveryStatus, FoodOrder, FoodOrderItem, FoodTable, KitchenStatus, MenuProduct, Station } from "@/types";

type TableRow = {
  id: string;
  code: string;
  name: string | null;
  area: string | null;
  seats: number | null;
  status: "free" | "occupied" | "closing" | "inactive";
};

type CategoryRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  product_id: string | null;
  category_id: string | null;
  display_name: string;
  description: string | null;
  price: number | string | null;
  station: Station;
  prep_minutes: number | null;
  tags: string[] | null;
  active: boolean;
  qr_visible: boolean;
};

type OrderRow = {
  id: string;
  table_id: string | null;
  customer_name: string | null;
  service_type: string;
  status: FoodOrder["status"] | "cancelled";
  opened_at: string;
  service_fee_amount: number | string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  station: Station;
  quantity: number | string;
  unit_price: number | string;
  notes: string | null;
  selected_options: unknown;
  status: KitchenStatus;
  sent_at: string | null;
  created_at: string;
};

type DeliveryRow = {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string | null;
  address: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  delivery_fee: number | string | null;
  status: DeliveryStatus | "cancelled";
  created_at: string;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const selectedOptionNames = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((option) => {
      if (!option || typeof option !== "object") return "";
      const record = option as Record<string, unknown>;
      return String(record.valueName || record.name || "").trim();
    })
    .filter(Boolean);
};

const mapOrderItem = (row: OrderItemRow): FoodOrderItem => ({
  id: row.id,
  productId: row.product_id || row.id,
  productName: row.product_name,
  quantity: toNumber(row.quantity) || 1,
  unitPrice: toNumber(row.unit_price),
  station: row.station,
  notes: row.notes || "",
  ingredients: [],
  selectedOptions: selectedOptionNames(row.selected_options),
  status: row.status,
  createdAt: row.sent_at || row.created_at,
});

export const loadFoodRemoteSnapshot = async () => {
  if (!foodSupabase) return null;

  const [tablesResult, categoriesResult, productsResult, ordersResult, deliveriesResult] = await Promise.all([
    foodSupabase
      .from("restaurant_tables")
      .select("id, code, name, area, seats, status")
      .eq("active", true)
      .order("code", { ascending: true }),
    foodSupabase
      .from("restaurant_menu_categories")
      .select("id, name"),
    foodSupabase
      .from("restaurant_menu_items")
      .select("id, product_id, category_id, display_name, description, price, station, prep_minutes, tags, active, qr_visible")
      .order("sort_order", { ascending: true }),
    foodSupabase
      .from("restaurant_orders")
      .select("id, table_id, customer_name, service_type, status, opened_at, service_fee_amount, subtotal, discount_amount")
      .not("status", "in", "(paid,cancelled)")
      .order("opened_at", { ascending: false })
      .limit(80),
    foodSupabase
      .from("restaurant_delivery_orders")
      .select("id, order_id, customer_name, customer_phone, address, number, complement, neighborhood, city, state, delivery_fee, status, created_at")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (tablesResult.error || categoriesResult.error || productsResult.error || ordersResult.error || deliveriesResult.error) {
    throw new Error("Nao foi possivel sincronizar os pedidos do HappyCashFood.");
  }

  const baseOrderIds = ((ordersResult.data as OrderRow[] | null) || []).map((order) => order.id);
  const deliveryOrderIds = ((deliveriesResult.data as DeliveryRow[] | null) || []).map((delivery) => delivery.order_id);
  const orderIds = Array.from(new Set([...baseOrderIds, ...deliveryOrderIds]));
  const { data: orderItemRows, error: orderItemsError } = orderIds.length
    ? await foodSupabase
        .from("restaurant_order_items")
        .select("id, order_id, product_id, product_name, station, quantity, unit_price, notes, selected_options, status, sent_at, created_at")
        .in("order_id", orderIds)
        .neq("status", "cancelled")
    : { data: [], error: null };

  if (orderItemsError) {
    throw new Error("Nao foi possivel sincronizar os itens do HappyCashFood.");
  }

  const tableRows = (tablesResult.data as TableRow[] | null) || [];
  const tableById = new Map(tableRows.map((table) => [table.id, table]));
  const categoryById = new Map(((categoriesResult.data as CategoryRow[] | null) || []).map((category) => [category.id, category.name]));

  const itemsByOrderId = new Map<string, FoodOrderItem[]>();
  for (const item of (orderItemRows as OrderItemRow[] | null) || []) {
    const mapped = mapOrderItem(item);
    itemsByOrderId.set(item.order_id, [...(itemsByOrderId.get(item.order_id) || []), mapped]);
  }

  const tables: FoodTable[] = tableRows.map((table) => ({
    id: table.id,
    number: table.code,
    area: table.area || "Salao",
    seats: table.seats || 4,
    status: table.status === "inactive" ? "free" : table.status,
    customerName: table.name || undefined,
  }));

  const products: MenuProduct[] = ((productsResult.data as ProductRow[] | null) || []).map((product, index) => ({
    id: product.id,
    code: index + 1,
    name: product.display_name,
    category: categoryById.get(product.category_id || "") || "Cardapio",
    description: product.description || "",
    price: toNumber(product.price),
    costPrice: 0,
    station: product.station,
    stock: 999,
    prepMinutes: product.prep_minutes || 0,
    active: product.active,
    qrVisible: product.qr_visible,
    tags: product.tags || [],
    ingredients: [],
    sizes: [],
    options: [],
  }));

  const orders: FoodOrder[] = ((ordersResult.data as OrderRow[] | null) || [])
    .filter((order) => order.status !== "cancelled" && order.service_type !== "delivery")
    .map((order) => {
      const table = order.table_id ? tableById.get(order.table_id) : null;
      const subtotal = toNumber(order.subtotal);
      const serviceFee = toNumber(order.service_fee_amount);
      const serviceFeePercent = subtotal > 0 ? (serviceFee / subtotal) * 100 : 0;
      return {
        id: order.id,
        tableId: order.table_id || `takeaway-${order.id}`,
        customerName: order.customer_name || table?.name || table?.code || "Pedido",
        waiterName: "HappyCashMenu",
        openedAt: order.opened_at,
        status: order.status as FoodOrder["status"],
        items: itemsByOrderId.get(order.id) || [],
        serviceFeePercent,
        discount: toNumber(order.discount_amount),
      };
    });

  const deliveries: DeliveryOrder[] = ((deliveriesResult.data as DeliveryRow[] | null) || [])
    .filter((delivery) => delivery.status !== "cancelled")
    .map((delivery) => ({
      id: delivery.id,
      customerName: delivery.customer_name,
      phone: delivery.customer_phone || "",
      address: [
        delivery.address,
        delivery.number,
        delivery.neighborhood,
        delivery.city,
        delivery.state,
      ].filter(Boolean).join(", "),
      status: delivery.status as DeliveryStatus,
      createdAt: delivery.created_at,
      deliveryFee: toNumber(delivery.delivery_fee),
      paymentMethod: "pix",
      items: itemsByOrderId.get(delivery.order_id) || [],
    }));

  return { tables, products, orders, deliveries };
};

export const updateFoodOrderItemStatuses = async (itemIds: string[], status: KitchenStatus) => {
  if (!foodSupabase || itemIds.length === 0) return;
  await foodSupabase
    .from("restaurant_order_items")
    .update({ status })
    .in("id", itemIds);
};

export const updateFoodDeliveryStatus = async (deliveryId: string, status: DeliveryStatus) => {
  if (!foodSupabase) return;
  await foodSupabase
    .from("restaurant_delivery_orders")
    .update({ status })
    .eq("id", deliveryId);
};
