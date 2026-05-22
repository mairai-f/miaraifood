import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AgendaBrandingSettings = {
  id?: string;
  ownerUserId?: string;
  storeAccountId?: string;
  slug: string;
  displayName: string;
  businessType: string;
  professionalLabel: string;
  serviceLabel: string;
  tagline: string;
  logoUrl: string;
  primaryHsl: string;
  accentHsl: string;
  successHsl: string;
  publicBookingEnabled: boolean;
};

type AgendaBrandingContextType = {
  settings: AgendaBrandingSettings;
  loading: boolean;
  updatePreview: (settings: AgendaBrandingSettings) => void;
  saveSettings: (settings: AgendaBrandingSettings) => Promise<{ error: string | null }>;
  resetPreview: () => void;
};

type AgendaBusinessSettingsRow = {
  id: string;
  owner_user_id: string;
  store_account_id: string | null;
  slug: string;
  display_name: string;
  business_type: string;
  professional_label: string;
  service_label: string;
  tagline: string;
  logo_url: string | null;
  primary_hsl: string;
  accent_hsl: string;
  success_hsl: string;
  public_booking_enabled: boolean;
};

type AgendaBusinessSettingsUpsert = {
  owner_user_id: string;
  slug: string;
  display_name: string;
  business_type: string;
  professional_label: string;
  service_label: string;
  tagline: string;
  logo_url: string | null;
  primary_hsl: string;
  accent_hsl: string;
  success_hsl: string;
  public_booking_enabled: boolean;
};

type QueryError = { message: string } | null;

type QueryResponse<T> = Promise<{
  data: T | null;
  error: QueryError;
}>;

type SettingsFilterBuilder<T> = {
  eq(column: string, value: string | boolean): SettingsFilterBuilder<T>;
  order(column: string, options: { ascending: boolean }): SettingsFilterBuilder<T>;
  limit(count: number): SettingsFilterBuilder<T>;
  maybeSingle(): QueryResponse<T>;
  single(): QueryResponse<T>;
};

type SettingsTableClient<T> = {
  select(columns: string): SettingsFilterBuilder<T>;
  upsert(
    values: AgendaBusinessSettingsUpsert,
    options: { onConflict: string },
  ): {
    select(columns: string): SettingsFilterBuilder<T>;
  };
};

type AgendaSettingsClient = {
  from(table: "agenda_business_settings"): SettingsTableClient<AgendaBusinessSettingsRow>;
};

const DEFAULT_BRANDING: AgendaBrandingSettings = {
  ownerUserId: undefined,
  storeAccountId: undefined,
  slug: "happycash-agenda",
  displayName: "HappyCash Agenda",
  businessType: "Serviços em geral",
  professionalLabel: "Profissional",
  serviceLabel: "Serviço",
  tagline: "Agenda, pagamentos, clientes e WhatsApp no mesmo fluxo.",
  logoUrl: "",
  primaryHsl: "258 84% 58%",
  accentHsl: "44 96% 56%",
  successHsl: "151 74% 43%",
  publicBookingEnabled: true,
};

const STORAGE_KEY = "happycash_agenda_branding_preview";

const AgendaBrandingContext = createContext<AgendaBrandingContextType | undefined>(undefined);

const getSettingsClient = () => supabase as unknown as AgendaSettingsClient;

const isBrowser = () => typeof window !== "undefined";

const slugify = (value: string) => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

  return slug.length >= 2 ? slug : DEFAULT_BRANDING.slug;
};

const sanitizeHsl = (value: string, fallback: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  return /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(normalized) ? normalized : fallback;
};

const sanitizeSettings = (settings: AgendaBrandingSettings): AgendaBrandingSettings => ({
  ...DEFAULT_BRANDING,
  ...settings,
  slug: slugify(settings.slug || settings.displayName || DEFAULT_BRANDING.slug),
  displayName: (settings.displayName || "").trim() || DEFAULT_BRANDING.displayName,
  businessType: (settings.businessType || "").trim() || DEFAULT_BRANDING.businessType,
  professionalLabel: (settings.professionalLabel || "").trim() || DEFAULT_BRANDING.professionalLabel,
  serviceLabel: (settings.serviceLabel || "").trim() || DEFAULT_BRANDING.serviceLabel,
  tagline: (settings.tagline || "").trim() || DEFAULT_BRANDING.tagline,
  logoUrl: (settings.logoUrl || "").trim(),
  primaryHsl: sanitizeHsl(settings.primaryHsl, DEFAULT_BRANDING.primaryHsl),
  accentHsl: sanitizeHsl(settings.accentHsl, DEFAULT_BRANDING.accentHsl),
  successHsl: sanitizeHsl(settings.successHsl, DEFAULT_BRANDING.successHsl),
});

