/** Rotas fixas do app — slugs de empresa não podem colidir com estes paths. */
export const AGENDA_RESERVED_SLUGS = new Set([
  "login",
  "agendamento",
  "booking",
  "meus-agendamentos",
  "my-appointments",
  "painel",
  "painel-barbeiro",
  "painel-profissional",
  "admin",
  "barber",
  "professional",
  "produtos",
  "products",
  "auth",
  "reset-password",
]);

export const AGENDA_ADMIN_PATH_PREFIXES = [
  "/painel",
  "/painel-barbeiro",
  "/painel-profissional",
  "/admin",
  "/barber",
  "/professional",
];

export function isAgendaAdminPath(pathname: string) {
  return AGENDA_ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function slugFromPathname(pathname: string): string | null {
  const segment = pathname.replace(/^\/+|\/+$/g, "").split("/")[0]?.trim().toLowerCase();
  if (!segment || AGENDA_RESERVED_SLUGS.has(segment)) return null;
  return segment;
}

export function resolveAgendaPublicSlug(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const querySlug = params.get("empresa")?.trim() || params.get("agenda")?.trim() || "";
  const pathSlug = slugFromPathname(pathname) || "";
  const envSlug = import.meta.env.VITE_AGENDA_BUSINESS_SLUG?.trim() || "";
  return querySlug || pathSlug || envSlug;
}
