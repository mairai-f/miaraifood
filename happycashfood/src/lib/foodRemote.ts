import { foodSupabase } from "@/lib/foodAuth";
import type {
  DeliveryOrder,
  DeliveryStatus,
  FoodOrder,
  FoodOrderItem,
  FoodTable,
  FoodUnit,
  InventoryItem,
  KitchenStatus,
  MenuProduct,
  ProductTechnicalSheet,
  Station,
  StockMovement,
  StockMovementType,
  TableServiceRequest,
  TableServiceRequestStatus,
  TableServiceRequestType,
} from "@/types";

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
  courier_name: string | null;
  tracking_code: string | null;
  coupon_code: string | null;
  estimated_minutes: number | null;
  delivery_fee: number | string | null;
  status: DeliveryStatus | "cancelled";
  created_at: string;
};

type ServiceRequestRow = {
  id: string;
  table_id: string;
  request_type: TableServiceRequestType;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  status: TableServiceRequestStatus;
  requested_at: string;
};

type InventoryItemRow = {
  id: string;
  name: string;
  unit: FoodUnit;
  current_stock: number | string;
  minimum_stock: number | string;
  average_cost: number | string;
  supplier: string | null;
  expiration_date: string | null;
  production_area: string | null;
  last_movement_at: string;
};

type StockMovementRow = {
  id: string;
  inventory_item_id: string;
  movement_type: StockMovementType;
  quantity: number | string;
  unit: FoodUnit;
  unit_cost: number | string;
  reason: string | null;
  source: string | null;
  created_at: string;
  restaurant_inventory_items: { name: string } | Array<{ name: string }> | null;
};

type TechnicalSheetRow = {
  id: string;
  menu_item_id: string;
  yield_quantity: number | string;
  packaging_cost: number | string;
  waste_percent: number | string;
  notes: string | null;
};

