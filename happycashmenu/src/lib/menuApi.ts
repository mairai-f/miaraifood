import { fallbackMenu } from "@/data/fallback";
import { menuAdminSupabase, menuCustomerSupabase } from "@/lib/supabase";
import { digitsOnly, normalizeSlug, titleCaseFallback } from "@/lib/format";
import type {
  AdminPublicProfile,
  AdminStoreAccount,
  CartItem,
  CreateOrderResponse,
  CustomerInfo,
  MenuCategory,
  MenuItem,
  MenuPromotion,
  MenuTable,
  PublicMenuPayload,
} from "@/types";

type StoreAccountRow = {
  id: string;
  owner_user_id: string;
  product_context: "happycash" | "happycashfood" | null;
  nome_estabelecimento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

type SubscriptionRow = {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  store_account_id: string;
  owner_user_id: string;
  public_slug: string;
  display_name: string;
  receipt_name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  accepts_dine_in: boolean;
  accepts_delivery: boolean;
  delivery_fee: number | string | null;
  minimum_order_amount: number | string | null;
  estimated_delivery_minutes: number | null;
  is_open: boolean;
  active: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  active: boolean;
  qr_visible: boolean;
};

type ItemRow = {
  id: string;
  category_id: string | null;
  display_name: string;
  description: string | null;
  price: number | string | null;
  compare_at_price: number | string | null;
  image_url: string | null;
  image_alt: string | null;
  station: "kitchen" | "bar" | "counter";
  prep_minutes: number | null;
  tags: string[] | null;
  sort_order: number | null;
  featured: boolean | null;
  active: boolean;
  qr_visible: boolean;
  available_for_dine_in: boolean | null;
  available_for_delivery: boolean | null;
};

type PromotionRow = {
  id: string;
  menu_item_id: string;
  title: string;
  description: string | null;
  badge_label: string | null;
  discount_type: "amount" | "percent" | "fixed_price";
  discount_value: number | string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  show_on_menu: boolean;
  sort_order: number | null;
};

type TableRow = {
  id: string;
  code: string;
  name: string;
  area: string;
  seats: number;
  qr_slug: string;
  active: boolean;
};

const activeStatuses = new Set(["trialing", "active", "past_due"]);
const foodPlans = new Set(["food", "food_offline"]);

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isCurrentSubscription = (subscription: SubscriptionRow | null | undefined) => {
  if (!subscription || !foodPlans.has(subscription.plan_id) || !activeStatuses.has(subscription.status)) return false;
  const endAt = subscription.status === "trialing"
    ? subscription.trial_ends_at || subscription.current_period_ends_at
    : subscription.current_period_ends_at || subscription.trial_ends_at;
  return !endAt || new Date(endAt).getTime() > Date.now();
};

const mapCategory = (row: CategoryRow): MenuCategory => ({
  id: row.id,
  name: row.name,
  description: row.description || "",
  sortOrder: row.sort_order || 0,
  active: row.active,
  qrVisible: row.qr_visible,
});

const mapItem = (row: ItemRow): MenuItem => ({
  id: row.id,
  categoryId: row.category_id,
  displayName: row.display_name,
  description: row.description || "",
  price: toNumber(row.price),
  compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : toNumber(row.compare_at_price),
  imageUrl: row.image_url,
  imageAlt: row.image_alt || row.display_name,
  station: row.station,
  prepMinutes: row.prep_minutes || 0,
  tags: row.tags || [],
  sortOrder: row.sort_order || 0,
  featured: Boolean(row.featured),
  active: row.active,
  qrVisible: row.qr_visible,
  availableForDineIn: row.available_for_dine_in ?? true,
  availableForDelivery: row.available_for_delivery ?? true,
  promotion: null,
  options: [],
});

const calculatePromotionalPrice = (basePrice: number, promotion: Pick<MenuPromotion, "discountType" | "discountValue">) => {
  if (promotion.discountType === "fixed_price") return Math.max(0, promotion.discountValue);
  if (promotion.discountType === "percent") return Math.max(0, basePrice - (basePrice * promotion.discountValue) / 100);
  return Math.max(0, basePrice - promotion.discountValue);
};

const mapPromotion = (row: PromotionRow, basePrice?: number): MenuPromotion => {
  const promotion = {
    id: row.id,
    menuItemId: row.menu_item_id,
    title: row.title,
    description: row.description || "",
    badgeLabel: row.badge_label || "Oferta",
    discountType: row.discount_type,
    discountValue: toNumber(row.discount_value),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
    showOnMenu: row.show_on_menu,
    sortOrder: row.sort_order || 0,
  } satisfies MenuPromotion;

  if (typeof basePrice !== "number") return promotion;
  return {
    ...promotion,
    originalPrice: basePrice,
    promotionalPrice: calculatePromotionalPrice(basePrice, promotion),
  };
};

const mapTable = (row: TableRow): MenuTable => ({
  id: row.id,
  code: row.code,
  name: row.name,
  area: row.area,
  seats: row.seats,
  qrSlug: row.qr_slug,
  active: row.active,
});

const mapStoreAccount = (row: StoreAccountRow): AdminStoreAccount => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  productContext: row.product_context === "happycashfood" ? "happycashfood" : "happycash",
  displayName: titleCaseFallback(row.nome_estabelecimento || "", "Cantina Bella Mesa"),
  email: row.email || "",
  phone: row.telefone || "",
  addressLine: row.endereco || "",
  city: row.cidade || "",
  state: row.estado || "",
});

