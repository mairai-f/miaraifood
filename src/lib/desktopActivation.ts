import { supabase } from '@/integrations/supabase/client';
import { getPublicErrorMessage } from '../../shared/security/redaction';
import {
  LEGAL_LGPD_VERSION,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  type LegalAcceptanceSource,
} from '../../shared/legal/legalAcceptance';

export interface DesktopActivationRecord {
  ownerUserId: string;
  companyName: string;
  cnpj: string | null;
  planId: string | null;
  validUntil: string | null;
  activatedAt: string;
  installationId: string;
  appContext: 'happycash';
  storeAccountId: string | null;
  installerToken: string | null;
}

interface DesktopActivationResponse {
  success?: boolean;
  ownerUserId?: string;
  storeAccountId?: string | null;
  companyName?: string;
  cnpj?: string | null;
  planId?: string | null;
  validUntil?: string | null;
  appContext?: 'happycash';
  error?: string;
}

export interface DesktopLegalAcceptanceInput {
  accepted: boolean;
  source: LegalAcceptanceSource;
}

const activationStorageKey = 'happycash:desktop:activation';
const installationIdStorageKey = 'happycash:desktop:installation-id';

const isBrowser = () => typeof window !== 'undefined';
const normalizeInstallerToken = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const readRuntimeInstallerToken = () => {
  if (!isBrowser()) return null;

  try {
    return normalizeInstallerToken(window.electronAPI?.app?.getRuntimeInfoSync?.().installerToken ?? null);
  } catch {
    return null;
  }
};

export const isDesktopActivationRequired = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI);

export const readDesktopActivation = (): DesktopActivationRecord | null => {
  if (!isBrowser()) return null;

  try {
    const stored = window.localStorage.getItem(activationStorageKey);
    if (!stored) return null;
    const activation = JSON.parse(stored) as DesktopActivationRecord;
    const runtimeInstallerToken = readRuntimeInstallerToken();

    if (runtimeInstallerToken && activation.installerToken !== runtimeInstallerToken) {
      clearDesktopActivation({ clearInstallationId: true });
      return null;
    }

    return activation;
  } catch {
    return null;
  }
};

export const writeDesktopActivation = (payload: DesktopActivationRecord) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(activationStorageKey, JSON.stringify(payload));
};

export const clearDesktopActivation = (options?: { clearInstallationId?: boolean }) => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(activationStorageKey);
  if (options?.clearInstallationId) {
    window.localStorage.removeItem(installationIdStorageKey);
  }
};

export const getDesktopInstallationId = () => {
  if (!isBrowser()) return 'web';

  const existing = window.localStorage.getItem(installationIdStorageKey);
  if (existing) return existing;

  const nextValue = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `desktop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(installationIdStorageKey, nextValue);
  return nextValue;
};

export const getActivatedDesktopOwnerUserId = () => readDesktopActivation()?.ownerUserId ?? null;

export const activateDesktopWithLicenseKey = async (
  licenseKey: string,
  legalAcceptance: DesktopLegalAcceptanceInput,
) => {
  const runtimeInfo = await window.electronAPI?.app?.getRuntimeInfo?.();
  const installationId = getDesktopInstallationId();
  const installerToken = normalizeInstallerToken(runtimeInfo?.installerToken ?? null);

  if (!legalAcceptance.accepted) {
    return {
      success: false as const,
      error: 'Concorde com os Termos de Uso, a Politica de Privacidade e a LGPD para ativar esta maquina.',
    };
  }

  const { data, error } = await supabase.functions.invoke<DesktopActivationResponse>('desktop-activate', {
    body: {
      licenseKey,
      installationId,
      platform: runtimeInfo?.platform ?? null,
      appVersion: runtimeInfo?.appVersion ?? null,
      appContext: runtimeInfo?.productContext ?? 'happycash',
      legalAcceptanceSource: legalAcceptance.source,
      termsAccepted: true,
      termsVersion: LEGAL_TERMS_VERSION,
      privacyAccepted: true,
      privacyVersion: LEGAL_PRIVACY_VERSION,
      lgpdAccepted: true,
      lgpdVersion: LEGAL_LGPD_VERSION,
    },
  });

  if (error || !data?.success || !data.ownerUserId || !data.companyName) {
    let functionErrorMessage = data?.error || 'Nao foi possivel validar a chave desta empresa.';

    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
        functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
      } catch {
        functionErrorMessage = 'Nao foi possivel validar a chave desta empresa.';
      }
    }

    return {
      success: false as const,
      error: getPublicErrorMessage(functionErrorMessage, 'Nao foi possivel validar a chave desta empresa.'),
    };
  }

  const activationRecord: DesktopActivationRecord = {
    ownerUserId: data.ownerUserId,
    companyName: data.companyName,
    cnpj: data.cnpj ?? null,
    planId: data.planId ?? null,
    validUntil: data.validUntil ?? null,
    activatedAt: new Date().toISOString(),
    installationId,
    appContext: 'happycash',
    storeAccountId: data.storeAccountId ?? null,
    installerToken,
  };

  writeDesktopActivation(activationRecord);

  return {
    success: true as const,
    activation: activationRecord,
  };
};
