export const LEGAL_TERMS_VERSION = "2026-07-08";
export const LEGAL_PRIVACY_VERSION = "2026-07-08";
export const LEGAL_LGPD_VERSION = "2026-07-08";

export const LEGAL_ACCEPTANCE_SOURCES = {
  siteSignup: "site-signup",
  desktopActivation: "desktop-activation",
} as const;

export type LegalAcceptanceSource =
  (typeof LEGAL_ACCEPTANCE_SOURCES)[keyof typeof LEGAL_ACCEPTANCE_SOURCES];

export interface LegalAcceptanceRequest {
  termsAccepted?: boolean;
  termsVersion?: string;
  privacyAccepted?: boolean;
  privacyVersion?: string;
  lgpdAccepted?: boolean;
  lgpdVersion?: string;
  legalAcceptanceSource?: string | null;
}

export const normalizeLegalAcceptanceSource = (value: string | null | undefined): LegalAcceptanceSource => (
  value === LEGAL_ACCEPTANCE_SOURCES.desktopActivation
    ? LEGAL_ACCEPTANCE_SOURCES.desktopActivation
    : LEGAL_ACCEPTANCE_SOURCES.siteSignup
);

export const requireLegalAcceptance = (
  payload: LegalAcceptanceRequest,
  expectedSource: LegalAcceptanceSource,
) => {
  if (!payload.termsAccepted || !payload.privacyAccepted || !payload.lgpdAccepted) {
    throw new Error("Concorde com os Termos de Uso, a Politica de Privacidade e a LGPD para continuar.");
  }

  if ((payload.termsVersion ?? "").trim() !== LEGAL_TERMS_VERSION) {
    throw new Error("Os Termos de Uso desta versao precisam ser aceitos novamente.");
  }

  if ((payload.privacyVersion ?? "").trim() !== LEGAL_PRIVACY_VERSION) {
    throw new Error("A Politica de Privacidade desta versao precisa ser aceita novamente.");
  }

  if ((payload.lgpdVersion ?? "").trim() !== LEGAL_LGPD_VERSION) {
    throw new Error("O aviso LGPD desta versao precisa ser aceito novamente.");
  }

  const acceptedAt = new Date().toISOString();

  return {
    terms_accepted_at: acceptedAt,
    terms_version: LEGAL_TERMS_VERSION,
    privacy_accepted_at: acceptedAt,
    privacy_version: LEGAL_PRIVACY_VERSION,
    lgpd_accepted_at: acceptedAt,
    lgpd_version: LEGAL_LGPD_VERSION,
    legal_acceptance_source: expectedSource,
  };
};
