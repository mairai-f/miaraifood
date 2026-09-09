-- Garante o trial no primeiro carregamento autenticado do sistema. A função
-- é idempotente e não reativa contas que já consumiram/encerraram um período.
CREATE OR REPLACE FUNCTION public.ensure_current_owner_trial()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_row public.store_accounts;
  current_plan text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO account_row
  FROM public.store_accounts
  WHERE owner_user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO account_row
    FROM public.store_accounts
    WHERE owner_user_id = public.get_current_store_owner_id()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT plan_id INTO current_plan
  FROM public.store_subscriptions
  WHERE store_account_id = account_row.id
    AND (
      (status = 'trialing' AND COALESCE(trial_ends_at, current_period_ends_at) > now())
      OR (status IN ('active', 'past_due') AND (current_period_ends_at IS NULL OR current_period_ends_at > now()))
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_plan IS NOT NULL THEN
    RETURN current_plan;
  END IF;

  -- Só inicia automaticamente para loja recente sem nenhum trial anterior.
  IF account_row.created_at > now() - interval '30 days'
    AND NOT EXISTS (
      SELECT 1 FROM public.store_subscriptions
      WHERE store_account_id = account_row.id
        AND trial_started_at IS NOT NULL
    ) THEN
    INSERT INTO public.store_subscriptions (
      store_account_id, owner_user_id, plan_id, provider, status, billing_type,
      price, product_context, trial_started_at, trial_ends_at,
      current_period_starts_at, current_period_ends_at, external_reference, metadata
    ) VALUES (
      account_row.id, account_row.owner_user_id, 'inicial', 'manual', 'trialing', 'PIX',
      0, COALESCE(account_row.product_context, 'happycash'), now(), now() + interval '30 days',
      now(), now() + interval '30 days', account_row.owner_user_id::text,
      jsonb_build_object('promotion', 'one_month_free', 'created_via', 'first_authenticated_access')
    );
    RETURN 'inicial';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_current_owner_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_current_owner_trial() TO authenticated;
