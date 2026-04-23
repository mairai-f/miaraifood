import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
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

    setLoading(true);

    const { data: currentPlanId, error: planError } = await db.rpc('get_current_store_plan_id');

    if (planError || !currentPlanId) {
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
      setPlanId(currentPlanId);
      setFeatures([]);
      setLoading(false);
      return;
    }

    setPlanId(currentPlanId);
    setFeatures(((featureRows as Array<{ feature_key: string }> | null) ?? []).map((row) => row.feature_key));
    setLoading(false);
  }, [authLoading, user]);

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
