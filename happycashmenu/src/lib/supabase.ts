import { createClient } from "@supabase/supabase-js";
import { createAdaptiveStorage } from "../../../shared/security/browserStorage";
import { cleanupLegacySupabaseAuthStorage } from "../../../shared/security/supabaseAuthStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const shouldPersistMenuSession = () => false;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const createMenuClient = (storageKey: string) => createClient(supabaseUrl || "https://example.supabase.co", supabasePublishableKey || "anon", {
  auth: {
    storage: createAdaptiveStorage(shouldPersistMenuSession),
    persistSession: true,
    autoRefreshToken: true,
    storageKey,
  },
});

cleanupLegacySupabaseAuthStorage("happycash:menu:admin-auth");
cleanupLegacySupabaseAuthStorage("happycash:menu:customer-auth");

export const menuAdminSupabase = createMenuClient("happycash:menu:admin-auth");
export const menuCustomerSupabase = createMenuClient("happycash:menu:customer-auth");

export const supabase = menuCustomerSupabase;