type TechnicalSheetIngredientRow = {
  id: string;
  technical_sheet_id: string;
  inventory_item_id: string;
  quantity: number | string;
  unit: FoodUnit;
  restaurant_inventory_items: { name: string } | Array<{ name: string }> | null;
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

  const [
    tablesResult,
    categoriesResult,
    productsResult,
    ordersResult,
    deliveriesResult,
    serviceRequestsResult,
    inventoryItemsResult,
    stockMovementsResult,
    technicalSheetsResult,
  ] = await Promise.all([
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
      .select("id, order_id, customer_name, customer_phone, address, number, complement, neighborhood, city, state, courier_name, tracking_code, coupon_code, estimated_minutes, delivery_fee, status, created_at")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(80),
    foodSupabase
      .from("restaurant_table_service_requests")
      .select("id, table_id, request_type, customer_name, customer_phone, note, status, requested_at")
      .in("status", ["new", "acknowledged"])
      .order("requested_at", { ascending: false })
      .limit(50),
    foodSupabase
      .from("restaurant_inventory_items")
      .select("id, name, unit, current_stock, minimum_stock, average_cost, supplier, expiration_date, production_area, last_movement_at")
      .eq("active", true)
      .order("name", { ascending: true }),
    foodSupabase
      .from("restaurant_stock_movements")
      .select("id, inventory_item_id, movement_type, quantity, unit, unit_cost, reason, source, created_at, restaurant_inventory_items(name)")
      .order("created_at", { ascending: false })
      .limit(80),
    foodSupabase
      .from("restaurant_product_technical_sheets")
      .select("id, menu_item_id, yield_quantity, packaging_cost, waste_percent, notes"),
  ]);

  if (
    tablesResult.error ||
    categoriesResult.error ||
    productsResult.error ||
    ordersResult.error ||
    deliveriesResult.error ||
    serviceRequestsResult.error ||
    inventoryItemsResult.error ||
    stockMovementsResult.error ||
    technicalSheetsResult.error
  ) {
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
  const productById = new Map(products.map((product) => [product.id, product]));

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
      neighborhood: delivery.neighborhood || "",
      courierName: delivery.courier_name || "A definir",
      estimatedMinutes: delivery.estimated_minutes || 45,
      trackingCode: delivery.tracking_code || delivery.id.slice(0, 8),
      couponCode: delivery.coupon_code || "",
      status: delivery.status as DeliveryStatus,
      createdAt: delivery.created_at,
      deliveryFee: toNumber(delivery.delivery_fee),
      paymentMethod: "pix",
      items: itemsByOrderId.get(delivery.order_id) || [],
    }));

  const serviceRequests: TableServiceRequest[] = ((serviceRequestsResult.data as ServiceRequestRow[] | null) || [])
    .map((request) => {
      const table = tableById.get(request.table_id);
      return {
        id: request.id,
        tableId: request.table_id,
        tableNumber: table?.code || "?",
        type: request.request_type,
        status: request.status,
        customerName: request.customer_name || table?.name || `Mesa ${table?.code || ""}`.trim(),
        customerPhone: request.customer_phone || "",
        note: request.note || "",
        requestedAt: request.requested_at,
      };
    });

  const inventoryItems: InventoryItem[] = ((inventoryItemsResult.data as InventoryItemRow[] | null) || []).map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    currentStock: toNumber(item.current_stock),
    minimumStock: toNumber(item.minimum_stock),
    averageCost: toNumber(item.average_cost),
    supplier: item.supplier || "",
    expirationDate: item.expiration_date || undefined,
    productionArea: item.production_area || "",
    lastMovementAt: item.last_movement_at,
  }));

  const stockMovements: StockMovement[] = ((stockMovementsResult.data as StockMovementRow[] | null) || []).map((movement) => {
    const inventoryRecord = Array.isArray(movement.restaurant_inventory_items)
      ? movement.restaurant_inventory_items[0]
      : movement.restaurant_inventory_items;
    return {
      id: movement.id,
      inventoryItemId: movement.inventory_item_id,
      inventoryItemName: inventoryRecord?.name || movement.inventory_item_id,
      type: movement.movement_type,
      quantity: toNumber(movement.quantity),
      unit: movement.unit,
      unitCost: toNumber(movement.unit_cost),
      reason: movement.reason || "",
      source: movement.source || "",
      createdAt: movement.created_at,
    };
  });

  const sheetRows = (technicalSheetsResult.data as TechnicalSheetRow[] | null) || [];
  const sheetIds = sheetRows.map((sheet) => sheet.id);
  const { data: ingredientRows, error: ingredientsError } = sheetIds.length
    ? await foodSupabase
        .from("restaurant_product_technical_sheet_ingredients")
        .select("id, technical_sheet_id, inventory_item_id, quantity, unit, restaurant_inventory_items(name)")
        .in("technical_sheet_id", sheetIds)
    : { data: [], error: null };

  if (ingredientsError) {
    throw new Error("Nao foi possivel sincronizar as fichas tecnicas.");
  }

  const ingredientsBySheetId = new Map<string, TechnicalSheetIngredientRow[]>();
  ((ingredientRows as TechnicalSheetIngredientRow[] | null) || []).forEach((ingredient) => {
    ingredientsBySheetId.set(ingredient.technical_sheet_id, [
      ...(ingredientsBySheetId.get(ingredient.technical_sheet_id) || []),
      ingredient,
    ]);
  });

  const technicalSheets: ProductTechnicalSheet[] = sheetRows.map((sheet) => {
    const product = productById.get(sheet.menu_item_id);
    return {
      id: sheet.id,
      productId: sheet.menu_item_id,
      productName: product?.name || sheet.menu_item_id,
      yieldQuantity: toNumber(sheet.yield_quantity) || 1,
      packagingCost: toNumber(sheet.packaging_cost),
      wastePercent: toNumber(sheet.waste_percent),
      notes: sheet.notes || "",
      ingredients: (ingredientsBySheetId.get(sheet.id) || []).map((ingredient) => {
        const inventoryRecord = Array.isArray(ingredient.restaurant_inventory_items)
          ? ingredient.restaurant_inventory_items[0]
          : ingredient.restaurant_inventory_items;
        return {
          inventoryItemId: ingredient.inventory_item_id,
          inventoryItemName: inventoryRecord?.name || ingredient.inventory_item_id,
          quantity: toNumber(ingredient.quantity),
          unit: ingredient.unit,
        };
      }),
    };
  });

  return { tables, products, orders, deliveries, serviceRequests, inventoryItems, stockMovements, technicalSheets };
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

