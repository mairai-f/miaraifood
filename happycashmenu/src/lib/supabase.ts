import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const createMenuClient = (storageKey: string) => createClient(supabaseUrl || "https://example.supabase.co", supabasePublishableKey || "anon", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey,
  },
});

export const menuAdminSupabase = createMenuClient("happycash:menu:admin-auth");
export const menuCustomerSupabase = createMenuClient("happycash:menu:customer-auth");

export const supabase = menuCustomerSupabase;
