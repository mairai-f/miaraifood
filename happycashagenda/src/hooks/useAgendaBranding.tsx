import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAppLocationSnapshot, subscribeAppLocation } from "@/lib/locationStore";
import { useAuth } from "@/hooks/useAuth";
import { isAgendaAdminPath, resolveAgendaPublicSlug } from "@/lib/agendaSlug";

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
  heroImageUrl: string;
  aboutImageUrl: string;
  teamImageUrl: string;
  locationImageUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  closedMessage: string;
  aboutTitle: string;
  aboutText: string;
  address: string;
  whatsapp: string;
  adminWhatsapp: string;
  pixKey: string;
  pixMerchantName: string;
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
  hero_image_url: string | null;
  about_image_url: string | null;
  team_image_url: string | null;
  location_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  closed_message: string | null;
  about_title: string | null;
  about_text: string | null;
  address: string | null;
  whatsapp: string | null;
  admin_whatsapp: string | null;
  pix_key: string | null;
  pix_merchant_name: string | null;
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
  hero_image_url: string | null;
  about_image_url: string | null;
  team_image_url: string | null;
  location_image_url: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  closed_message: string | null;
  about_title: string | null;
  about_text: string | null;
  address: string | null;
  whatsapp: string | null;
  admin_whatsapp: string | null;
  pix_key: string | null;
  pix_merchant_name: string | null;
  primary_hsl: string;
  accent_hsl: string;
  success_hsl: string;
  public_booking_enabled: boolean;
};

const SETTINGS_COLUMNS_BASE =
  "id, owner_user_id, store_account_id, slug, display_name, business_type, professional_label, service_label, tagline, logo_url, primary_hsl, accent_hsl, success_hsl, public_booking_enabled";

const SETTINGS_COLUMNS_EXTENDED =
  `${SETTINGS_COLUMNS_BASE}, hero_image_url, about_image_url, team_image_url, location_image_url, hero_title, hero_subtitle, closed_message, about_title, about_text, address, whatsapp, admin_whatsapp, pix_key, pix_merchant_name`;

const isMissingColumnError = (message: string) =>
  /column|schema cache|does not exist|PGRST204/i.test(message);

const DEFAULT_BRANDING: AgendaBrandingSettings = {
  ownerUserId: undefined,
  storeAccountId: undefined,
  slug: "happycash-agenda",
  displayName: "HappyCash Agenda",
  businessType: "Servicos em geral",
  professionalLabel: "Profissional",
  serviceLabel: "Servico",
  tagline: "Agenda, pagamentos, clientes e WhatsApp no mesmo fluxo.",
  logoUrl: "",
  heroImageUrl: "",
  aboutImageUrl: "",
  teamImageUrl: "",
  locationImageUrl: "",
  heroTitle: "",
  heroSubtitle: "",
  closedMessage: "Estamos fechados no momento. Volte em breve!",
  aboutTitle: "Sobre nos",
  aboutText: "",
  address: "",
  whatsapp: "",
  adminWhatsapp: "",
  pixKey: "",
  pixMerchantName: "",
  primaryHsl: "258 84% 58%",
  accentHsl: "44 96% 56%",
  successHsl: "151 74% 43%",
  publicBookingEnabled: true,
};

const STORAGE_KEY = "happycash_agenda_branding_preview";

