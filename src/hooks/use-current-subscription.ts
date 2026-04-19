import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getSubscriptionCountdown, getSubscriptionStatusLabel, isCurrentSubscription } from '@/lib/subscriptionStatus';

type StoreSubscriptionRow = {
  id: string;
  plan_id: string;
  status: string;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

type SubscriptionQueryError = { message: string } | null;

type SubscriptionQueryClient = {
  from(table: "store_subscriptions"): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): Promise<{
          data: StoreSubscriptionRow[] | null;
          error: SubscriptionQueryError;
        }>;
      };
    };
  };
};

export function useCurrentSubscription() {
  const { ownerUserId, isAdmin, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<StoreSubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isAdmin || !ownerUserId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    let active = true;
    const db = supabase as unknown as SubscriptionQueryClient;

    const loadSubscription = async () => {
      setLoading(true);

      const { data, error } = await db
        .from('store_subscriptions')
        .select('id, plan_id, status, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, created_at')
        .eq('owner_user_id', ownerUserId)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setSubscription(null);
        setLoading(false);
        return;
      }

      const rows = (data as StoreSubscriptionRow[] | null) ?? [];
      setSubscription(rows.find(isCurrentSubscription) ?? rows[0] ?? null);
      setLoading(false);
    };

    void loadSubscription();

    return () => {
      active = false;
    };
  }, [authLoading, isAdmin, ownerUserId]);

  const countdown = useMemo(() => getSubscriptionCountdown(subscription), [subscription]);
  const statusLabel = useMemo(() => getSubscriptionStatusLabel(subscription), [subscription]);

  return {
    subscription,
    countdown,
    statusLabel,
    loading,
  };
}
