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

const AGENDA_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function normalizeAgendaSlug(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return AGENDA_SLUG_PATTERN.test(normalized) ? normalized : "";
}

export function isAgendaReservedSlug(value: string | null | undefined) {
  const normalized = normalizeAgendaSlug(value);
  return normalized ? AGENDA_RESERVED_SLUGS.has(normalized) : false;
}

export function isAgendaAdminPath(pathname: string) {
  return AGENDA_ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function slugFromPathname(pathname: string): string | null {
  const segment = normalizeAgendaSlug(pathname.replace(/^\/+|\/+$/g, "").split("/")[0]);
  if (!segment || AGENDA_RESERVED_SLUGS.has(segment)) return null;
  return segment;
}

export function resolveAgendaRequestedSlug(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const querySlug = normalizeAgendaSlug(params.get("empresa") || params.get("agenda"));
  const pathSlug = slugFromPathname(pathname) || "";
  return pathSlug || querySlug;
}

export function resolveAgendaPublicSlug(pathname: string, search: string) {
  const requestedSlug = resolveAgendaRequestedSlug(pathname, search);
  const envSlug = normalizeAgendaSlug(import.meta.env.VITE_AGENDA_BUSINESS_SLUG);
  return requestedSlug || envSlug;
}
