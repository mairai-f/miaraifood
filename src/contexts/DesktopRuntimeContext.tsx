import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isProbablyOfflineError } from '@/lib/offlineConcentrator';
import { getPublicErrorMessage } from '../../shared/security/redaction';

interface DesktopLicenseResponse {
  licensed?: boolean;
  error?: string;
  code?: string;
  planId?: string | null;
  status?: string | null;
  validUntil?: string | null;
  features?: string[];
  offlineEnabled?: boolean;
}

interface DesktopRuntimeContextValue {
  isDesktop: boolean;
  checking: boolean;
  licensed: boolean;
  offlineEnabled: boolean;
  validUntil: string | null;
  validationExpiresAt: string | null;
  usingOfflineValidationCache: boolean;
  planId: string | null;
  error: string | null;
  code: string | null;
  refresh: () => Promise<void>;
}

const DesktopRuntimeContext = createContext<DesktopRuntimeContextValue | null>(null);
const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);
const licenseCacheKey = (userId: string) => `happycash:desktop:license:${userId}`;
const OFFLINE_VALIDATION_GRACE_DAYS = 5;
const OFFLINE_VALIDATION_GRACE_MS = OFFLINE_VALIDATION_GRACE_DAYS * 24 * 60 * 60 * 1000;

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const buildValidationExpiresAt = (payload: {
  validUntil: string | null;
  validatedAt?: string | null;
}) => {
  const validatedAt = toTimestamp(payload.validatedAt) ?? Date.now();
  const planValidUntil = toTimestamp(payload.validUntil);
  const offlineGraceUntil = validatedAt + OFFLINE_VALIDATION_GRACE_MS;
  const expiresAt = planValidUntil ? Math.min(planValidUntil, offlineGraceUntil) : offlineGraceUntil;
  return new Date(expiresAt).toISOString();
};

const readCachedLicense = (userId: string) => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(licenseCacheKey(userId));
    if (!stored) return null;
    return JSON.parse(stored) as {
      planId: string | null;
      validUntil: string | null;
      offlineEnabled: boolean;
      validatedAt?: string | null;
    };
  } catch {
    return null;
  }
};

const writeCachedLicense = (
  userId: string,
  payload: {
    planId: string | null;
    validUntil: string | null;
    offlineEnabled: boolean;
    validatedAt: string;
  },
) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(licenseCacheKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore local cache write failures and keep runtime validation.
  }
};

