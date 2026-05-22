import type { AgendaBrandingSettings } from "@/hooks/useAgendaBranding";

export function getAgendaPublicSearch(
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  const currentParams =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const currentSlug =
    currentParams?.get("empresa")?.trim() || currentParams?.get("agenda")?.trim();
  const slug = currentSlug || settings.slug?.trim();

  return slug ? `?empresa=${encodeURIComponent(slug)}` : "";
}

export function withAgendaPublicSearch(
  path: string,
  settings: Pick<AgendaBrandingSettings, "slug">,
) {
  return `${path}${getAgendaPublicSearch(settings)}`;
}
