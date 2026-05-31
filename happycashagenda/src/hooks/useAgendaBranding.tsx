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
  logoSize: number;
  heroImageUrl: string;
  heroImagePositionX: number;
  heroImagePositionY: number;
  heroImageScale: number;
  aboutImageUrl: string;
  aboutImagePositionX: number;
  aboutImagePositionY: number;
  aboutImageScale: number;
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
  facebookUrl: string;
  instagramUrl: string;
  pixKey: string;
  pixMerchantName: string;
  primaryHsl: string;
  accentHsl: string;
  successHsl: string;
  publicBookingEnabled: boolean;
  serviceMode: "appointment" | "walk_in" | "both";
  publicQueueVisible: boolean;
  rescheduleNoticeHours: number;
  cancellationNoticeHours: number;
  reminderEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;
  soundNotificationsEnabled: boolean;
  soundNewAppointmentEnabled: boolean;
  soundRescheduleEnabled: boolean;
  soundCancellationEnabled: boolean;
  soundCompletionEnabled: boolean;
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
  logo_size: number | null;
  hero_image_url: string | null;
  hero_image_position_x: number | null;
  hero_image_position_y: number | null;
  hero_image_scale: number | null;
  about_image_url: string | null;
  about_image_position_x: number | null;
  about_image_position_y: number | null;
  about_image_scale: number | null;
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
  facebook_url: string | null;
  instagram_url: string | null;
  pix_key: string | null;
  pix_merchant_name: string | null;
  primary_hsl: string;
  accent_hsl: string;
  success_hsl: string;
  public_booking_enabled: boolean;
  service_mode?: "appointment" | "walk_in" | "both" | null;
  public_queue_visible?: boolean | null;
  reschedule_notice_hours?: number | null;
  cancellation_notice_hours?: number | null;
  reminder_enabled?: boolean | null;
  reminder_24h_enabled?: boolean | null;
  reminder_2h_enabled?: boolean | null;
  reminder_30m_enabled?: boolean | null;
  sound_notifications_enabled?: boolean | null;
  sound_new_appointment_enabled?: boolean | null;
  sound_reschedule_enabled?: boolean | null;
  sound_cancellation_enabled?: boolean | null;
  sound_completion_enabled?: boolean | null;
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
  logo_size: number;
  hero_image_url: string | null;
  hero_image_position_x: number;
  hero_image_position_y: number;
  hero_image_scale: number;
  about_image_url: string | null;
  about_image_position_x: number;
  about_image_position_y: number;
  about_image_scale: number;
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
  facebook_url: string | null;
  instagram_url: string | null;
  pix_key: string | null;
  pix_merchant_name: string | null;
  primary_hsl: string;
  accent_hsl: string;
  success_hsl: string;
  public_booking_enabled: boolean;
  service_mode: "appointment" | "walk_in" | "both";
  public_queue_visible: boolean;
  reschedule_notice_hours: number;
  cancellation_notice_hours: number;
  reminder_enabled: boolean;
  reminder_24h_enabled: boolean;
  reminder_2h_enabled: boolean;
  reminder_30m_enabled: boolean;
  sound_notifications_enabled: boolean;
  sound_new_appointment_enabled: boolean;
  sound_reschedule_enabled: boolean;
  sound_cancellation_enabled: boolean;
  sound_completion_enabled: boolean;
};

const SETTINGS_COLUMNS_BASE =
  "id, owner_user_id, store_account_id, slug, display_name, business_type, professional_label, service_label, tagline, logo_url, primary_hsl, accent_hsl, success_hsl, public_booking_enabled";

const SETTINGS_COLUMNS_PUBLIC_PAGE =
  `${SETTINGS_COLUMNS_BASE}, logo_size, hero_image_url, hero_image_position_x, hero_image_position_y, hero_image_scale, about_image_url, about_image_position_x, about_image_position_y, about_image_scale, team_image_url, location_image_url, hero_title, hero_subtitle, closed_message, about_title, about_text, address, whatsapp, admin_whatsapp, facebook_url, instagram_url, pix_key, pix_merchant_name`;

