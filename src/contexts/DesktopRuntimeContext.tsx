import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { isProbablyOfflineError } from '@/lib/offlineConcentrator';

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
  planId: string | null;
  error: string | null;
  code: string | null;
  refresh: () => Promise<void>;
}

const DesktopRuntimeContext = createContext<DesktopRuntimeContextValue | null>(null);
const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);
const licenseCacheKey = (userId: string) => `happycash:desktop:license:${userId}`;

const readCachedLicense = (userId: string) => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(licenseCacheKey(userId));
    if (!stored) return null;
    return JSON.parse(stored) as {
      planId: string | null;
      validUntil: string | null;
      offlineEnabled: boolean;
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
  const { session, user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(isDesktopRuntime);
  const [licensed, setLicensed] = useState(!isDesktopRuntime);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const resetState = useCallback((nextChecking: boolean) => {
    setChecking(nextChecking);
    setLicensed(!isDesktopRuntime);
    setOfflineEnabled(false);
    setValidUntil(null);
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

    if (!session?.access_token || !user) {
      resetState(false);
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
      const cachedLicense = readCachedLicense(user.id);
      const cachedLicenseStillValid = cachedLicense && (
        !cachedLicense.validUntil || new Date(cachedLicense.validUntil).getTime() > Date.now()
      );
      const canUseCachedLicense = Boolean(cachedLicenseStillValid) && (
        (typeof navigator !== 'undefined' && navigator.onLine === false)
        || isProbablyOfflineError(invokeError)
      );

      if (canUseCachedLicense && cachedLicenseStillValid) {
        setLicensed(true);
        setOfflineEnabled(Boolean(cachedLicense.offlineEnabled));
        setValidUntil(cachedLicense.validUntil ?? null);
        setPlanId(cachedLicense.planId ?? null);
        setError(null);
        setCode('OFFLINE_LICENSE_CACHE');
        setChecking(false);
        return;
      }

      let message = data?.error || 'Nao foi possivel validar sua licenca desktop agora.';
      let nextCode = data?.code || null;

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
      setError(message);
      setCode(nextCode);
      setChecking(false);
      return;
    }

    setLicensed(true);
    setOfflineEnabled(Boolean(data.offlineEnabled));
    setValidUntil(data.validUntil ?? null);
    setPlanId(data.planId ?? null);
    setError(null);
    setCode(null);
    setChecking(false);
    writeCachedLicense(user.id, {
      planId: data.planId ?? null,
      validUntil: data.validUntil ?? null,
      offlineEnabled: Boolean(data.offlineEnabled),
    });
  }, [authLoading, resetState, session?.access_token, user]);

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
