-- Defesa adicional: se a criação da assinatura falhar por qualquer motivo,
-- uma conta criada há menos de 30 dias continua acessando o trial. Isso evita
-- que um cadastro concluído no Site fique bloqueado entre a criação da loja e
-- a persistência da assinatura.
CREATE OR REPLACE FUNCTION public.get_current_store_plan_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT subscription.plan_id
      FROM public.store_subscriptions subscription
      WHERE subscription.owner_user_id = public.get_current_store_owner_id()
        AND (
          (subscription.status = 'trialing' AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now())
          OR (subscription.status IN ('active', 'past_due') AND (subscription.current_period_ends_at IS NULL OR subscription.current_period_ends_at > now()))
        )
      ORDER BY CASE WHEN subscription.status = 'active' THEN 0 WHEN subscription.status = 'past_due' THEN 1 ELSE 2 END,
        COALESCE(subscription.current_period_ends_at, subscription.trial_ends_at, subscription.created_at) DESC
      LIMIT 1
    ),
    (
      SELECT 'inicial'
      FROM public.store_accounts account
      WHERE account.owner_user_id = public.get_current_store_owner_id()
        AND account.created_at > now() - interval '30 days'
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_store_has_feature(target_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_subscriptions subscription
    WHERE subscription.owner_user_id = public.get_current_store_owner_id()
      AND subscription.status = 'trialing'
      AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
  )
  OR EXISTS (
    SELECT 1 FROM public.store_accounts account
    WHERE account.owner_user_id = public.get_current_store_owner_id()
      AND account.created_at > now() - interval '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.store_subscriptions subscription
        WHERE subscription.store_account_id = account.id
          AND subscription.status IN ('trialing', 'active', 'past_due')
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.subscription_plan_features feature
    WHERE feature.plan_id = public.get_current_store_plan_id()
      AND feature.feature_key = target_feature
      AND feature.enabled
  );
$$;
