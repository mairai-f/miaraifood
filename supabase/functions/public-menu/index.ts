import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

type MenuRequest = {
  slug?: string;
  tableSlug?: string | null;
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
    return jsonResponse(request, { error: "Metodo nao suportado." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(request, { error: "Configuracao do Supabase invalida." }, 500);
  }

  let payload: MenuRequest;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: "Payload invalido." }, 400);
  }

  const slug = payload.slug?.trim().toLowerCase();
  if (!slug) {
    return jsonResponse(request, { error: "Cardapio nao informado." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: profile, error: profileError } = await supabase
    .from("restaurant_public_profiles")
    .select("*")
    .eq("public_slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse(request, { error: "Cardapio nao encontrado." }, 404);
  }

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("store_subscriptions")
    .select("plan_id, status, current_period_ends_at, trial_ends_at")
    .eq("store_account_id", profile.store_account_id)
    .in("plan_id", ["food", "food_offline"])
    .order("created_at", { ascending: false });

  if (subscriptionError || !((subscriptions || []).some(isCurrentSubscription))) {
    return jsonResponse(request, { error: "Cardapio indisponivel para esta assinatura." }, 403);
  }

  const [categoriesResult, itemsResult, tableResult] = await Promise.all([
    supabase
      .from("restaurant_menu_categories")
      .select("id, name, description, sort_order, active, qr_visible")
      .eq("store_account_id", profile.store_account_id)
      .eq("active", true)
      .eq("qr_visible", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("restaurant_menu_items")
      .select("id, category_id, display_name, description, price, compare_at_price, image_url, image_alt, station, prep_minutes, tags, sort_order, featured, active, qr_visible, available_for_dine_in, available_for_delivery")
      .eq("store_account_id", profile.store_account_id)
      .eq("active", true)
      .eq("qr_visible", true)
      .order("sort_order", { ascending: true }),
    payload.tableSlug
      ? supabase
          .from("restaurant_tables")
          .select("id, code, name, area, seats, qr_slug, active")
          .eq("store_account_id", profile.store_account_id)
          .eq("qr_slug", payload.tableSlug)
          .eq("active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (categoriesResult.error || itemsResult.error || tableResult.error) {
    return jsonResponse(request, { error: "Nao foi possivel carregar o cardapio." }, 500);
  }

  const itemRows = itemsResult.data || [];
  const itemIds = itemRows.map((item) => item.id);

  const { data: promotionRows, error: promotionsError } = itemIds.length
    ? await supabase
        .from("restaurant_menu_promotions")
        .select("id, menu_item_id, title, description, badge_label, discount_type, discount_value, starts_at, ends_at, active, show_on_menu, sort_order")
        .in("menu_item_id", itemIds)
        .eq("active", true)
        .eq("show_on_menu", true)
        .lte("starts_at", today)
        .or(`ends_at.is.null,ends_at.gte.${today}`)
        .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (promotionsError) {
    return jsonResponse(request, { error: "Nao foi possivel carregar as promocoes." }, 500);
  }

  const { data: optionRows, error: optionsError } = itemIds.length
    ? await supabase
        .from("restaurant_menu_item_options")
        .select("id, menu_item_id, name, option_type, min_selected, max_selected, required, active")
        .in("menu_item_id", itemIds)
        .eq("active", true)
    : { data: [], error: null };

  if (optionsError) {
    return jsonResponse(request, { error: "Nao foi possivel carregar os adicionais." }, 500);
  }

  const optionIds = (optionRows || []).map((option) => option.id);
  const { data: valueRows, error: valuesError } = optionIds.length
    ? await supabase
        .from("restaurant_menu_item_option_values")
        .select("id, option_id, name, price_delta, active")
        .in("option_id", optionIds)
        .eq("active", true)
    : { data: [], error: null };

  if (valuesError) {
    return jsonResponse(request, { error: "Nao foi possivel carregar os adicionais." }, 500);
  }

  const valuesByOptionId = new Map<string, Array<Record<string, unknown>>>();
  for (const value of valueRows || []) {
    const optionValues = valuesByOptionId.get(value.option_id) || [];
    optionValues.push(value);
    valuesByOptionId.set(value.option_id, optionValues);
  }

  const optionsByItemId = new Map<string, Array<Record<string, unknown>>>();
  for (const option of optionRows || []) {
    const itemOptions = optionsByItemId.get(option.menu_item_id) || [];
    itemOptions.push(option);
    optionsByItemId.set(option.menu_item_id, itemOptions);
  }

  const promotionsByItemId = new Map<string, Record<string, unknown>>();
  for (const promotion of promotionRows || []) {
    if (!promotionsByItemId.has(promotion.menu_item_id)) {
      promotionsByItemId.set(promotion.menu_item_id, promotion);
    }
  }

  const items = itemRows.map((item) => {
    const originalPrice = toNumber(item.price);
    const promotionRow = promotionsByItemId.get(item.id) || null;
    const promotionalPrice = promotionRow ? calculatePromotionalPrice(originalPrice, promotionRow) : originalPrice;

    return {
      id: item.id,
      categoryId: item.category_id,
      displayName: item.display_name,
      description: item.description || "",
      price: promotionalPrice,
      compareAtPrice: promotionRow ? originalPrice : item.compare_at_price === null ? null : toNumber(item.compare_at_price),
      imageUrl: item.image_url,
      imageAlt: item.image_alt || item.display_name,
      station: item.station,
      prepMinutes: item.prep_minutes || 0,
      tags: item.tags || [],
      sortOrder: item.sort_order || 0,
      featured: Boolean(item.featured),
      active: item.active,
      qrVisible: item.qr_visible,
      availableForDineIn: item.available_for_dine_in ?? true,
      availableForDelivery: item.available_for_delivery ?? true,
      promotion: promotionRow
        ? {
            id: promotionRow.id,
            menuItemId: promotionRow.menu_item_id,
            title: promotionRow.title,
            description: promotionRow.description || "",
            badgeLabel: promotionRow.badge_label || "Oferta",
            discountType: promotionRow.discount_type,
            discountValue: toNumber(promotionRow.discount_value),
            startsAt: promotionRow.starts_at,
            endsAt: promotionRow.ends_at,
            active: Boolean(promotionRow.active),
            showOnMenu: Boolean(promotionRow.show_on_menu),
            sortOrder: toNumber(promotionRow.sort_order),
            originalPrice,
            promotionalPrice,
          }
        : null,
      options: (optionsByItemId.get(item.id) || []).map((option) => ({
        id: option.id,
        name: option.name,
        optionType: option.option_type,
        minSelected: option.min_selected || 0,
        maxSelected: option.max_selected,
        required: Boolean(option.required),
        active: Boolean(option.active),
        values: (valuesByOptionId.get(String(option.id)) || []).map((value) => ({
          id: value.id,
          name: value.name,
          priceDelta: toNumber(value.price_delta),
          active: Boolean(value.active),
        })),
      })),
    };
  });

  return jsonResponse(request, {
    store: {
      id: profile.store_account_id,
      slug: profile.public_slug,
      displayName: profile.display_name,
      receiptName: profile.receipt_name,
      description: profile.description || "",
      logoUrl: profile.logo_url,
      coverUrl: profile.cover_url,
      phone: profile.phone || "",
      whatsapp: profile.whatsapp || "",
      addressLine: profile.address_line || "",
      city: profile.city || "",
      state: profile.state || "",
      acceptsDineIn: profile.accepts_dine_in,
      acceptsDelivery: profile.accepts_delivery,
      deliveryFee: toNumber(profile.delivery_fee),
      minimumOrderAmount: toNumber(profile.minimum_order_amount),
      estimatedDeliveryMinutes: profile.estimated_delivery_minutes || 45,
      isOpen: profile.is_open,
      happyCashBrand: "HappyCashFood",
    },
    table: tableResult.data
      ? {
          id: tableResult.data.id,
          code: tableResult.data.code,
          name: tableResult.data.name,
          area: tableResult.data.area,
          seats: tableResult.data.seats,
          qrSlug: tableResult.data.qr_slug,
          active: tableResult.data.active,
        }
      : null,
    categories: (categoriesResult.data || []).map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description || "",
      sortOrder: category.sort_order || 0,
      active: category.active,
      qrVisible: category.qr_visible,
    })),
    items,
  });
});
