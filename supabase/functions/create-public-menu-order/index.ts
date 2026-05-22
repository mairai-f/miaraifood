import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

type PublicCartItem = {
  itemId?: string;
  quantity?: number;
  notes?: string;
  removedIngredients?: string[];
  options?: Array<{
    groupId?: string;
    valueId?: string;
    quantity?: number;
  }>;
};

type OrderRequest = {
  slug?: string;
  tableSlug?: string | null;
  serviceType?: "dine_in" | "delivery" | "takeaway";
  actionType?: "order" | "call_waiter" | "request_bill";
  paymentTiming?: "now" | "cashier";
  note?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    paymentMethod?: "pix" | "card" | "debit" | "credit" | "voucher" | "cash";
    loyaltyOptIn?: boolean;
  };
  items?: PublicCartItem[];
};

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ["POST", "OPTIONS"],
      }).headers.entries()),
      "Content-Type": "application/json",
    },
  });

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clean = (value?: string | null) => value?.trim() || "";
const clampQuantity = (value: unknown) => Math.min(Math.max(Number(value) || 1, 1), 99);
const today = new Date().toISOString().slice(0, 10);

const calculatePromotionalPrice = (basePrice: number, promotion: Record<string, unknown>) => {
  const discountType = String(promotion.discount_type || "amount");
  const discountValue = toNumber(promotion.discount_value);
  if (discountType === "fixed_price") return Math.max(0, discountValue);
  if (discountType === "percent") return Math.max(0, basePrice - (basePrice * discountValue) / 100);
  return Math.max(0, basePrice - discountValue);
};