export function DesktopRuntimeProvider({ children }: { children: ReactNode }) {
  const { session, user, ownerUserId, loading: authLoading, isLocalOfflineSession } = useAuth();
  const [checking, setChecking] = useState(isDesktopRuntime);
  const [licensed, setLicensed] = useState(!isDesktopRuntime);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [validationExpiresAt, setValidationExpiresAt] = useState<string | null>(null);
  const [usingOfflineValidationCache, setUsingOfflineValidationCache] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const resetState = useCallback((nextChecking: boolean) => {
    setChecking(nextChecking);
    setLicensed(!isDesktopRuntime);
    setOfflineEnabled(false);
    setValidUntil(null);
    setValidationExpiresAt(null);
    setUsingOfflineValidationCache(false);
    setPlanId(null);
    setError(null);
    setCode(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!isDesktopRuntime) {
      resetState(false);
      return;
    }

    if (authLoading) {
      setChecking(true);
      return;
    }

    if (!user) {
      resetState(false);
      return;
    }

    const readRuntimeCachedLicense = () => {
      const primaryLicense = readCachedLicense(user.id);
      if (primaryLicense || !ownerUserId || ownerUserId === user.id) {
        return primaryLicense;
      }

      return readCachedLicense(ownerUserId);
    };

    const applyCachedOfflineLicense = () => {
      const cachedLicense = readRuntimeCachedLicense();
      const cachedValidationExpiresAt = cachedLicense ? buildValidationExpiresAt(cachedLicense) : null;
      const cachedLicenseStillValid = Boolean(
        cachedValidationExpiresAt
        && toTimestamp(cachedValidationExpiresAt)
        && toTimestamp(cachedValidationExpiresAt)! > Date.now()
      );

      if (cachedLicense && cachedLicenseStillValid) {
        const validatedAt = cachedLicense.validatedAt || new Date().toISOString();
        setLicensed(true);
        setOfflineEnabled(Boolean(cachedLicense.offlineEnabled));
        setValidUntil(cachedLicense.validUntil ?? null);
        setValidationExpiresAt(cachedValidationExpiresAt);
        setUsingOfflineValidationCache(true);
        setPlanId(cachedLicense.planId ?? null);
        setError(null);
        setCode('OFFLINE_LICENSE_CACHE');
        setChecking(false);
        if (!cachedLicense.validatedAt) {
          writeCachedLicense(user.id, {
            planId: cachedLicense.planId ?? null,
            validUntil: cachedLicense.validUntil ?? null,
            offlineEnabled: Boolean(cachedLicense.offlineEnabled),
            validatedAt,
          });
        }
        return true;
      }

      const expiredMessage = cachedValidationExpiresAt
        ? `A validacao offline expirou. Conecte o HappyCash a internet para renovar o acesso apos ${OFFLINE_VALIDATION_GRACE_DAYS} dias.`
        : 'Esta maquina ainda nao possui uma validacao offline pronta para uso.';

      setLicensed(false);
      setOfflineEnabled(Boolean(cachedLicense?.offlineEnabled));
      setValidUntil(cachedLicense?.validUntil ?? null);
      setValidationExpiresAt(cachedValidationExpiresAt);
      setUsingOfflineValidationCache(false);
      setPlanId(cachedLicense?.planId ?? null);
      setError(expiredMessage);
      setCode(cachedValidationExpiresAt ? 'OFFLINE_VALIDATION_EXPIRED' : 'OFFLINE_LICENSE_UNAVAILABLE');
      setChecking(false);
      return true;
    };

    if (!session?.access_token) {
      if (isLocalOfflineSession) {
        applyCachedOfflineLicense();
        return;
      }

      setLicensed(false);
      setOfflineEnabled(false);
      setValidUntil(null);
      setValidationExpiresAt(null);
      setUsingOfflineValidationCache(false);
      setPlanId(null);
      setError('Sua sessao online expirou ou nao foi carregada. Saia e entre novamente com o administrador para validar a licenca desktop.');
      setCode('SESSION_UNAVAILABLE');
      setChecking(false);
      return;
    }

    setChecking(true);

    const { data, error: invokeError } = await supabase.functions.invoke<DesktopLicenseResponse>('desktop-license', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {},
    });

    if (invokeError || !data?.licensed) {
      const cachedLicense = readRuntimeCachedLicense();
      const cachedValidationExpiresAt = cachedLicense ? buildValidationExpiresAt(cachedLicense) : null;
      const cachedLicenseStillValid = Boolean(
        cachedValidationExpiresAt
        && toTimestamp(cachedValidationExpiresAt)
        && toTimestamp(cachedValidationExpiresAt)! > Date.now()
      );
      const canUseCachedLicense = Boolean(cachedLicenseStillValid) && (
        (typeof navigator !== 'undefined' && navigator.onLine === false)
        || isProbablyOfflineError(invokeError)
      );

      if (canUseCachedLicense && cachedLicenseStillValid) {
        const validatedAt = cachedLicense?.validatedAt || new Date().toISOString();
        setLicensed(true);
        setOfflineEnabled(Boolean(cachedLicense.offlineEnabled));
        setValidUntil(cachedLicense.validUntil ?? null);
        setValidationExpiresAt(cachedValidationExpiresAt);
        setUsingOfflineValidationCache(true);
        setPlanId(cachedLicense.planId ?? null);
        setError(null);
        setCode('OFFLINE_LICENSE_CACHE');
        setChecking(false);
        if (!cachedLicense.validatedAt) {
          writeCachedLicense(user.id, {
            planId: cachedLicense.planId ?? null,
            validUntil: cachedLicense.validUntil ?? null,
            offlineEnabled: Boolean(cachedLicense.offlineEnabled),
            validatedAt,
          });
        }
        return;
      }

      let message = data?.error || 'Nao foi possivel validar sua licenca desktop agora.';
      let nextCode = data?.code || null;
      const shouldPreferOfflineValidationMessage = Boolean(cachedLicense)
        && (((typeof navigator !== 'undefined' && navigator.onLine === false) || isProbablyOfflineError(invokeError)));

      if (
        shouldPreferOfflineValidationMessage
        && cachedValidationExpiresAt
        && toTimestamp(cachedValidationExpiresAt)
        && toTimestamp(cachedValidationExpiresAt)! <= Date.now()
      ) {
        message = `A validacao offline expirou. Conecte o HappyCash a internet para renovar o acesso apos ${OFFLINE_VALIDATION_GRACE_DAYS} dias.`;
        nextCode = 'OFFLINE_VALIDATION_EXPIRED';
      }

      if (invokeError && typeof invokeError === 'object' && 'context' in invokeError && invokeError.context instanceof Response) {
        try {
          const errorPayload = await invokeError.context.clone().json() as DesktopLicenseResponse;
          message = errorPayload.error || message;
          nextCode = errorPayload.code || nextCode;
          setPlanId(errorPayload.planId ?? null);
          setValidUntil(errorPayload.validUntil ?? null);
          setOfflineEnabled(Boolean(errorPayload.offlineEnabled));
        } catch {
          message = invokeError.context.status === 401
            ? 'Sua sessao expirou. Entre novamente para continuar.'
            : message;
        }
      } else {
        setPlanId(data?.planId ?? null);
        setValidUntil(data?.validUntil ?? null);
        setOfflineEnabled(Boolean(data?.offlineEnabled));
      }

      setLicensed(false);
      setError(getPublicErrorMessage(message, 'Nao foi possivel validar sua licenca desktop agora.'));
      setCode(nextCode);
      setValidationExpiresAt(cachedValidationExpiresAt);
      setUsingOfflineValidationCache(false);
      setChecking(false);
      return;
    }

    const validatedAt = new Date().toISOString();
    setLicensed(true);
    setOfflineEnabled(Boolean(data.offlineEnabled));
    setValidUntil(data.validUntil ?? null);
    setValidationExpiresAt(buildValidationExpiresAt({
      validUntil: data.validUntil ?? null,
      validatedAt,
    }));
    setUsingOfflineValidationCache(false);
    setPlanId(data.planId ?? null);
    setError(null);
    setCode(null);
    setChecking(false);
    writeCachedLicense(user.id, {
      planId: data.planId ?? null,
      validUntil: data.validUntil ?? null,
      offlineEnabled: Boolean(data.offlineEnabled),
      validatedAt,
    });
  }, [authLoading, isLocalOfflineSession, ownerUserId, resetState, session?.access_token, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DesktopRuntimeContext.Provider
      value={{
        isDesktop: isDesktopRuntime,
        checking,
        licensed,
        offlineEnabled,
        validUntil,
        validationExpiresAt,
        usingOfflineValidationCache,
        planId,
        error,
        code,
        refresh,
      }}
    >
      {children}
    </DesktopRuntimeContext.Provider>
  );
}

export function useDesktopRuntime() {
  const context = useContext(DesktopRuntimeContext);
  if (!context) {
    throw new Error('useDesktopRuntime must be used within DesktopRuntimeProvider');
  }

  return context;
}