const mapProfile = (row: ProfileRow): AdminPublicProfile => ({
  id: row.id,
  storeAccountId: row.store_account_id,
  ownerUserId: row.owner_user_id,
  slug: row.public_slug,
  displayName: row.display_name,
  receiptName: row.receipt_name,
  description: row.description || "",
  logoUrl: row.logo_url,
  coverUrl: row.cover_url,
  phone: row.phone || "",
  whatsapp: row.whatsapp || "",
  addressLine: row.address_line || "",
  city: row.city || "",
  state: row.state || "",
  acceptsDineIn: row.accepts_dine_in,
  acceptsDelivery: row.accepts_delivery,
  deliveryFee: toNumber(row.delivery_fee),
  minimumOrderAmount: toNumber(row.minimum_order_amount),
  estimatedDeliveryMinutes: row.estimated_delivery_minutes || 45,
  isOpen: row.is_open,
  active: row.active,
  happyCashBrand: "HappyCashFood",
});

export const fetchPublicMenu = async (slug: string, tableSlug?: string | null): Promise<PublicMenuPayload> => {
  if (import.meta.env.DEV && (!slug || slug === fallbackMenu.store.slug)) {
    return {
      ...fallbackMenu,
      table: tableSlug
        ? {
            id: "fallback-table",
            code: "01",
            name: "Mesa 01",
            area: "Salao",
            seats: 4,
            qrSlug: tableSlug,
            active: true,
          }
        : null,
    };
  }

  const { data, error } = await menuCustomerSupabase.functions.invoke<PublicMenuPayload>("public-menu", {
    body: {
      slug: slug || fallbackMenu.store.slug,
      tableSlug: tableSlug || null,
    },
  });

  if (error || !data?.store) {
    if (!import.meta.env.DEV) {
      throw new Error(error?.message || "Cardapio indisponivel.");
    }

    return {
      ...fallbackMenu,
      table: tableSlug
        ? {
            id: "fallback-table",
            code: "01",
            name: "Mesa 01",
            area: "Salao",
            seats: 4,
            qrSlug: tableSlug,
            active: true,
          }
        : null,
    };
  }

  return data;
};

export const createPublicOrder = async (payload: {
  slug: string;
  tableSlug?: string | null;
  serviceType: "dine_in" | "delivery" | "takeaway";
  customer: CustomerInfo;
  items: CartItem[];
}): Promise<CreateOrderResponse> => {
  const { data, error } = await menuCustomerSupabase.functions.invoke<CreateOrderResponse>("create-public-menu-order", {
    body: payload,
  });

  if (error || !data?.success) {
    return {
      success: false,
      error: data?.error || error?.message || "Nao foi possivel enviar o pedido.",
    };
  }

  return data;
};