export const updateFoodServiceRequestStatus = async (
  requestId: string,
  status: TableServiceRequestStatus,
) => {
  if (!foodSupabase) return;
  const timestampPatch = status === "acknowledged"
    ? { acknowledged_at: new Date().toISOString() }
    : status === "done" || status === "cancelled"
      ? { resolved_at: new Date().toISOString() }
      : {};
  await foodSupabase
    .from("restaurant_table_service_requests")
    .update({ status, ...timestampPatch })
    .eq("id", requestId);
};

export const persistFoodStockMovement = async (
  ownerUserId: string | undefined,
  movement: StockMovement,
  itemPatch: Pick<InventoryItem, "id" | "currentStock" | "averageCost" | "lastMovementAt">,
) => {
  if (!foodSupabase || !ownerUserId) return;

  try {
    await foodSupabase
      .from("restaurant_inventory_items")
      .update({
        current_stock: itemPatch.currentStock,
        average_cost: itemPatch.averageCost,
        last_movement_at: itemPatch.lastMovementAt,
      })
      .eq("id", itemPatch.id);

    await foodSupabase
      .from("restaurant_stock_movements")
      .insert({
        owner_user_id: ownerUserId,
        inventory_item_id: movement.inventoryItemId,
        movement_type: movement.type,
        quantity: movement.quantity,
        unit: movement.unit,
        unit_cost: movement.unitCost,
        reason: movement.reason,
        source: movement.source,
        created_at: movement.createdAt,
      });
  } catch {
    // Mantem a operação local quando a sincronização falhar.
  }
};

export const persistFoodTechnicalSheet = async (
  ownerUserId: string | undefined,
  sheet: ProductTechnicalSheet,
) => {
  if (!foodSupabase || !ownerUserId) return;

  try {
    const { data: existingSheet } = await foodSupabase
      .from("restaurant_product_technical_sheets")
      .select("id")
      .eq("menu_item_id", sheet.productId)
      .maybeSingle<{ id: string }>();

    const payload = {
      owner_user_id: ownerUserId,
      menu_item_id: sheet.productId,
      yield_quantity: sheet.yieldQuantity,
      packaging_cost: sheet.packagingCost,
      waste_percent: sheet.wastePercent,
      notes: sheet.notes,
    };

    const { data: savedSheet, error: sheetError } = existingSheet?.id
      ? await foodSupabase
          .from("restaurant_product_technical_sheets")
          .update(payload)
          .eq("id", existingSheet.id)
          .select("id")
          .single<{ id: string }>()
      : await foodSupabase
          .from("restaurant_product_technical_sheets")
          .insert(payload)
          .select("id")
          .single<{ id: string }>();

    if (sheetError || !savedSheet) return;

    await foodSupabase
      .from("restaurant_product_technical_sheet_ingredients")
      .delete()
      .eq("technical_sheet_id", savedSheet.id);

    const ingredientRows = sheet.ingredients.map((ingredient) => ({
      owner_user_id: ownerUserId,
      technical_sheet_id: savedSheet.id,
      inventory_item_id: ingredient.inventoryItemId,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }));

    if (ingredientRows.length) {
      await foodSupabase
        .from("restaurant_product_technical_sheet_ingredients")
        .insert(ingredientRows);
    }
  } catch {
    // Mantem a operação local quando a sincronização falhar.
  }
};
