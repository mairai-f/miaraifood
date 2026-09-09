import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const response = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...Object.fromEntries(buildCorsHeaders(request, { allowedMethods: ["POST", "OPTIONS"] }).headers.entries()), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return handleCorsPreflight(request, { allowedMethods: ["POST", "OPTIONS"] });
  if (request.method !== "POST") return response(request, { error: "Metodo nao suportado." }, 405);
  const { email, productContext = "happycash" } = await request.json().catch(() => ({}));
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized.includes("@") || normalized.length < 5) return response(request, { valid: false, available: null });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return response(request, { error: "Configuracao indisponivel." }, 500);
  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users?.users?.find((item) => item.email?.toLowerCase() === normalized);
  if (!user) return response(request, { valid: true, available: true });
  const { data: pending } = await service.from("site_pending_registrations").select("status, product_context").eq("owner_user_id", user.id).eq("product_context", productContext).maybeSingle();
  const { data: account } = await service.from("store_accounts").select("id").eq("owner_user_id", user.id).eq("product_context", productContext).maybeSingle();
  return response(request, { valid: true, available: false, canResume: pending?.status === "pending", hasAccount: Boolean(account) });
});