export const loadAdminBootstrap = async () => {
  const { data: authData, error: authError } = await menuAdminSupabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Entre com a conta que assinou o HappyCashFood.");
  }

  const { data: accountRow, error: accountError } = await menuAdminSupabase
    .from("store_accounts")
    .select("id, owner_user_id, product_context, nome_estabelecimento, email, telefone, endereco, cidade, estado")
    .maybeSingle<StoreAccountRow>();

  if (accountError || !accountRow) {
    throw new Error("Nao encontrei a empresa vinculada a esta conta.");
  }

  const account = mapStoreAccount(accountRow);
  if (account.productContext !== "happycashfood") {
    throw new Error("Esta area e exclusiva para empresas HappyCashFood.");
  }

  const { data: subscriptions, error: subscriptionError } = await menuAdminSupabase
    .from("store_subscriptions")
    .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
    .eq("owner_user_id", account.ownerUserId)
    .order("created_at", { ascending: false });

  if (subscriptionError) {
    throw new Error("Nao foi possivel validar o plano HappyCashFood.");
  }

  const hasFoodAccess = ((subscriptions as SubscriptionRow[] | null) || []).some(isCurrentSubscription);
  if (!hasFoodAccess) {
    throw new Error("O cardapio digital exige plano HappyCashFood ativo.");
  }

  const profileResult = await menuAdminSupabase
    .from("restaurant_public_profiles")
    .select("*")
    .eq("store_account_id", account.id)
    .maybeSingle<ProfileRow>();

  let profileRow = profileResult.data;
  if (profileResult.error) {
    throw new Error("Nao foi possivel carregar a vitrine do cardapio.");
  }

  if (!profileRow) {
    const fallbackSlug = normalizeSlug(account.displayName) || `loja-${account.id.slice(0, 8)}`;
    const { data: inserted, error: insertError } = await menuAdminSupabase
      .from("restaurant_public_profiles")
      .insert({
        store_account_id: account.id,
        owner_user_id: account.ownerUserId,
        public_slug: fallbackSlug,
        display_name: account.displayName,
        receipt_name: account.displayName,
        phone: account.phone,
        whatsapp: digitsOnly(account.phone),
        address_line: account.addressLine,
        city: account.city,
        state: account.state,
      })
      .select("*")
      .single<ProfileRow>();

    if (insertError || !inserted) {
      throw new Error("Nao foi possivel preparar o cardapio desta empresa.");
    }

    profileRow = inserted;
  }

  const [categoriesResult, itemsResult, tablesResult] = await Promise.all([
    menuAdminSupabase
      .from("restaurant_menu_categories")
      .select("id, name, description, sort_order, active, qr_visible")
      .eq("store_account_id", account.id)
      .order("sort_order", { ascending: true }),
    menuAdminSupabase
      .from("restaurant_menu_items")
      .select("id, category_id, display_name, description, price, compare_at_price, image_url, image_alt, station, prep_minutes, tags, sort_order, featured, active, qr_visible, available_for_dine_in, available_for_delivery")
      .eq("store_account_id", account.id)
      .order("sort_order", { ascending: true }),
    menuAdminSupabase
      .from("restaurant_tables")
      .select("id, code, name, area, seats, qr_slug, active")
      .eq("store_account_id", account.id)
      .order("code", { ascending: true }),
  ]);

  if (categoriesResult.error || itemsResult.error || tablesResult.error) {
    throw new Error("Nao foi possivel carregar mesas e cardapio.");
  }

  const { data: promotionRows, error: promotionError } = await menuAdminSupabase
    .from("restaurant_menu_promotions")
    .select("id, menu_item_id, title, description, badge_label, discount_type, discount_value, starts_at, ends_at, active, show_on_menu, sort_order")
    .eq("store_account_id", account.id)
    .order("sort_order", { ascending: true });

  if (promotionError) {
    throw new Error("Nao foi possivel carregar as promocoes.");
  }

  return {
    account,
    profile: mapProfile(profileRow),
    categories: ((categoriesResult.data as CategoryRow[] | null) || []).map(mapCategory),
    items: ((itemsResult.data as ItemRow[] | null) || []).map(mapItem),
    tables: ((tablesResult.data as TableRow[] | null) || []).map(mapTable),
    promotions: ((promotionRows as PromotionRow[] | null) || []).map(mapPromotion),
  };
};

export const savePublicProfile = async (profile: AdminPublicProfile) => {
  const { data, error } = await menuAdminSupabase
    .from("restaurant_public_profiles")
    .update({
      public_slug: normalizeSlug(profile.slug),
      display_name: profile.displayName.trim(),
      receipt_name: profile.receiptName.trim() || profile.displayName.trim(),
      description: profile.description.trim(),
      logo_url: profile.logoUrl || null,
      cover_url: profile.coverUrl || null,
      phone: profile.phone.trim(),
      whatsapp: digitsOnly(profile.whatsapp || profile.phone),
      address_line: profile.addressLine.trim(),
      city: profile.city.trim(),
      state: profile.state.trim().toUpperCase(),
      accepts_dine_in: profile.acceptsDineIn,
      accepts_delivery: profile.acceptsDelivery,
      delivery_fee: profile.deliveryFee,
      minimum_order_amount: profile.minimumOrderAmount,
      estimated_delivery_minutes: profile.estimatedDeliveryMinutes,
      is_open: profile.isOpen,
      active: profile.active,
    })
    .eq("id", profile.id)
    .select("*")
    .single<ProfileRow>();

  if (error || !data) throw new Error(error?.message || "Nao foi possivel salvar a vitrine.");
  return mapProfile(data);
};

