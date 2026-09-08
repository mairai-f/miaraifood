export const LEGAL_TERMS_VERSION = '2026-07-09';
export const LEGAL_PRIVACY_VERSION = '2026-07-09';
export const LEGAL_LGPD_VERSION = '2026-07-09';
export const LEGAL_UPDATED_AT_LABEL = '9 de julho de 2026';
export const LEGAL_SUPPORT_EMAIL = 'happycashsupport@gmail.com';
export const LEGAL_SITE_ORIGIN = 'https://www.happycashsite.com.br';

export const LEGAL_PATHS = {
  privacy: '/politica-de-privacidade',
  terms: '/termos-de-uso',
  legacyTerms: '/termos-de-servico',
  lgpd: '/lgpd',
} as const;

export const LEGAL_ACCEPTANCE_SOURCES = {
  siteSignup: 'site-signup',
  desktopActivation: 'desktop-activation',
} as const;

export type LegalAcceptanceSource =
  (typeof LEGAL_ACCEPTANCE_SOURCES)[keyof typeof LEGAL_ACCEPTANCE_SOURCES];

export const buildLegalUrl = (path: string) => `${LEGAL_SITE_ORIGIN}${path}`;
