-- Durante o mês gratuito o estabelecimento pode testar o ecossistema completo.
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
SELECT 'inicial', feature_key, true
FROM public.subscription_plan_features
WHERE enabled
GROUP BY feature_key
ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = true;

CREATE OR REPLACE FUNCTION public.current_store_has_feature(target_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_subscriptions subscription
    WHERE subscription.owner_user_id = public.get_current_store_owner_id()
      AND subscription.status = 'trialing'
      AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
  )
  OR EXISTS (
    SELECT 1
    FROM public.subscription_plan_features feature
    WHERE feature.plan_id = public.get_current_store_plan_id()
      AND feature.feature_key = target_feature
      AND feature.enabled
  );
$$;