const SETTINGS_COLUMNS_EXTENDED =
  `${SETTINGS_COLUMNS_PUBLIC_PAGE}, service_mode, public_queue_visible, reschedule_notice_hours, cancellation_notice_hours, reminder_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_30m_enabled, sound_notifications_enabled, sound_new_appointment_enabled, sound_reschedule_enabled, sound_cancellation_enabled, sound_completion_enabled`;

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
  logoSize: 36,
  heroImageUrl: "",
  heroImagePositionX: 50,
  heroImagePositionY: 50,
  heroImageScale: 1.1,
  aboutImageUrl: "",
  aboutImagePositionX: 50,
  aboutImagePositionY: 50,
  aboutImageScale: 1,
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
  facebookUrl: "",
  instagramUrl: "",
  pixKey: "",
  pixMerchantName: "",
  primaryHsl: "258 84% 58%",
  accentHsl: "44 96% 56%",
  successHsl: "151 74% 43%",
  publicBookingEnabled: true,
  serviceMode: "appointment",
  publicQueueVisible: false,
  rescheduleNoticeHours: 2,
  cancellationNoticeHours: 0,
  reminderEnabled: true,
  reminder24hEnabled: true,
  reminder2hEnabled: true,
  reminder30mEnabled: false,
  soundNotificationsEnabled: true,
  soundNewAppointmentEnabled: true,
  soundRescheduleEnabled: true,
  soundCancellationEnabled: true,
  soundCompletionEnabled: true,
};

const STORAGE_KEY = "happycash_agenda_branding_preview";

const AgendaBrandingContext = createContext<AgendaBrandingContextType | undefined>(undefined);

const isBrowser = () => typeof window !== "undefined";

const clearPersistedPreview = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(STORAGE_KEY);
};

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

const sanitizeNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const sanitizeServiceMode = (value: unknown): AgendaBrandingSettings["serviceMode"] =>
  value === "walk_in" || value === "both" ? value : "appointment";

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
  logoSize: sanitizeNumber(settings.logoSize, DEFAULT_BRANDING.logoSize, 24, 64),
  heroImageUrl: (settings.heroImageUrl || "").trim(),
  heroImagePositionX: sanitizeNumber(settings.heroImagePositionX, DEFAULT_BRANDING.heroImagePositionX, 0, 100),
  heroImagePositionY: sanitizeNumber(settings.heroImagePositionY, DEFAULT_BRANDING.heroImagePositionY, 0, 100),
  heroImageScale: sanitizeNumber(settings.heroImageScale, DEFAULT_BRANDING.heroImageScale, 1, 2),
  aboutImageUrl: (settings.aboutImageUrl || "").trim(),
  aboutImagePositionX: sanitizeNumber(settings.aboutImagePositionX, DEFAULT_BRANDING.aboutImagePositionX, 0, 100),
  aboutImagePositionY: sanitizeNumber(settings.aboutImagePositionY, DEFAULT_BRANDING.aboutImagePositionY, 0, 100),
  aboutImageScale: sanitizeNumber(settings.aboutImageScale, DEFAULT_BRANDING.aboutImageScale, 1, 2),
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
  facebookUrl: (settings.facebookUrl || "").trim(),
  instagramUrl: (settings.instagramUrl || "").trim(),
  pixKey: (settings.pixKey || "").trim(),
  pixMerchantName: (settings.pixMerchantName || "").trim() || (settings.displayName || "").trim(),
  primaryHsl: sanitizeHsl(settings.primaryHsl, DEFAULT_BRANDING.primaryHsl),
  accentHsl: sanitizeHsl(settings.accentHsl, DEFAULT_BRANDING.accentHsl),
  successHsl: sanitizeHsl(settings.successHsl, DEFAULT_BRANDING.successHsl),
  serviceMode: sanitizeServiceMode(settings.serviceMode),
  publicQueueVisible: Boolean(settings.publicQueueVisible),
  rescheduleNoticeHours: sanitizeNumber(settings.rescheduleNoticeHours, DEFAULT_BRANDING.rescheduleNoticeHours, 0, 72),
  cancellationNoticeHours: sanitizeNumber(settings.cancellationNoticeHours, DEFAULT_BRANDING.cancellationNoticeHours, 0, 72),
  reminderEnabled: Boolean(settings.reminderEnabled),
  reminder24hEnabled: Boolean(settings.reminder24hEnabled),
  reminder2hEnabled: Boolean(settings.reminder2hEnabled),
  reminder30mEnabled: Boolean(settings.reminder30mEnabled),
  soundNotificationsEnabled: Boolean(settings.soundNotificationsEnabled),
  soundNewAppointmentEnabled: Boolean(settings.soundNewAppointmentEnabled),
  soundRescheduleEnabled: Boolean(settings.soundRescheduleEnabled),
  soundCancellationEnabled: Boolean(settings.soundCancellationEnabled),
  soundCompletionEnabled: Boolean(settings.soundCompletionEnabled),
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
  logoSize: row.logo_size ?? DEFAULT_BRANDING.logoSize,
  heroImageUrl: row.hero_image_url ?? "",
  heroImagePositionX: row.hero_image_position_x ?? DEFAULT_BRANDING.heroImagePositionX,
  heroImagePositionY: row.hero_image_position_y ?? DEFAULT_BRANDING.heroImagePositionY,
  heroImageScale: row.hero_image_scale ?? DEFAULT_BRANDING.heroImageScale,
  aboutImageUrl: row.about_image_url ?? "",
  aboutImagePositionX: row.about_image_position_x ?? DEFAULT_BRANDING.aboutImagePositionX,
  aboutImagePositionY: row.about_image_position_y ?? DEFAULT_BRANDING.aboutImagePositionY,
  aboutImageScale: row.about_image_scale ?? DEFAULT_BRANDING.aboutImageScale,
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
  facebookUrl: row.facebook_url ?? "",
  instagramUrl: row.instagram_url ?? "",
  pixKey: row.pix_key ?? "",
  pixMerchantName: row.pix_merchant_name ?? row.display_name,
  primaryHsl: row.primary_hsl,
  accentHsl: row.accent_hsl,
  successHsl: row.success_hsl,
  publicBookingEnabled: row.public_booking_enabled,
  serviceMode: sanitizeServiceMode(row.service_mode),
  publicQueueVisible: Boolean(row.public_queue_visible),
  rescheduleNoticeHours: row.reschedule_notice_hours ?? DEFAULT_BRANDING.rescheduleNoticeHours,
  cancellationNoticeHours: row.cancellation_notice_hours ?? DEFAULT_BRANDING.cancellationNoticeHours,
  reminderEnabled: row.reminder_enabled ?? DEFAULT_BRANDING.reminderEnabled,
  reminder24hEnabled: row.reminder_24h_enabled ?? DEFAULT_BRANDING.reminder24hEnabled,
  reminder2hEnabled: row.reminder_2h_enabled ?? DEFAULT_BRANDING.reminder2hEnabled,
  reminder30mEnabled: row.reminder_30m_enabled ?? DEFAULT_BRANDING.reminder30mEnabled,
  soundNotificationsEnabled: row.sound_notifications_enabled ?? DEFAULT_BRANDING.soundNotificationsEnabled,
  soundNewAppointmentEnabled: row.sound_new_appointment_enabled ?? DEFAULT_BRANDING.soundNewAppointmentEnabled,
  soundRescheduleEnabled: row.sound_reschedule_enabled ?? DEFAULT_BRANDING.soundRescheduleEnabled,
  soundCancellationEnabled: row.sound_cancellation_enabled ?? DEFAULT_BRANDING.soundCancellationEnabled,
  soundCompletionEnabled: row.sound_completion_enabled ?? DEFAULT_BRANDING.soundCompletionEnabled,
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
  logo_size: settings.logoSize,
  hero_image_url: settings.heroImageUrl || null,
  hero_image_position_x: settings.heroImagePositionX,
  hero_image_position_y: settings.heroImagePositionY,
  hero_image_scale: settings.heroImageScale,
  about_image_url: settings.aboutImageUrl || null,
  about_image_position_x: settings.aboutImagePositionX,
  about_image_position_y: settings.aboutImagePositionY,
  about_image_scale: settings.aboutImageScale,
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
  facebook_url: settings.facebookUrl || null,
  instagram_url: settings.instagramUrl || null,
  pix_key: settings.pixKey || null,
  pix_merchant_name: settings.pixMerchantName || null,
  primary_hsl: settings.primaryHsl,
  accent_hsl: settings.accentHsl,
  success_hsl: settings.successHsl,
  public_booking_enabled: settings.publicBookingEnabled,
  service_mode: settings.serviceMode,
  public_queue_visible: settings.publicQueueVisible,
  reschedule_notice_hours: settings.rescheduleNoticeHours,
  cancellation_notice_hours: settings.cancellationNoticeHours,
  reminder_enabled: settings.reminderEnabled,
  reminder_24h_enabled: settings.reminder24hEnabled,
  reminder_2h_enabled: settings.reminder2hEnabled,
  reminder_30m_enabled: settings.reminder30mEnabled,
  sound_notifications_enabled: settings.soundNotificationsEnabled,
  sound_new_appointment_enabled: settings.soundNewAppointmentEnabled,
  sound_reschedule_enabled: settings.soundRescheduleEnabled,
  sound_cancellation_enabled: settings.soundCancellationEnabled,
  sound_completion_enabled: settings.soundCompletionEnabled,
});

