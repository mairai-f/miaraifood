-- A conta MIAR tem uma única identidade de titularidade: o auth.uid() que
-- conclui o cadastro é dono do perfil, da loja e da assinatura. Não há
-- fallback de data, cache ou concessão de acesso fora da assinatura registrada.

CREATE OR REPLACE FUNCTION public.get_current_store_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    -- O titular direto de uma loja é a fonte primária da verdade.
    WHEN EXISTS (
      SELECT 1
      FROM public.store_accounts account
      WHERE account.owner_user_id = auth.uid()
    ) THEN auth.uid()
    -- Colaboradores não são donos da loja; eles operam no escopo definido
    -- explicitamente no próprio perfil.
    ELSE COALESCE(
      (SELECT profile.owner_user_id FROM public.profiles profile WHERE profile.user_id = auth.uid()),
      auth.uid()
    )
  END;
$$;

-- Perfis de titulares antigos passam a refletir a identidade real da loja.
UPDATE public.profiles profile
SET owner_user_id = account.owner_user_id,
    role = 'admin',
    email = COALESCE(profile.email, account.email)
FROM public.store_accounts account
WHERE profile.user_id = account.owner_user_id
  AND profile.owner_user_id IS DISTINCT FROM account.owner_user_id;

CREATE OR REPLACE FUNCTION public.sync_store_owner_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET owner_user_id = NEW.owner_user_id,
      role = 'admin',
      email = COALESCE(email, NEW.email)
  WHERE user_id = NEW.owner_user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_store_owner_profile_trigger ON public.store_accounts;
CREATE TRIGGER sync_store_owner_profile_trigger
AFTER INSERT OR UPDATE OF owner_user_id, email ON public.store_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_store_owner_profile();

-- Legados sem qualquer período de teste recebem exatamente um trial de 30
-- dias. A condição por trial_started_at impede uma segunda concessão.
INSERT INTO public.store_subscriptions (
  store_account_id, owner_user_id, plan_id, provider, status, billing_type,
  price, product_context, trial_started_at, trial_ends_at,
  current_period_starts_at, current_period_ends_at, external_reference, metadata
)
SELECT
  account.id,
  account.owner_user_id,
  'inicial',
  'manual',
  'trialing',
  'PIX',
  0,
  COALESCE(account.product_context, 'happycash'),
  now(),
  now() + interval '30 days',
  now(),
  now() + interval '30 days',
  account.owner_user_id::text,
  jsonb_build_object('promotion', 'one_month_free', 'created_via', 'identity_backfill')
FROM public.store_accounts account
WHERE NOT EXISTS (
  SELECT 1
  FROM public.store_subscriptions subscription
  WHERE subscription.store_account_id = account.id
    AND subscription.trial_started_at IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1
  FROM public.store_subscriptions subscription
  WHERE subscription.store_account_id = account.id
    AND subscription.status IN ('active', 'past_due')
);

-- A única forma de obter um plano é uma assinatura válida da mesma conta.
CREATE OR REPLACE FUNCTION public.get_current_store_plan_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subscription.plan_id
  FROM public.store_subscriptions subscription
  WHERE subscription.owner_user_id = public.get_current_store_owner_id()
    AND (
      (subscription.status = 'trialing'
        AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now())
      OR (subscription.status IN ('active', 'past_due')
        AND (subscription.current_period_ends_at IS NULL OR subscription.current_period_ends_at > now()))
    )
  ORDER BY
    CASE WHEN subscription.status = 'active' THEN 0 WHEN subscription.status = 'past_due' THEN 1 ELSE 2 END,
    COALESCE(subscription.current_period_ends_at, subscription.trial_ends_at, subscription.created_at) DESC
  LIMIT 1;
$$;

-- Trial ativo libera todos os recursos; após o vencimento, somente os
-- recursos explicitamente contratados no plano vigente permanecem disponíveis.
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

-- O frontend apenas consulta o estado; a criação do trial é transacional no
-- trigger de store_accounts e no bootstrap autenticado do site.
DROP FUNCTION IF EXISTS public.ensure_current_owner_trial();