export const upsertCategory = async (
  account: AdminStoreAccount,
  category: Partial<MenuCategory> & { name: string },
) => {
  const payload = {
    owner_user_id: account.ownerUserId,
    store_account_id: account.id,
    name: category.name.trim(),
    description: category.description?.trim() || "",
    sort_order: category.sortOrder || 0,
    active: category.active ?? true,
    qr_visible: category.qrVisible ?? true,
  };

  const query = category.id
    ? menuAdminSupabase.from("restaurant_menu_categories").update(payload).eq("id", category.id)
    : menuAdminSupabase.from("restaurant_menu_categories").insert(payload);

  const { data, error } = await query.select("id, name, description, sort_order, active, qr_visible").single<CategoryRow>();
  if (error || !data) throw new Error(error?.message || "Nao foi possivel salvar a categoria.");
  return mapCategory(data);
};

export const upsertMenuItem = async (
  account: AdminStoreAccount,
  item: Partial<MenuItem> & { displayName: string; price: number },
) => {
  const payload = {
    owner_user_id: account.ownerUserId,
    store_account_id: account.id,
    category_id: item.categoryId || null,
    display_name: item.displayName.trim(),
    description: item.description?.trim() || "",
    price: item.price || 0,
    compare_at_price: item.compareAtPrice || null,
    image_url: item.imageUrl || null,
    image_alt: item.imageAlt?.trim() || item.displayName.trim(),
    station: item.station || "kitchen",
    prep_minutes: item.prepMinutes || 10,
    tags: item.tags || [],
    sort_order: item.sortOrder || 0,
    featured: item.featured ?? false,
    active: item.active ?? true,
    qr_visible: item.qrVisible ?? true,
    available_for_dine_in: item.availableForDineIn ?? true,
    available_for_delivery: item.availableForDelivery ?? true,
  };

  const query = item.id
    ? menuAdminSupabase.from("restaurant_menu_items").update(payload).eq("id", item.id)
    : menuAdminSupabase.from("restaurant_menu_items").insert(payload);

  const { data, error } = await query
    .select("id, category_id, display_name, description, price, compare_at_price, image_url, image_alt, station, prep_minutes, tags, sort_order, featured, active, qr_visible, available_for_dine_in, available_for_delivery")
    .single<ItemRow>();

  if (error || !data) throw new Error(error?.message || "Nao foi possivel salvar o produto.");
  return mapItem(data);
};

export const upsertTable = async (
  account: AdminStoreAccount,
  table: Partial<MenuTable> & { code: string },
) => {
  const payload = {
    owner_user_id: account.ownerUserId,
    store_account_id: account.id,
    code: table.code.trim(),
    name: table.name?.trim() || `Mesa ${table.code.trim()}`,
    area: table.area?.trim() || "Salao",
    seats: table.seats || 4,
    active: table.active ?? true,
  };

  const query = table.id
    ? menuAdminSupabase.from("restaurant_tables").update(payload).eq("id", table.id)
    : menuAdminSupabase.from("restaurant_tables").insert(payload);

  const { data, error } = await query
    .select("id, code, name, area, seats, qr_slug, active")
    .single<TableRow>();

  if (error || !data) throw new Error(error?.message || "Nao foi possivel salvar a mesa.");
  return mapTable(data);
};

export const upsertPromotion = async (
  account: AdminStoreAccount,
  promotion: Partial<MenuPromotion> & { menuItemId: string; title: string; discountValue: number },
) => {
  const payload = {
    owner_user_id: account.ownerUserId,
    store_account_id: account.id,
    menu_item_id: promotion.menuItemId,
    title: promotion.title.trim(),
    description: promotion.description?.trim() || "",
    badge_label: promotion.badgeLabel?.trim() || "Oferta",
    discount_type: promotion.discountType || "amount",
    discount_value: promotion.discountValue || 0,
    starts_at: promotion.startsAt || new Date().toISOString().slice(0, 10),
    ends_at: promotion.endsAt || null,
    active: promotion.active ?? true,
    show_on_menu: promotion.showOnMenu ?? true,
    sort_order: promotion.sortOrder || 0,
  };

  const query = promotion.id
    ? menuAdminSupabase.from("restaurant_menu_promotions").update(payload).eq("id", promotion.id)
    : menuAdminSupabase.from("restaurant_menu_promotions").insert(payload);

  const { data, error } = await query
    .select("id, menu_item_id, title, description, badge_label, discount_type, discount_value, starts_at, ends_at, active, show_on_menu, sort_order")
    .single<PromotionRow>();

  if (error || !data) throw new Error(error?.message || "Nao foi possivel salvar a promocao.");
  return mapPromotion(data);
};

export const uploadMenuImage = async (accountId: string, file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const path = `${accountId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await menuAdminSupabase.storage
    .from("restaurant-menu-images")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

  if (error || !data) throw new Error(error?.message || "Nao foi possivel enviar a imagem.");

  const { data: publicData } = menuAdminSupabase.storage.from("restaurant-menu-images").getPublicUrl(data.path);
  return publicData.publicUrl;
};