const isCurrentSubscription = (subscription: {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
}) => {
  if (!["food", "food_offline"].includes(subscription.plan_id)) return false;
  if (!["trialing", "active", "past_due"].includes(subscription.status)) return false;
  const endAt = subscription.status === "trialing"
    ? subscription.trial_ends_at || subscription.current_period_ends_at
    : subscription.current_period_ends_at || subscription.trial_ends_at;
  return !endAt || new Date(endAt).getTime() > Date.now();
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight(request, {
      allowedMethods: ["POST", "OPTIONS"],
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { success: false, error: "Metodo nao suportado." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { success: false, error: "Configuracao do Supabase invalida." }, 500);
  }

  let payload: OrderRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { success: false, error: "Payload invalido." }, 400);
  }

  const slug = clean(payload.slug).toLowerCase();
  const serviceType = payload.serviceType || "delivery";
  const actionType = payload.actionType || "order";
  const paymentTiming = payload.paymentTiming || "cashier";
  const customer = payload.customer || {};
  const items = payload.items || [];
  const actionNote = clean(payload.note).slice(0, 280);

  if (!slug || !["dine_in", "delivery", "takeaway"].includes(serviceType) || !["order", "call_waiter", "request_bill"].includes(actionType)) {
    return jsonResponse(request, { success: false, error: "Pedido invalido." }, 400);
  }

  if (actionType === "order" && (!items.length || items.length > 80)) {
    return jsonResponse(request, { success: false, error: "Adicione pelo menos um item." }, 400);
  }

  if (actionType === "order" && !clean(customer.name)) {
    return jsonResponse(request, { success: false, error: "Informe o nome do cliente." }, 400);
  }

  if (actionType === "order" && serviceType === "delivery" && (!clean(customer.phone) || !clean(customer.address) || !clean(customer.number))) {
    return jsonResponse(request, { success: false, error: "Informe telefone e endereco de entrega." }, 400);
  }

  if (actionType !== "order" && serviceType !== "dine_in") {
    return jsonResponse(request, { success: false, error: "Acao disponivel apenas no QR da mesa." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const accessToken = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  const { data: authUserData } = accessToken
    ? await supabase.auth.getUser(accessToken)
    : { data: { user: null } };
  const authUser = authUserData.user;

  const { data: profile, error: profileError } = await supabase
    .from("restaurant_public_profiles")
    .select("*")
    .eq("public_slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (profileError || !profile || !profile.is_open) {
    return jsonResponse(request, { success: false, error: "Cardapio indisponivel no momento." }, 404);
  }

  if (serviceType === "delivery" && !profile.accepts_delivery) {
    return jsonResponse(request, { success: false, error: "Delivery indisponivel no momento." }, 400);
  }

  if (serviceType === "dine_in" && !profile.accepts_dine_in) {
    return jsonResponse(request, { success: false, error: "Pedidos por mesa indisponiveis." }, 400);
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("store_subscriptions")
    .select("plan_id, status, current_period_ends_at, trial_ends_at")
    .eq("store_account_id", profile.store_account_id)
    .in("plan_id", ["food", "food_offline"])
    .order("created_at", { ascending: false });

  if (subscriptionError || !((subscriptions || []).some(isCurrentSubscription))) {
    return jsonResponse(request, { success: false, error: "Assinatura HappyCashFood inativa." }, 403);
  }

  let tableId: string | null = null;
  if (serviceType === "dine_in") {
    const tableSlug = clean(payload.tableSlug);
    if (!tableSlug) {
      return jsonResponse(request, { success: false, error: "Mesa nao informada." }, 400);
    }

    const { data: table, error: tableError } = await supabase
      .from("restaurant_tables")
      .select("id")
      .eq("store_account_id", profile.store_account_id)
      .eq("qr_slug", tableSlug)
      .eq("active", true)
      .maybeSingle();

    if (tableError || !table) {
      return jsonResponse(request, { success: false, error: "Mesa nao encontrada." }, 404);
    }

    tableId = table.id;
  }

  if (actionType !== "order") {
    const actionLabel = actionType === "call_waiter" ? "Chamar garcom" : "Fechar conta";
    const { data: serviceRequest, error: actionError } = await supabase
      .from("restaurant_table_service_requests")
      .insert({
        owner_user_id: profile.owner_user_id,
        store_account_id: profile.store_account_id,
        table_id: tableId,
        request_type: actionType,
        customer_name: clean(customer.name).slice(0, 120) || "Mesa QR",
        customer_phone: clean(customer.phone).slice(0, 40),
        note: actionNote || (actionType === "request_bill"
          ? "Cliente quer falar com o garcom para pagar e fechar a conta."
          : "Cliente chamou o garcom pela mesa."),
        status: "new",
      })
      .select("id")
      .single();

    if (actionError || !serviceRequest) {
      return jsonResponse(request, { success: false, error: "Nao foi possivel avisar a equipe." }, 500);
    }

    return jsonResponse(request, {
      success: true,
      orderId: serviceRequest.id,
      actionType,
      receiptNumber: actionType === "call_waiter" ? "garcom chamado" : "conta solicitada",
      receiptTitle: actionLabel,
      brandLine: `${profile.receipt_name} | HappyCashFood`,
    });
  }

  const itemIds = items.map((item) => clean(item.itemId)).filter(Boolean);
  const { data: menuItems, error: menuItemsError } = await supabase
    .from("restaurant_menu_items")
    .select("id, product_id, display_name, price, station, removable_ingredients, available_for_delivery, available_for_dine_in")
    .eq("store_account_id", profile.store_account_id)
    .eq("active", true)
    .eq("qr_visible", true)
    .in("id", itemIds);

  if (menuItemsError || !menuItems?.length) {
    return jsonResponse(request, { success: false, error: "Produtos indisponiveis." }, 400);
  }

  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  const { data: promotions, error: promotionsError } = await supabase
    .from("restaurant_menu_promotions")
    .select("id, menu_item_id, discount_type, discount_value")
    .eq("store_account_id", profile.store_account_id)
    .eq("active", true)
    .eq("show_on_menu", true)
    .lte("starts_at", today)
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .in("menu_item_id", itemIds)
    .order("sort_order", { ascending: true });

  if (promotionsError) {
    return jsonResponse(request, { success: false, error: "Promocoes indisponiveis." }, 400);
  }

  const promotionByItemId = new Map<string, Record<string, unknown>>();
  for (const promotion of promotions || []) {
    if (!promotionByItemId.has(promotion.menu_item_id)) {
      promotionByItemId.set(promotion.menu_item_id, promotion);
    }
  }

  const optionValueIds = items.flatMap((item) => item.options || []).map((option) => clean(option.valueId)).filter(Boolean);
  const { data: optionValues, error: optionValuesError } = optionValueIds.length
    ? await supabase
        .from("restaurant_menu_item_option_values")
        .select("id, option_id, name, price_delta, restaurant_menu_item_options!inner(menu_item_id, name)")
        .in("id", optionValueIds)
        .eq("active", true)
    : { data: [], error: null };

  if (optionValuesError) {
    return jsonResponse(request, { success: false, error: "Adicionais indisponiveis." }, 400);
  }

  const optionValueById = new Map((optionValues || []).map((value) => [value.id, value]));
  const orderItems = [];
  let subtotal = 0;

  for (const cartItem of items) {
    const menuItem = itemById.get(clean(cartItem.itemId));
    if (!menuItem) {
      return jsonResponse(request, { success: false, error: "Produto indisponivel." }, 400);
    }

    if (serviceType === "delivery" && !menuItem.available_for_delivery) {
      return jsonResponse(request, { success: false, error: `${menuItem.display_name} nao esta disponivel para delivery.` }, 400);
    }

    if (serviceType !== "delivery" && !menuItem.available_for_dine_in) {
      return jsonResponse(request, { success: false, error: `${menuItem.display_name} nao esta disponivel para mesa.` }, 400);
    }

    const quantity = clampQuantity(cartItem.quantity);
    const selectedOptions = [];
    let optionTotal = 0;
    const allowedRemovals = Array.isArray(menuItem.removable_ingredients)
      ? menuItem.removable_ingredients.map((ingredient) => clean(String(ingredient))).filter(Boolean)
      : [];
    const allowedRemovalLookup = new Map(allowedRemovals.map((ingredient) => [ingredient.toLowerCase(), ingredient]));
    const removedIngredients = Array.from(new Set((cartItem.removedIngredients || [])
      .map((ingredient) => allowedRemovalLookup.get(clean(ingredient).toLowerCase()))
      .filter((ingredient): ingredient is string => Boolean(ingredient))));

    for (const selectedOption of cartItem.options || []) {
      const optionValue = optionValueById.get(clean(selectedOption.valueId));
      if (!optionValue) continue;
      const optionQuantity = clampQuantity(selectedOption.quantity);
      const delta = toNumber(optionValue.price_delta) * optionQuantity;
      const optionGroup = Array.isArray(optionValue.restaurant_menu_item_options)
        ? optionValue.restaurant_menu_item_options[0]
        : optionValue.restaurant_menu_item_options;
      optionTotal += delta;
      selectedOptions.push({
        valueId: optionValue.id,
        valueName: optionValue.name,
        groupId: optionValue.option_id,
        groupName: optionGroup?.name || "",
        priceDelta: toNumber(optionValue.price_delta),
        quantity: optionQuantity,
      });
    }

    removedIngredients.forEach((ingredient) => {
      selectedOptions.push({
        valueId: `remove:${ingredient.toLowerCase()}`,
        valueName: `Sem ${ingredient}`,
        groupId: "removable_ingredients",
        groupName: "Retirar ingredientes",
        priceDelta: 0,
        quantity: 1,
      });
    });

    const basePrice = toNumber(menuItem.price);
    const promotion = promotionByItemId.get(menuItem.id);
    const productPrice = promotion ? calculatePromotionalPrice(basePrice, promotion) : basePrice;
    const unitPrice = productPrice + optionTotal;
    const totalAmount = unitPrice * quantity;
    subtotal += totalAmount;

    orderItems.push({
      owner_user_id: profile.owner_user_id,
      store_account_id: profile.store_account_id,
      product_id: menuItem.product_id,
      product_name: menuItem.display_name,
      station: menuItem.station,
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      notes: [
        removedIngredients.length ? `Sem: ${removedIngredients.join(", ")}` : "",
        clean(cartItem.notes),
      ].filter(Boolean).join(" | ").slice(0, 300),
      selected_options: selectedOptions,
      status: "received",
    });
  }

  if (serviceType === "delivery" && subtotal < toNumber(profile.minimum_order_amount)) {
    return jsonResponse(request, { success: false, error: "Pedido abaixo do minimo para delivery." }, 400);
  }

  const deliveryFee = serviceType === "delivery" ? toNumber(profile.delivery_fee) : 0;
  const totalAmount = subtotal + deliveryFee;
  let clientId: string | null = null;

  if (customer.loyaltyOptIn && clean(customer.phone) && clean(customer.name)) {
    const normalizedPhone = clean(customer.phone).slice(0, 40);
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", profile.owner_user_id)
      .eq("store_account_id", profile.store_account_id)
      .eq("product_context", "happycashfood")
      .eq("phone", normalizedPhone)
      .eq("deleted", false)
      .limit(1);

    const existingClient = existingClients?.[0] || null;
    if (existingClient) {
      clientId = existingClient.id;
      if (existingClient.name !== clean(customer.name)) {
        await supabase
          .from("clients")
          .update({ name: clean(customer.name).slice(0, 120) })
          .eq("id", existingClient.id)
          .eq("store_account_id", profile.store_account_id)
          .eq("product_context", "happycashfood");
      }
    } else {
      const { data: insertedClient } = await supabase
        .from("clients")
        .insert({
          user_id: profile.owner_user_id,
          store_account_id: profile.store_account_id,
          product_context: "happycashfood",
          name: clean(customer.name).slice(0, 120),
          phone: normalizedPhone,
        })
        .select("id")
        .single();

      clientId = insertedClient?.id || null;
    }
  }

  if (authUser && clean(customer.email || authUser.email) && clean(customer.name)) {
    await supabase
      .from("restaurant_menu_customers")
      .upsert({
        auth_user_id: authUser.id,
        store_account_id: profile.store_account_id,
        owner_user_id: profile.owner_user_id,
        email: clean(customer.email || authUser.email).toLowerCase().slice(0, 180),
        name: clean(customer.name).slice(0, 120),
        phone: clean(customer.phone).slice(0, 40),
        address: clean(customer.address).slice(0, 180),
        number: clean(customer.number).slice(0, 20),
        complement: clean(customer.complement).slice(0, 120),
        neighborhood: clean(customer.neighborhood).slice(0, 120),
        city: clean(customer.city).slice(0, 80),
        state: clean(customer.state).slice(0, 2).toUpperCase(),
      }, {
        onConflict: "auth_user_id,store_account_id",
      });
  }

  const { data: order, error: orderError } = await supabase
    .from("restaurant_orders")
    .insert({
      owner_user_id: profile.owner_user_id,
      store_account_id: profile.store_account_id,
      table_id: tableId,
      client_id: clientId,
      customer_name: clean(customer.name).slice(0, 120),
      customer_phone: clean(customer.phone).slice(0, 40),
      service_type: serviceType === "dine_in" ? "qr_menu" : serviceType,
      status: "sent",
      notes: `Pedido criado pelo cardapio publico ${profile.display_name} + HappyCashFood | Pagamento: ${paymentTiming === "now" ? "pagar agora" : "pagar no caixa"} | Metodo: ${clean(customer.paymentMethod) || "nao informado"}`,
      subtotal,
      service_fee_amount: deliveryFee,
      discount_amount: 0,
      total_amount: totalAmount,
    })
    .select("id, created_at")
    .single();

  if (orderError || !order) {
    return jsonResponse(request, { success: false, error: "Nao foi possivel criar o pedido." }, 500);
  }

  const { error: orderItemsError } = await supabase
    .from("restaurant_order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (orderItemsError) {
    await supabase.from("restaurant_orders").delete().eq("id", order.id);
    return jsonResponse(request, { success: false, error: "Nao foi possivel inserir os itens." }, 500);
  }

  if (serviceType === "delivery") {
    const { error: deliveryError } = await supabase
      .from("restaurant_delivery_orders")
      .insert({
        owner_user_id: profile.owner_user_id,
        store_account_id: profile.store_account_id,
        order_id: order.id,
        customer_name: clean(customer.name).slice(0, 120),
        customer_phone: clean(customer.phone).slice(0, 40),
        address: clean(customer.address).slice(0, 180),
        number: clean(customer.number).slice(0, 20),
        complement: clean(customer.complement).slice(0, 120),
        neighborhood: clean(customer.neighborhood).slice(0, 120),
        city: clean(customer.city).slice(0, 80),
        state: clean(customer.state).slice(0, 2).toUpperCase(),
        delivery_fee: deliveryFee,
        status: "new",
      });

    if (deliveryError) {
      await supabase.from("restaurant_orders").delete().eq("id", order.id);
      return jsonResponse(request, { success: false, error: "Nao foi possivel registrar a entrega." }, 500);
    }
  }

  return jsonResponse(request, {
    success: true,
    orderId: order.id,
    receiptNumber: `#${String(order.id).slice(0, 8).toUpperCase()}`,
    receiptTitle: profile.receipt_name,
    brandLine: `${profile.receipt_name} | HappyCashFood`,
  });
});
