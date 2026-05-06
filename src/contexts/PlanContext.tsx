import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDesktopRuntime, isProbablyOfflineError } from '@/lib/offlineConcentrator';
import { useAuth } from './AuthContext';

interface PlanContextValue {
  planId: string | null;
  features: string[];
  loading: boolean;
  hasActivePlan: boolean;
  hasFeature: (featureKey: string) => boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);
// Generated Supabase types are behind the current billing schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const planAccessCacheKey = (userId: string) => `happycash:system:plan-access:${userId}`;

const readCachedPlanAccess = (userId: string) => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(planAccessCacheKey(userId));
    if (!stored) return null;
    return JSON.parse(stored) as {
      planId: string | null;
      features: string[];
    };
  } catch {
    return null;
  }
};

const writeCachedPlanAccess = (
  userId: string,
  payload: {
    planId: string | null;
    features: string[];
  },
) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(planAccessCacheKey(userId), JSON.stringify(payload));
  } catch {
    // Offline cache is best-effort.
  }
};

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isLocalOfflineSession } = useAuth();
  const [planId, setPlanId] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setPlanId(null);
      setFeatures([]);
      setLoading(false);
      return;
    }

    if (isLocalOfflineSession) {
      const cachedPlanAccess = readCachedPlanAccess(user.id);
      setPlanId(cachedPlanAccess?.planId ?? null);
      setFeatures(cachedPlanAccess?.features ?? []);
      setLoading(false);
      return;
    }

    setLoading(true);

    const applyCachedPlanAccess = (error: unknown) => {
      const cachedPlanAccess = readCachedPlanAccess(user.id);
      if (!cachedPlanAccess || !isDesktopRuntime() || !isProbablyOfflineError(error)) {
        return false;
      }

      setPlanId(cachedPlanAccess.planId);
      setFeatures(cachedPlanAccess.features);
      setLoading(false);
      return true;
    };

    const { data: currentPlanId, error: planError } = await db.rpc('get_current_store_plan_id');

    if (planError || !currentPlanId) {
      if (applyCachedPlanAccess(planError)) return;

      setPlanId(null);
      setFeatures([]);
      setLoading(false);
      return;
    }

    const { data: featureRows, error: featureError } = await db
      .from('subscription_plan_features')
      .select('feature_key')
      .eq('plan_id', currentPlanId)
      .eq('enabled', true);

    if (featureError) {
      if (applyCachedPlanAccess(featureError)) return;

      setPlanId(currentPlanId);
      setFeatures([]);
      setLoading(false);
      return;
    }

    const nextFeatures = ((featureRows as Array<{ feature_key: string }> | null) ?? []).map((row) => row.feature_key);
    setPlanId(currentPlanId);
    setFeatures(nextFeatures);
    setLoading(false);
    writeCachedPlanAccess(user.id, {
      planId: currentPlanId,
      features: nextFeatures,
    });
  }, [authLoading, isLocalOfflineSession, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFeature = useCallback((featureKey: string) => features.includes(featureKey), [features]);

  return (
    <PlanContext.Provider
      value={{
        planId,
        features,
        loading,
        hasActivePlan: Boolean(planId),
        hasFeature,
        refresh,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlanAccess() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlanAccess must be used within PlanProvider');
  }

  return context;
}
