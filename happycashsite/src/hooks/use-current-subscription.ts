import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getSubscriptionCountdown, getSubscriptionStatusLabel, isCurrentSubscription } from "@/lib/subscriptionStatus";

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

export function useCurrentSubscription(userId?: string | null) {
  const [subscription, setSubscription] = useState<StoreSubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    let active = true;
    const db = supabase as any;

    const loadSubscription = async () => {
      setLoading(true);

      const { data, error } = await db
        .from("store_subscriptions")
        .select("id, plan_id, status, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, created_at")
        .eq("owner_user_id", userId)
        .order("created_at", { ascending: false });

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
  }, [userId]);

  const countdown = useMemo(() => getSubscriptionCountdown(subscription), [subscription]);
  const statusLabel = useMemo(() => getSubscriptionStatusLabel(subscription), [subscription]);

  return {
    subscription,
    countdown,
    statusLabel,
    loading,
  };
}