const rowToSettings = (row: AgendaBusinessSettingsRow): AgendaBrandingSettings => ({
  id: row.id,
  ownerUserId: row.owner_user_id,
  storeAccountId: row.store_account_id ?? undefined,
  slug: row.slug,
  displayName: row.display_name,
  businessType: row.business_type,
  professionalLabel: row.professional_label,
  serviceLabel: row.service_label,
  tagline: row.tagline,
  logoUrl: row.logo_url ?? "",
  primaryHsl: row.primary_hsl,
  accentHsl: row.accent_hsl,
  successHsl: row.success_hsl,
  publicBookingEnabled: row.public_booking_enabled,
});

const settingsToUpsert = (
  settings: AgendaBrandingSettings,
  ownerUserId: string,
): AgendaBusinessSettingsUpsert => ({
  owner_user_id: ownerUserId,
  slug: settings.slug,
  display_name: settings.displayName,
  business_type: settings.businessType,
  professional_label: settings.professionalLabel,
  service_label: settings.serviceLabel,
  tagline: settings.tagline,
  logo_url: settings.logoUrl || null,
  primary_hsl: settings.primaryHsl,
  accent_hsl: settings.accentHsl,
  success_hsl: settings.successHsl,
  public_booking_enabled: settings.publicBookingEnabled,
});

const readPreview = () => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitizeSettings(JSON.parse(raw) as AgendaBrandingSettings);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const writePreview = (settings: AgendaBrandingSettings) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const resolvePublicSlug = () => {
  if (!isBrowser()) return import.meta.env.VITE_AGENDA_BUSINESS_SLUG?.trim() || "";

  const params = new URLSearchParams(window.location.search);
  return (
    params.get("empresa")?.trim() ||
    params.get("agenda")?.trim() ||
    import.meta.env.VITE_AGENDA_BUSINESS_SLUG?.trim() ||
    ""
  );
};

const applyBrandingToDocument = (settings: AgendaBrandingSettings) => {
  if (!isBrowser()) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", settings.primaryHsl);
  root.style.setProperty("--ring", settings.primaryHsl);
  root.style.setProperty("--accent", settings.accentHsl);
  root.style.setProperty("--gold", settings.accentHsl);
  root.style.setProperty("--success", settings.successHsl);
};

export function AgendaBrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AgendaBrandingSettings>(() => readPreview() ?? DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const publicSlug = useMemo(resolvePublicSlug, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const client = getSettingsClient();
    const table = client.from("agenda_business_settings");
    const columns =
      "id, owner_user_id, store_account_id, slug, display_name, business_type, professional_label, service_label, tagline, logo_url, primary_hsl, accent_hsl, success_hsl, public_booking_enabled";

    const response = publicSlug
      ? await table.select(columns).eq("slug", publicSlug).eq("public_booking_enabled", true).maybeSingle()
      : user?.id
        ? await table.select(columns).eq("owner_user_id", user.id).maybeSingle()
        : await table.select(columns).eq("slug", DEFAULT_BRANDING.slug).eq("public_booking_enabled", true).maybeSingle();

    if (response.data) {
      const nextSettings = sanitizeSettings(rowToSettings(response.data));
      setSettings(nextSettings);
      writePreview(nextSettings);
    }

    setLoading(false);
  }, [publicSlug, user?.id]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    applyBrandingToDocument(settings);
  }, [settings]);

  const updatePreview = useCallback((nextSettings: AgendaBrandingSettings) => {
    const sanitized = sanitizeSettings(nextSettings);
    setSettings(sanitized);
    writePreview(sanitized);
  }, []);

  const saveSettings = useCallback(
    async (nextSettings: AgendaBrandingSettings) => {
      const sanitized = sanitizeSettings(nextSettings);

      if (!user?.id) {
        updatePreview(sanitized);
        return { error: null };
      }

      const response = await getSettingsClient()
        .from("agenda_business_settings")
        .upsert(settingsToUpsert(sanitized, user.id), { onConflict: "owner_user_id" })
        .select(
          "id, owner_user_id, store_account_id, slug, display_name, business_type, professional_label, service_label, tagline, logo_url, primary_hsl, accent_hsl, success_hsl, public_booking_enabled",
        )
        .single();

      if (response.error) {
        return { error: response.error.message };
      }

      if (response.data) {
        const savedSettings = sanitizeSettings(rowToSettings(response.data));
        setSettings(savedSettings);
        writePreview(savedSettings);
      }

      return { error: null };
    },
    [updatePreview, user?.id],
  );

  const resetPreview = useCallback(() => {
    setSettings(DEFAULT_BRANDING);
    writePreview(DEFAULT_BRANDING);
  }, []);

  const value = useMemo<AgendaBrandingContextType>(
    () => ({
      settings,
      loading,
      updatePreview,
      saveSettings,
      resetPreview,
    }),
    [loading, resetPreview, saveSettings, settings, updatePreview],
  );

  return (
    <AgendaBrandingContext.Provider value={value}>
      {children}
    </AgendaBrandingContext.Provider>
  );
}

export function useAgendaBranding() {
  const context = useContext(AgendaBrandingContext);
  if (!context) {
    throw new Error("useAgendaBranding must be used within AgendaBrandingProvider");
  }
  return context;
}
