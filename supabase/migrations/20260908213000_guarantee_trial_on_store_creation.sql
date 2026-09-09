-- Todo estabelecimento criado pelo site recebe sua assinatura de teste no
-- mesmo instante em que a conta da loja é criada.
CREATE OR REPLACE FUNCTION public.assign_miaifood_trial_to_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_subscriptions
    WHERE store_account_id = NEW.id
  ) THEN
    INSERT INTO public.store_subscriptions (
      store_account_id, owner_user_id, plan_id, provider, status, billing_type,
      price, product_context, trial_started_at, trial_ends_at,
      current_period_starts_at, current_period_ends_at, external_reference, metadata
    ) VALUES (
      NEW.id, NEW.owner_user_id, 'inicial', 'manual', 'trialing', 'PIX',
      0, COALESCE(NEW.product_context, 'happycash'), now(), now() + interval '30 days',
      now(), now() + interval '30 days', NEW.owner_user_id::text,
      jsonb_build_object('promotion', 'one_month_free', 'created_via', 'store_account_trigger')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_miaifood_trial_to_new_store_trigger ON public.store_accounts;
CREATE TRIGGER assign_miaifood_trial_to_new_store_trigger
AFTER INSERT ON public.store_accounts
FOR EACH ROW EXECUTE FUNCTION public.assign_miaifood_trial_to_new_store();

-- Mantém o administrador de teste com acesso durante a validação de produção.
DO $$
DECLARE target_user_id uuid; target_store_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = 'celioantonio.dev@gmail.com' LIMIT 1;
  IF target_user_id IS NULL THEN RETURN; END IF;
  SELECT id INTO target_store_id FROM public.store_accounts WHERE owner_user_id = target_user_id LIMIT 1;
  IF target_store_id IS NULL THEN RETURN; END IF;

  UPDATE public.store_subscriptions
  SET status = 'trialing', plan_id = 'inicial', provider = 'manual', price = 0,
      trial_started_at = now(), trial_ends_at = now() + interval '30 days',
      current_period_starts_at = now(), current_period_ends_at = now() + interval '30 days',
      metadata = metadata || jsonb_build_object('promotion', 'one_month_free', 'repaired_at', now())
  WHERE id = (
    SELECT id FROM public.store_subscriptions
    WHERE store_account_id = target_store_id
    ORDER BY created_at DESC
    LIMIT 1
  );

  IF NOT FOUND THEN
    INSERT INTO public.store_subscriptions (
      store_account_id, owner_user_id, plan_id, provider, status, billing_type,
      price, product_context, trial_started_at, trial_ends_at,
      current_period_starts_at, current_period_ends_at, external_reference, metadata
    ) VALUES (
      target_store_id, target_user_id, 'inicial', 'manual', 'trialing', 'PIX', 0,
      (SELECT COALESCE(product_context, 'happycash') FROM public.store_accounts WHERE id = target_store_id),
      now(), now() + interval '30 days', now(), now() + interval '30 days', target_user_id::text,
      jsonb_build_object('promotion', 'one_month_free', 'repaired_at', now())
    );
  END IF;
END $$;
