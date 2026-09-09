import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface PlanContextValue {
  planId: string | null;
  features: string[];
  loading: boolean;
  hasActivePlan: boolean;
  isTrialActive: boolean;
  hasFeature: (featureKey: string) => boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);
// Generated Supabase types are behind the current billing schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const planAccessCacheKey = (userId: string) => `happycash:system:plan-access:${userId}`;

const settleSupabaseQuery = async <TData,>(
  query: PromiseLike<{ data: TData; error: unknown }>,
  fallbackData: TData,
) => {
  try {
    return await query;
  } catch (error) {
    return { data: fallbackData, error };
  }
};

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
  const { user, ownerUserId, loading: authLoading, isLocalOfflineSession } = useAuth();
  const [planId, setPlanId] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvedPlanSubject, setResolvedPlanSubject] = useState<string | null>(null);
  const refreshRequestRef = useRef(0);
  const resolvedPlanSubjectRef = useRef<string | null>(null);
  const planSubject = user
    ? `${user.id}:${ownerUserId ?? 'pending-owner'}:${isLocalOfflineSession ? 'offline' : 'online'}`
    : 'anonymous';

  const markPlanSubjectResolved = useCallback((subject: string) => {
    resolvedPlanSubjectRef.current = subject;
    setResolvedPlanSubject(subject);
  }, []);

  const refresh = useCallback(async () => {
    const requestId = ++refreshRequestRef.current;
    const requestPlanSubject = planSubject;
    const isCurrentRequest = () => refreshRequestRef.current === requestId;
    const shouldShowBlockingLoading = resolvedPlanSubjectRef.current !== requestPlanSubject;

    if (authLoading) {
      setLoading(shouldShowBlockingLoading);
      return;
    }

    if (!user) {
      setPlanId(null);
      setFeatures([]);
      setIsTrialActive(false);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
      return;
    }

    if (isLocalOfflineSession) {
      const cachedPlanAccess = readCachedPlanAccess(user.id)
        || (ownerUserId && ownerUserId !== user.id ? readCachedPlanAccess(ownerUserId) : null);
      if (!isCurrentRequest()) return;
      setPlanId(cachedPlanAccess?.planId ?? null);
      setFeatures(cachedPlanAccess?.features ?? []);
      setIsTrialActive(false);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
      return;
    }

    const cachedPlanAccess = readCachedPlanAccess(user.id);
    const ownerCachedPlanAccess = ownerUserId && ownerUserId !== user.id
      ? readCachedPlanAccess(ownerUserId)
      : null;
    const fallbackPlanAccess = cachedPlanAccess || ownerCachedPlanAccess;

    if (shouldShowBlockingLoading && fallbackPlanAccess) {
      setPlanId(fallbackPlanAccess.planId);
      setFeatures(fallbackPlanAccess.features);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
    } else if (shouldShowBlockingLoading) {
      setLoading(true);
    }

    const applyCachedPlanAccess = (error: unknown) => {
      if (!fallbackPlanAccess) {
        void error;
        return false;
      }

      if (!isCurrentRequest()) return true;
      setPlanId(fallbackPlanAccess.planId);
      setFeatures(fallbackPlanAccess.features);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
      return true;
    };

    const [planResult, subscriptionResult] = await Promise.all([
      settleSupabaseQuery(db.rpc('get_current_store_plan_id'), null),
      settleSupabaseQuery(
        db.from('store_subscriptions')
          .select('status, trial_ends_at, current_period_ends_at')
          .eq('owner_user_id', ownerUserId ?? user.id)
          .eq('product_context', 'happycash')
          .in('status', ['trialing', 'active', 'past_due'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
    ]);
    const { data: currentPlanId, error: planError } = planResult;
    const subscription = subscriptionResult.data as { status?: string; trial_ends_at?: string | null; current_period_ends_at?: string | null } | null;
    const trialEndsAt = subscription?.trial_ends_at ?? subscription?.current_period_ends_at ?? null;
    const trialIsValid = subscription?.status === 'trialing' && Boolean(trialEndsAt) && new Date(trialEndsAt!).getTime() > Date.now();
    if (isCurrentRequest()) setIsTrialActive(trialIsValid);
    if (!isCurrentRequest()) return;

    if (planError || !currentPlanId) {
      if (applyCachedPlanAccess(planError)) return;

      setPlanId(null);
      setFeatures([]);
      setIsTrialActive(false);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
      return;
    }

    const { data: featureRows, error: featureError } = await settleSupabaseQuery(
      db
        .from('subscription_plan_features')
        .select('feature_key')
        .eq('plan_id', currentPlanId)
        .eq('enabled', true),
      null,
    );
    if (!isCurrentRequest()) return;

    if (featureError) {
      if (applyCachedPlanAccess(featureError)) return;

      setPlanId(currentPlanId);
      setFeatures([]);
      markPlanSubjectResolved(requestPlanSubject);
      setLoading(false);
      return;
    }

    const nextFeatures = ((featureRows as Array<{ feature_key: string }> | null) ?? []).map((row) => row.feature_key);
    setPlanId(currentPlanId);
    setFeatures(nextFeatures);
    markPlanSubjectResolved(requestPlanSubject);
    setLoading(false);
    writeCachedPlanAccess(user.id, {
      planId: currentPlanId,
      features: nextFeatures,
    });
  }, [authLoading, isLocalOfflineSession, markPlanSubjectResolved, ownerUserId, planSubject, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasFeature = useCallback((featureKey: string) => {
    // The 30-day trial intentionally exposes the whole product. The plan id
    // remains "inicial" for billing, but must not restrict an active trial.
    if (isTrialActive) return true;
    if (features.includes(featureKey)) return true;
    if (featureKey.startsWith('food.')) {
      return (
        features.some(f => f.startsWith('food.') || f === 'pdv.use' || f === 'service_tickets.use') ||
        features.length > 0
      );
    }
    return false;
  }, [features, isTrialActive]);
  const effectiveLoading = loading || resolvedPlanSubject !== planSubject;

  return (
    <PlanContext.Provider
      value={{
        planId,
        features,
        loading: effectiveLoading,
        hasActivePlan: Boolean(planId),
        isTrialActive,
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
