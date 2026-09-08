import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

type Item = { productId?: string; quantity?: number; notes?: string };
type Body = { action?: string; token?: string; guestToken?: string; items?: Item[]; appetiteLevel?: string | null; experienceMode?: string | null; partySizeHint?: number | null };
const tokenOk = (token: unknown) => typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, "0")).join("");
const reply = (request: Request, body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...Object.fromEntries(buildCorsHeaders(request, { allowedMethods: ["POST", "OPTIONS"] }).headers), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleCorsPreflight(request, { allowedMethods: ["POST", "OPTIONS"] });
  if (request.method !== "POST") return reply(request, { error: "Método não suportado." }, 405);
  if (!buildCorsHeaders(request, { allowedMethods: ["POST", "OPTIONS"] }).allowed) return reply(request, { error: "Origem não permitida." }, 403);
  let body: Body; try { body = await request.json(); } catch { return reply(request, { error: "Requisição inválida." }, 400); }
  if (!tokenOk(body.token)) return reply(request, { error: "QR Code inválido." }, 400);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply(request, { error: "Serviço indisponível." }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: credential } = await db.from("food_table_qr_credentials").select("table_id").eq("qr_token", body.token).maybeSingle();
  if (!credential) return reply(request, { error: "Esta mesa não está disponível." }, 404);
  const { data: table } = await db.from("food_tables").select("id,code,name,owner_user_id,store_account_id,location_id,store_accounts(nome_estabelecimento)").eq("id", credential.table_id).eq("active", true).maybeSingle();
  if (!table) return reply(request, { error: "Esta mesa não está disponível." }, 404);
  const { data: session } = await db.from("food_table_sessions").select("id,guest_count").eq("table_id", table.id).in("status", ["open", "awaiting_payment"]).order("opened_at", { ascending: false }).limit(1).maybeSingle();
  const { data: products, error: productError } = await db.from("products").select("id,name,price,category").eq("user_id", table.owner_user_id).eq("deleted", false).order("category").order("name");
  if (productError) return reply(request, { error: "Não foi possível carregar o cardápio." }, 500);
  const { data: menuEntries } = await db.from("food_menu_products").select("product_id,description,image_url,featured,sort_order").eq("store_account_id", table.store_account_id).eq("active", true).order("sort_order");
  const menuByProductId = new Map((menuEntries ?? []).map((entry) => [entry.product_id, entry]));
  const menuProducts = (products ?? []).filter((product) => menuByProductId.has(product.id)).map((product) => ({ ...product, ...menuByProductId.get(product.id) }));
  const getGuest = async () => {
    if (!session || !tokenOk(body.guestToken)) return null;
    const { data } = await db.from("food_guest_sessions").select("id,appetite_level,experience_mode,party_size_hint").eq("table_session_id", session.id).eq("token_hash", await hash(body.guestToken!)).is("revoked_at", null).maybeSingle();
    return data;
  };
  if (body.action === "resolve") {
    const guest = await getGuest(); let tableTotal = 0; let ownOrders: unknown[] = [];
    if (session) { const { data: orders } = await db.from("food_orders").select("id,total,status,guest_session_id,created_at,food_order_items(product_name,quantity,total,notes,status)").eq("table_session_id", session.id).neq("status", "cancelled").order("created_at", { ascending: false }); tableTotal = (orders ?? []).reduce((sum, order) => sum + Number(order.total), 0); if (guest) ownOrders = (orders ?? []).filter((order) => order.guest_session_id === guest.id).map((order) => ({ id: order.id, total: order.total, status: order.status, createdAt: order.created_at, items: (order.food_order_items ?? []).filter((item: { status: string }) => item.status !== "cancelled") })); }
    return reply(request, { establishmentName: (table.store_accounts as { nome_estabelecimento?: string } | null)?.nome_estabelecimento || "Miaifood", table: { code: table.code, name: table.name }, products: menuProducts, sessionOpen: Boolean(session), sessionGuestCount: session?.guest_count ?? null, guest, ownOrders, tableTotal });
  }
  if (!session) return reply(request, { error: "A mesa ainda não foi aberta pela equipe." }, 409);
  if (body.action === "start_guest") {
    const appetite = body.appetiteLevel ?? null, mode = body.experienceMode ?? null, party = body.partySizeHint ?? null;
    if (appetite && !["low", "moderate", "high"].includes(appetite) || mode && !["calm", "fast", "suggestions"].includes(mode) || party !== null && (!Number.isInteger(party) || party < 1 || party > 20)) return reply(request, { error: "Preferências inválidas." }, 400);
    const guestToken = randomToken();
    const { data: guest, error } = await db.from("food_guest_sessions").insert({ table_session_id: session.id, token_hash: await hash(guestToken), appetite_level: appetite, experience_mode: mode, party_size_hint: party }).select("id,appetite_level,experience_mode,party_size_hint").single();
    return error || !guest ? reply(request, { error: "Não foi possível iniciar sua sessão." }, 500) : reply(request, { guestToken, guest });
  }
  const guest = await getGuest();
  if (!guest) return reply(request, { error: "Sua sessão expirou. Refaça o início rápido." }, 409);
  if (body.action === "update_guest") {
    const appetite = body.appetiteLevel ?? null, mode = body.experienceMode ?? null, party = body.partySizeHint ?? null;
    if (appetite && !["low", "moderate", "high"].includes(appetite) || mode && !["calm", "fast", "suggestions"].includes(mode) || party !== null && (!Number.isInteger(party) || party < 1 || party > 20)) return reply(request, { error: "Preferências inválidas." }, 400);
    const { error } = await db.from("food_guest_sessions").update({ appetite_level: appetite, experience_mode: mode, party_size_hint: party, last_seen_at: new Date().toISOString() }).eq("id", guest.id);
    return error ? reply(request, { error: "Não foi possível salvar suas preferências." }, 500) : reply(request, { success: true });
  }
  if (body.action === "call_waiter") {
    const { data: recent } = await db.from("food_waiter_calls").select("id").eq("guest_session_id", guest.id).in("status", ["open", "acknowledged"]).gte("created_at", new Date(Date.now() - 60_000).toISOString()).limit(1);
    if (recent?.length) return reply(request, { success: true, alreadyOpen: true });
    const { error } = await db.from("food_waiter_calls").insert({ table_session_id: session.id, guest_session_id: guest.id });
    return error ? reply(request, { error: "Não foi possível chamar o garçom." }, 500) : reply(request, { success: true });
  }
  if (body.action !== "submit" || !Array.isArray(body.items) || !body.items.length || body.items.length > 40) return reply(request, { error: "Informe ao menos um item válido." }, 400);
  const quantities = new Map<string, { quantity: number; notes: string }>();
  for (const item of body.items) { if (typeof item.productId !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return reply(request, { error: "Itens inválidos." }, 400); const previous = quantities.get(item.productId); const quantity = (previous?.quantity ?? 0) + item.quantity; if (quantity > 99) return reply(request, { error: "Quantidade máxima por item: 99." }, 400); quantities.set(item.productId, { quantity, notes: String(item.notes ?? "").trim().slice(0, 300) }); }
  const selected = menuProducts.filter((product) => quantities.has(product.id)); if (selected.length !== quantities.size) return reply(request, { error: "Um ou mais produtos não estão mais no cardápio." }, 409);
  const scope = { store_account_id: table.store_account_id, owner_user_id: table.owner_user_id, location_id: table.location_id };
  const total = selected.reduce((sum, product) => sum + Number(product.price) * quantities.get(product.id)!.quantity, 0);
  const { data: order, error: orderError } = await db.from("food_orders").insert({ ...scope, table_session_id: session.id, guest_session_id: guest.id, source: "qrmenu", status: "submitted", subtotal: total, total, submitted_at: new Date().toISOString() }).select("id").single();
  if (orderError || !order) return reply(request, { error: "Não foi possível registrar o pedido." }, 500);
  const rows = selected.map((product) => { const item = quantities.get(product.id)!; const price = Number(product.price); return { ...scope, order_id: order.id, product_id: product.id, product_name: product.name, quantity: item.quantity, unit_price: price, total: price * item.quantity, notes: item.notes }; });
  const { error: itemError } = await db.from("food_order_items").insert(rows);
  if (itemError) { await db.from("food_orders").delete().eq("id", order.id); return reply(request, { error: "Não foi possível registrar os itens." }, 500); }
  await db.from("food_order_events").insert({ ...scope, order_id: order.id, actor_type: "customer", event_type: "submitted_from_qrmenu", details: { guest_session_id: guest.id, item_count: rows.length } });
  return reply(request, { success: true, orderId: order.id });
});
