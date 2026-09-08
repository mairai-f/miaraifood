import { supabase } from '@/integrations/supabase/client';
import { secureStorage } from '@/lib/secureStorage';
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

interface DesktopActivationStatusResponse {
  active?: boolean;
  revoked?: boolean;
  code?: string;
  error?: string;
}

export interface DesktopLegalAcceptanceInput {
  accepted: boolean;
  source: LegalAcceptanceSource;
}

const activationStorageKey = 'happycash:desktop:activation';
const installationIdStorageKey = 'happycash:desktop:installation-id';
export const DESKTOP_ACTIVATION_CHANGED_EVENT = 'happycash:desktop-activation-changed';

const isBrowser = () => typeof window !== 'undefined';
const notifyDesktopActivationChanged = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(DESKTOP_ACTIVATION_CHANGED_EVENT));
};

/**
 * Cache em memória do registro de ativação para chamadas síncronas.
 * Atualizado sempre que loadDesktopActivation() é chamado na inicialização.
 */
let _activationCache: DesktopActivationRecord | null | undefined = undefined;

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
  // Retorna o cache em memória para chamadas síncronas (compatibilidade).
  // Na inicialização, loadDesktopActivation() deve ser chamado uma vez para
  // popular o cache a partir do secureStorage.
  if (_activationCache !== undefined) return _activationCache;

  // Fallback: leitura síncrona do localStorage para o primeiro acesso
  // antes da migração assíncrona ser concluída.
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

    // Dado encontrado no localStorage legado — registrar no cache.
    _activationCache = activation;
    return activation;
  } catch {
    return null;
  }
};

/**
 * Carrega o registro de ativação do secureStorage (assíncrono).
 * Deve ser chamado na inicialização do app para popular o cache em memória
 * e migrar dados legados do localStorage.
 */
export const loadDesktopActivation = async (): Promise<DesktopActivationRecord | null> => {
  if (!isBrowser()) return null;

  try {
    const stored = await secureStorage.getItem(activationStorageKey);
    if (!stored) {
      _activationCache = null;
      return null;
    }

    const activation = JSON.parse(stored) as DesktopActivationRecord;
    const runtimeInstallerToken = readRuntimeInstallerToken();

    if (runtimeInstallerToken && activation.installerToken !== runtimeInstallerToken) {
      await clearDesktopActivationAsync({ clearInstallationId: true });
      return null;
    }

    _activationCache = activation;
    return activation;
  } catch {
    _activationCache = null;
    return null;
  }
};

export const writeDesktopActivation = (payload: DesktopActivationRecord) => {
  if (!isBrowser()) return;
  // Atualiza o cache em memória imediatamente para leituras síncronas.
  _activationCache = payload;
  // Persiste no secureStorage de forma assíncrona (OS keychain).
  void secureStorage.setItem(activationStorageKey, JSON.stringify(payload));
  notifyDesktopActivationChanged();
};

export const clearDesktopActivation = (options?: { clearInstallationId?: boolean }) => {
  if (!isBrowser()) return;
  _activationCache = null;
  void secureStorage.removeItem(activationStorageKey);
  if (options?.clearInstallationId) {
    void secureStorage.removeItem(installationIdStorageKey);
  }
  notifyDesktopActivationChanged();
};

/** Versão assíncrona de clearDesktopActivation para uso interno. */
const clearDesktopActivationAsync = async (options?: { clearInstallationId?: boolean }) => {
  if (!isBrowser()) return;
  _activationCache = null;
  await secureStorage.removeItem(activationStorageKey);
  if (options?.clearInstallationId) {
    await secureStorage.removeItem(installationIdStorageKey);
  }
  notifyDesktopActivationChanged();
};

export const getDesktopInstallationId = () => {
  if (!isBrowser()) return 'web';

  const existing = window.localStorage.getItem(installationIdStorageKey);
  if (existing) return existing;

  const nextValue = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `desktop-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Installation ID não é dado pessoal — pode permanecer no localStorage.
  window.localStorage.setItem(installationIdStorageKey, nextValue);
  return nextValue;
};

export const getActivatedDesktopOwnerUserId = () => readDesktopActivation()?.ownerUserId ?? null;

export const validateDesktopActivationStatus = async (activation: DesktopActivationRecord) => {
  const { data, error } = await supabase.functions.invoke<DesktopActivationStatusResponse>('desktop-activation-status', {
    body: {
      ownerUserId: activation.ownerUserId,
      storeAccountId: activation.storeAccountId,
      installationId: activation.installationId,
      appContext: activation.appContext,
      installerToken: activation.installerToken,
    },
  });

  if (error) {
    let message = data?.error || 'Nao foi possivel validar a ativacao desta maquina agora.';
    if (typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const payload = await error.context.clone().json() as DesktopActivationStatusResponse;
        message = payload.error || message;
      } catch {
        message = 'Nao foi possivel validar a ativacao desta maquina agora.';
      }
    }

    return {
      active: false as const,
      revoked: false as const,
      code: data?.code ?? 'LOOKUP_FAILED',
      error: getPublicErrorMessage(message, 'Nao foi possivel validar a ativacao desta maquina agora.'),
    };
  }

  return {
    active: Boolean(data?.active),
    revoked: Boolean(data?.revoked),
    code: data?.code ?? null,
    error: data?.error ?? null,
  };
};

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