const AgendaBrandingContext = createContext<AgendaBrandingContextType | undefined>(undefined);

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
  heroImageUrl: (settings.heroImageUrl || "").trim(),
  aboutImageUrl: (settings.aboutImageUrl || "").trim(),
  teamImageUrl: (settings.teamImageUrl || "").trim(),
  locationImageUrl: (settings.locationImageUrl || "").trim(),
  heroTitle: (settings.heroTitle || "").trim(),
  heroSubtitle: (settings.heroSubtitle || "").trim(),
  closedMessage: (settings.closedMessage || "").trim() || DEFAULT_BRANDING.closedMessage,
  aboutTitle: (settings.aboutTitle || "").trim() || DEFAULT_BRANDING.aboutTitle,
  aboutText: (settings.aboutText || "").trim(),
  address: (settings.address || "").trim(),
  whatsapp: (settings.whatsapp || "").trim(),
  adminWhatsapp: (settings.adminWhatsapp || "").trim(),
  pixKey: (settings.pixKey || "").trim(),
  pixMerchantName: (settings.pixMerchantName || "").trim() || (settings.displayName || "").trim(),
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
  heroImageUrl: row.hero_image_url ?? "",
  aboutImageUrl: row.about_image_url ?? "",
  teamImageUrl: row.team_image_url ?? "",
  locationImageUrl: row.location_image_url ?? "",
  heroTitle: row.hero_title ?? "",
  heroSubtitle: row.hero_subtitle ?? "",
  closedMessage: row.closed_message ?? DEFAULT_BRANDING.closedMessage,
  aboutTitle: row.about_title ?? DEFAULT_BRANDING.aboutTitle,
  aboutText: row.about_text ?? "",
  address: row.address ?? "",
  whatsapp: row.whatsapp ?? "",
  adminWhatsapp: row.admin_whatsapp ?? "",
  pixKey: row.pix_key ?? "",
  pixMerchantName: row.pix_merchant_name ?? row.display_name,
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
  hero_image_url: settings.heroImageUrl || null,
  about_image_url: settings.aboutImageUrl || null,
  team_image_url: settings.teamImageUrl || null,
  location_image_url: settings.locationImageUrl || null,
  hero_title: settings.heroTitle || null,
  hero_subtitle: settings.heroSubtitle || null,
  closed_message: settings.closedMessage || null,
  about_title: settings.aboutTitle || null,
  about_text: settings.aboutText || null,
  address: settings.address || null,
  whatsapp: settings.whatsapp || null,
  admin_whatsapp: settings.adminWhatsapp || null,
  pix_key: settings.pixKey || null,
  pix_merchant_name: settings.pixMerchantName || null,
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
  const location = useSyncExternalStore(subscribeAppLocation, getAppLocationSnapshot, getAppLocationSnapshot);
  const [settings, setSettings] = useState<AgendaBrandingSettings>(() => readPreview() ?? DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const publicSlug = useMemo(() => {
    if (isBrowser() && user?.id && isAgendaAdminPath(location.pathname)) {
      return "";
    }
    return resolveAgendaPublicSlug(location.pathname, location.search);
  }, [location.pathname, location.search, user?.id]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const table = supabase.from("agenda_business_settings");

    const scopedQuery = publicSlug
      ? table.select(SETTINGS_COLUMNS_EXTENDED).eq("slug", publicSlug).eq("public_booking_enabled", true)
      : user?.id
        ? table.select(SETTINGS_COLUMNS_EXTENDED).eq("owner_user_id", user.id)
        : table
            .select(SETTINGS_COLUMNS_EXTENDED)
            .eq("slug", DEFAULT_BRANDING.slug)
            .eq("public_booking_enabled", true);

    let response = await scopedQuery.maybeSingle();

    if (response.error && isMissingColumnError(response.error.message)) {
      const fallbackQuery = publicSlug
        ? table.select(SETTINGS_COLUMNS_BASE).eq("slug", publicSlug).eq("public_booking_enabled", true)
        : user?.id
          ? table.select(SETTINGS_COLUMNS_BASE).eq("owner_user_id", user.id)
          : table
              .select(SETTINGS_COLUMNS_BASE)
              .eq("slug", DEFAULT_BRANDING.slug)
              .eq("public_booking_enabled", true);
      response = await fallbackQuery.maybeSingle();
    }

    if (response.data) {
      const nextSettings = sanitizeSettings(rowToSettings(response.data as AgendaBusinessSettingsRow));
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

      const upsertPayload = settingsToUpsert(sanitized, user.id);
      let response = await supabase
        .from("agenda_business_settings")
        .upsert(upsertPayload, { onConflict: "owner_user_id" })
        .select(SETTINGS_COLUMNS_EXTENDED)
        .single();

      if (response.error && isMissingColumnError(response.error.message)) {
        const { hero_image_url, about_image_url, team_image_url, location_image_url, hero_title, hero_subtitle, closed_message, about_title, about_text, address, whatsapp, admin_whatsapp, pix_key, pix_merchant_name, ...basePayload } = upsertPayload;
        void hero_image_url;
        void about_image_url;
        void team_image_url;
        void location_image_url;
        void hero_title;
        void hero_subtitle;
        void closed_message;
        void about_title;
        void about_text;
        void address;
        void whatsapp;
        void admin_whatsapp;
        void pix_key;
        void pix_merchant_name;

        response = await supabase
          .from("agenda_business_settings")
          .upsert(basePayload, { onConflict: "owner_user_id" })
          .select(SETTINGS_COLUMNS_BASE)
          .single();
      }

      if (response.error) {
        return { error: response.error.message };
      }

      if (response.data) {
        const savedSettings = sanitizeSettings(rowToSettings(response.data as AgendaBusinessSettingsRow));
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
