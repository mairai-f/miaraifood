import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { clearDesktopActivation, readDesktopActivation, loadDesktopActivation } from '@/lib/desktopActivation';
import { isProbablyOfflineError } from '@/lib/offlineConcentrator';
import { secureStorage } from '@/lib/secureStorage';
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
  isMobileApp: boolean;
  isLocalRuntime: boolean;
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
const isHappyCashMobileUserAgent = () =>
  typeof navigator !== 'undefined' && /HappyCashAndroid\//i.test(navigator.userAgent);
const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);
const isMobileAppRuntime = typeof window !== 'undefined' && (Boolean(window.happyCashMobileAPI) || isHappyCashMobileUserAgent());
const isLocalRuntime = isDesktopRuntime || isMobileAppRuntime;
const localRuntimeKind = isMobileAppRuntime ? 'mobile' : 'desktop';
const localRuntimeLabel = isMobileAppRuntime ? 'app Android' : 'desktop';
const licenseCacheKey = (userId: string) => `happycash:${localRuntimeKind}:license:${userId}`;

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const buildValidationExpiresAt = (payload: {
  validUntil: string | null;
  validatedAt?: string | null;
}) => {
  const validatedAtTime = payload.validatedAt ? new Date(payload.validatedAt).getTime() : Date.now();
  // 30 days plan + 5 days tolerance = 35 days
  const slidingWindowEnd = validatedAtTime + 35 * 24 * 60 * 60 * 1000;

  if (!payload.validUntil) {
    return new Date(slidingWindowEnd).toISOString();
  }

  const validUntilTime = new Date(payload.validUntil).getTime();
  const actualExpiration = Math.min(validUntilTime, slidingWindowEnd);
  return new Date(actualExpiration).toISOString();
};

const readCachedLicense = async (userId: string) => {
  try {
    const stored = await secureStorage.getItem(licenseCacheKey(userId));
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
  void secureStorage.setItem(licenseCacheKey(userId), JSON.stringify(payload));
};

export function DesktopRuntimeProvider({ children }: { children: ReactNode }) {
  const { session, user, ownerUserId, loading: authLoading, isLocalOfflineSession } = useAuth();
  const [checking, setChecking] = useState(isLocalRuntime);
  const [licensed, setLicensed] = useState(!isLocalRuntime);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [validationExpiresAt, setValidationExpiresAt] = useState<string | null>(null);
  const [usingOfflineValidationCache, setUsingOfflineValidationCache] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const resetState = useCallback((nextChecking: boolean) => {
    setChecking(nextChecking);
    setLicensed(!isLocalRuntime);
    setOfflineEnabled(false);
    setValidUntil(null);
    setValidationExpiresAt(null);
    setUsingOfflineValidationCache(false);
    setPlanId(null);
    setError(null);
    setCode(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!isLocalRuntime) {
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

    const readRuntimeCachedLicense = async () => {
      const primaryLicense = await readCachedLicense(user.id);
      if (primaryLicense || !ownerUserId || ownerUserId === user.id) {
        return primaryLicense;
      }

      return readCachedLicense(ownerUserId);
    };

    const applyCachedOfflineLicense = async () => {
      const cachedLicense = await readRuntimeCachedLicense();
      const cachedValidationExpiresAt = cachedLicense ? buildValidationExpiresAt(cachedLicense) : null;
      const cachedLicenseStillValid = Boolean(
        !cachedValidationExpiresAt
        || (toTimestamp(cachedValidationExpiresAt) && toTimestamp(cachedValidationExpiresAt)! > Date.now())
      );

      if (cachedLicense && cachedLicenseStillValid) {
        const validatedAt = cachedLicense.validatedAt || new Date().toISOString();
        setLicensed(true);
        setOfflineEnabled(true);
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
            offlineEnabled: true,
            validatedAt,
          });
        }
        return true;
      }

      const expiredMessage = cachedValidationExpiresAt
        ? `Não foi possível validar sua assinatura há 35 dias. Conecte este computador à internet para continuar utilizando o HappyCash.`
        : `Este ${localRuntimeLabel} ainda não possui uma validação de licença pronta para uso.`;

      setLicensed(false);
      setOfflineEnabled(true);
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
      if (isLocalOfflineSession || typeof navigator !== 'undefined' && navigator.onLine === false) {
        await applyCachedOfflineLicense();
        return;
      }

      setLicensed(false);
      setOfflineEnabled(false);
      setValidUntil(null);
      setValidationExpiresAt(null);
      setUsingOfflineValidationCache(false);
      setPlanId(null);
      setError(`Sua sessao online expirou ou nao foi carregada. Saia e entre novamente com o administrador para validar a licenca do ${localRuntimeLabel}.`);
      setCode('SESSION_UNAVAILABLE');
      setChecking(false);
      return;
    }

    setChecking(true);

    // Online verification: update local cache, but don't block based on desktop-license RPC alone
    // if we are running in the desktop/app, we consider it licensed and offlineEnabled permanently
    const desktopActivation = isDesktopRuntime ? readDesktopActivation() : null;
    let validatedAt = new Date().toISOString();
    
    // We can still optionally check with the server just to update the validUntil date
    const { data, error: invokeError } = await supabase.functions.invoke<DesktopLicenseResponse>('desktop-license', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        desktopInstallationId: desktopActivation?.installationId ?? null,
        desktopStoreAccountId: desktopActivation?.storeAccountId ?? null,
        desktopAppContext: isMobileAppRuntime ? 'mobile' : desktopActivation?.appContext ?? 'happycash',
      },
    }).catch(() => ({ data: null, error: new Error('Network error') }));

    if (invokeError) {
      // If server check fails due to network, trust our offline logic
      // up to 35 days from the last successful validation
      const offlineResult = await applyCachedOfflineLicense();
      if (offlineResult) return;
    }

    if (!data?.licensed) {
      // Server explicitly rejected (plan expired, revoked, etc): block immediately
      setLicensed(false);
      setOfflineEnabled(false);
      setValidUntil(data?.validUntil ?? null);
      setValidationExpiresAt(null);
      setUsingOfflineValidationCache(false);
      setPlanId(data?.planId ?? null);
      let message = data?.error || `Nao foi possivel validar sua licenca do ${localRuntimeLabel} agora.`;
      setError(message);
      setCode(data?.code || 'LICENSE_REJECTED');
      setChecking(false);
      // Clear offline cache to prevent offline evasion
      writeCachedLicense(user.id, {
        planId: null,
        validUntil: null,
        offlineEnabled: false,
        validatedAt: null,
      });
      return;
    }

    setLicensed(true);
    setOfflineEnabled(true);
    setValidUntil(data?.validUntil ?? null);
    setValidationExpiresAt(buildValidationExpiresAt({
      validUntil: data?.validUntil ?? null,
      validatedAt,
    }));
    setUsingOfflineValidationCache(false);
    setPlanId(data?.planId ?? null);
    setError(null);
    setCode(null);
    setChecking(false);
    writeCachedLicense(user.id, {
      planId: data?.planId ?? null,
      validUntil: data?.validUntil ?? null,
      offlineEnabled: true,
      validatedAt,
    });
  }, [authLoading, isLocalOfflineSession, ownerUserId, resetState, session?.access_token, user]);

  useEffect(() => {
    let active = true;
    void loadDesktopActivation().then(() => {
      if (active) void refresh();
    });
    return () => { active = false; };
  }, [refresh]);

  return (
    <DesktopRuntimeContext.Provider
      value={{
        isDesktop: isDesktopRuntime,
        isMobileApp: isMobileAppRuntime,
        isLocalRuntime,
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
