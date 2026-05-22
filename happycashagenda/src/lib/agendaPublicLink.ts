import type { AgendaBrandingSettings } from "@/hooks/useAgendaBranding";
import { resolveAgendaPublicSlug, slugFromPathname } from "@/lib/agendaSlug";

export function getAgendaPublicSearch(
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  if (typeof window === "undefined") {
    return settings.slug?.trim() ? `?empresa=${encodeURIComponent(settings.slug.trim())}` : "";
  }

  const pathname = window.location.pathname;
  const pathSlug = slugFromPathname(pathname);
  if (pathSlug) return "";

  const currentParams = new URLSearchParams(window.location.search);
  const currentSlug =
    currentParams.get("empresa")?.trim() || currentParams.get("agenda")?.trim();
  const slug = currentSlug || settings.slug?.trim();

  return slug ? `?empresa=${encodeURIComponent(slug)}` : "";
}

export function withAgendaPublicSearch(
  path: string,
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  if (typeof window !== "undefined") {
    const slug = resolveAgendaPublicSlug(window.location.pathname, window.location.search) || settings.slug?.trim();
    if (slug && slugFromPathname(window.location.pathname) !== slug) {
      const base = path.startsWith("/") ? path : `/${path}`;
      if (base === "/" || base === "") return `/${slug}`;
      return `/${slug}${base}`;
    }
  }

  return `${path}${getAgendaPublicSearch(settings)}`;
}

export function buildAgendaPublicHomePath(slug: string) {
  const normalized = slug.trim().toLowerCase();
  return normalized ? `/${normalized}` : "/";
}