const withoutRulesColumns = (payload: AgendaBusinessSettingsUpsert) => {
  const {
    reschedule_notice_hours,
    cancellation_notice_hours,
    reminder_enabled,
    reminder_24h_enabled,
    reminder_2h_enabled,
    reminder_30m_enabled,
    sound_notifications_enabled,
    sound_new_appointment_enabled,
    sound_reschedule_enabled,
    sound_cancellation_enabled,
    sound_completion_enabled,
    ...remainingPayload
  } = payload;
  void reschedule_notice_hours;
  void cancellation_notice_hours;
  void reminder_enabled;
  void reminder_24h_enabled;
  void reminder_2h_enabled;
  void reminder_30m_enabled;
  void sound_notifications_enabled;
  void sound_new_appointment_enabled;
  void sound_reschedule_enabled;
  void sound_cancellation_enabled;
  void sound_completion_enabled;
  return remainingPayload;
};

const withoutServiceModeColumns = (payload: AgendaBusinessSettingsUpsert) => {
  const { service_mode, public_queue_visible, ...publicPagePayload } = withoutRulesColumns(payload);
  void service_mode;
  void public_queue_visible;
  return publicPagePayload;
};

const readPreview = () => {
  if (!isBrowser()) return null;

  try {
    clearPersistedPreview();
    return null;
  } catch {
    clearPersistedPreview();
    return null;
  }
};

const writePreview = (settings: AgendaBrandingSettings) => {
  if (!isBrowser()) return;
  void settings;
  clearPersistedPreview();
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
      const publicPageQuery = publicSlug
        ? table.select(SETTINGS_COLUMNS_PUBLIC_PAGE).eq("slug", publicSlug).eq("public_booking_enabled", true)
        : user?.id
          ? table.select(SETTINGS_COLUMNS_PUBLIC_PAGE).eq("owner_user_id", user.id)
          : table
              .select(SETTINGS_COLUMNS_PUBLIC_PAGE)
              .eq("slug", DEFAULT_BRANDING.slug)
              .eq("public_booking_enabled", true);
      response = await publicPageQuery.maybeSingle();
    }

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
        response = await supabase
          .from("agenda_business_settings")
          .upsert(withoutRulesColumns(upsertPayload), { onConflict: "owner_user_id" })
          .select(`${SETTINGS_COLUMNS_PUBLIC_PAGE}, service_mode, public_queue_visible`)
          .single();
      }

      if (response.error && isMissingColumnError(response.error.message)) {
        response = await supabase
          .from("agenda_business_settings")
          .upsert(withoutServiceModeColumns(upsertPayload), { onConflict: "owner_user_id" })
          .select(SETTINGS_COLUMNS_PUBLIC_PAGE)
          .single();
      }

      if (response.error) {
        return {
          error: isMissingColumnError(response.error.message)
            ? "A base da Agenda esta sem colunas da pagina publica. Aplique as migrations antes de salvar Pix, redes sociais e textos."
            : response.error.message,
        };
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
