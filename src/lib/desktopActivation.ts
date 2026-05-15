import { supabase } from '@/integrations/supabase/client';

export interface DesktopActivationRecord {
  ownerUserId: string;
  companyName: string;
  cnpj: string | null;
  planId: string | null;
  validUntil: string | null;
  activatedAt: string;
  installationId: string;
  appContext: 'happycash' | 'happycashfood';
  storeAccountId: string | null;
}

interface DesktopActivationResponse {
  success?: boolean;
  ownerUserId?: string;
  storeAccountId?: string | null;
  companyName?: string;
  cnpj?: string | null;
  planId?: string | null;
  validUntil?: string | null;
  appContext?: 'happycash' | 'happycashfood';
  error?: string;
}

const activationStorageKey = 'happycash:desktop:activation';
const installationIdStorageKey = 'happycash:desktop:installation-id';

const isBrowser = () => typeof window !== 'undefined';

export const isDesktopActivationRequired = () =>
  typeof window !== 'undefined' && Boolean(window.electronAPI);

export const readDesktopActivation = (): DesktopActivationRecord | null => {
  if (!isBrowser()) return null;

  try {
    const stored = window.localStorage.getItem(activationStorageKey);
    if (!stored) return null;
    return JSON.parse(stored) as DesktopActivationRecord;
  } catch {
    return null;
  }
};

export const writeDesktopActivation = (payload: DesktopActivationRecord) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(activationStorageKey, JSON.stringify(payload));
};

export const clearDesktopActivation = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(activationStorageKey);
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

export const activateDesktopWithLicenseKey = async (licenseKey: string) => {
  const runtimeInfo = await window.electronAPI?.app?.getRuntimeInfo?.();
  const installationId = getDesktopInstallationId();

  const { data, error } = await supabase.functions.invoke<DesktopActivationResponse>('desktop-activate', {
    body: {
      licenseKey,
      installationId,
      platform: runtimeInfo?.platform ?? null,
      appVersion: runtimeInfo?.appVersion ?? null,
      appContext: runtimeInfo?.productContext ?? 'happycash',
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
      error: functionErrorMessage,
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
    appContext: data.appContext === 'happycashfood' ? 'happycashfood' : 'happycash',
    storeAccountId: data.storeAccountId ?? null,
  };

  writeDesktopActivation(activationRecord);

  return {
    success: true as const,
    activation: activationRecord,
  };
};
