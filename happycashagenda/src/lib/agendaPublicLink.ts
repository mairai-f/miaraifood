import type { AgendaBrandingSettings } from "@/hooks/useAgendaBranding";
import {
  isAgendaReservedSlug,
  normalizeAgendaSlug,
  resolveAgendaPublicSlug,
  resolveAgendaRequestedSlug,
  slugFromPathname,
} from "@/lib/agendaSlug";

const withQuerySlug = (path: string, slug: string) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}empresa=${encodeURIComponent(slug)}`;
};

export function getAgendaPublicSearch(
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  if (typeof window === "undefined") {
    const slug = normalizeAgendaSlug(settings.slug);
    return slug ? `?empresa=${encodeURIComponent(slug)}` : "";
  }

  const pathname = window.location.pathname;
  const pathSlug = slugFromPathname(pathname);
  if (pathSlug) return "";

  const currentParams = new URLSearchParams(window.location.search);
  const currentSlug = normalizeAgendaSlug(
    currentParams.get("empresa") || currentParams.get("agenda"),
  );
  const slug = currentSlug || normalizeAgendaSlug(settings.slug);

  return slug ? `?empresa=${encodeURIComponent(slug)}` : "";
}

export function withAgendaPublicSearch(
  path: string,
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  if (typeof window !== "undefined") {
    const slug =
      resolveAgendaRequestedSlug(window.location.pathname, window.location.search) ||
      normalizeAgendaSlug(settings.slug) ||
      resolveAgendaPublicSlug(window.location.pathname, window.location.search);
    if (slug) {
      const base = path.startsWith("/") ? path : `/${path}`;
      // Compatibility for legacy rows created before reserved slugs were blocked.
      if (isAgendaReservedSlug(slug)) return withQuerySlug(base, slug);
      if (base === "/" || base === "") return `/${slug}`;
      return `/${slug}${base}`;
    }
  }

  return `${path}${getAgendaPublicSearch(settings)}`;
}

export function withAgendaBusinessSearch(
  path: string,
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  const base = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return base;

  const slug =
    resolveAgendaRequestedSlug(window.location.pathname, window.location.search) ||
    normalizeAgendaSlug(settings.slug) ||
    resolveAgendaPublicSlug(window.location.pathname, window.location.search);

  return slug ? withQuerySlug(base, slug) : base;
}

export function buildAgendaPublicHomePath(slug: string) {
  const normalized = normalizeAgendaSlug(slug);
  if (isAgendaReservedSlug(normalized)) return withQuerySlug("/", normalized);
  return normalized ? `/${normalized}` : "/";
}
