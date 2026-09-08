-- Fonte de verdade comercial igual ao site MIAR Ai/Food.
-- Valores em reais: 49, 99, 199 e 349.
-- A tabela foi criada originalmente com um CHECK restrito aos planos legados.
-- Mantemos esses IDs para compatibilidade histórica e liberamos os novos IDs
-- comerciais usados pelo site.
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_id_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_id_check
  CHECK (id IN ('demo', 'fiado', 'completo', 'pro', 'tiozao', 'inicial', 'intermediario', 'premium'));

INSERT INTO public.subscription_plans (
  id, name, description, price, billing_cycle, duration_days, trial_hours, sort_order, is_public, is_active
) VALUES
  ('tiozao', 'Tiozão do Hotdog', 'Plano de entrada para operações pequenas.', 49, 'monthly', 30, 720, 1, true, true),
  ('inicial', 'Inicial', 'Operação completa para estabelecimentos.', 99, 'monthly', 30, 720, 2, true, true),
  ('intermediario', 'Intermediário', 'Operação com IA e automações comerciais.', 199, 'monthly', 30, 720, 3, true, true),
  ('premium', 'Premium', 'Escala, publicidade e recursos avançados.', 349, 'monthly', 30, 720, 4, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  trial_hours = EXCLUDED.trial_hours,
  sort_order = EXCLUDED.sort_order,
  is_public = true,
  is_active = true;

-- A demo antiga não deve aparecer como oferta pública independente.
UPDATE public.subscription_plans
SET is_public = false,
    is_active = false
WHERE id = 'demo';

-- IDs internos antigos permanecem apenas para compatibilidade histórica.
UPDATE public.subscription_plans
SET is_public = false
WHERE id IN ('fiado', 'completo', 'pro');

-- Os novos planos herdam as permissões operacionais dos planos legados
-- equivalentes. O INSERT é idempotente e preserva eventual customização futura.
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
SELECT 'tiozao', feature_key, enabled
FROM public.subscription_plan_features
WHERE plan_id = 'fiado'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
SELECT 'inicial', feature_key, enabled
FROM public.subscription_plan_features
WHERE plan_id = 'completo'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
SELECT 'intermediario', feature_key, enabled
FROM public.subscription_plan_features
WHERE plan_id = 'pro'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscription_plan_features target
    WHERE target.plan_id = 'intermediario' AND target.feature_key = public.subscription_plan_features.feature_key
  )
ON CONFLICT (plan_id, feature_key) DO NOTHING;

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
SELECT 'premium', feature_key, enabled
FROM public.subscription_plan_features
WHERE plan_id = 'pro'
ON CONFLICT (plan_id, feature_key) DO NOTHING;

COMMENT ON TABLE public.subscription_plans IS 'Planos comerciais MIAR Ai/Food. Planos públicos concedem 30 dias (720 horas) de trial único na contratação.';

CREATE OR REPLACE FUNCTION public.start_miaifood_one_month_trial(p_store_account_id uuid, p_plan_id text)
RETURNS public.store_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.store_subscriptions; plan_row public.subscription_plans;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.store_accounts WHERE id = p_store_account_id AND owner_user_id = auth.uid()) THEN RAISE EXCEPTION 'Estabelecimento não pertence ao usuário'; END IF;
  SELECT * INTO plan_row FROM public.subscription_plans WHERE id = p_plan_id AND is_public AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.store_subscriptions WHERE store_account_id = p_store_account_id AND trial_started_at IS NOT NULL) THEN RAISE EXCEPTION 'O período gratuito já foi utilizado'; END IF;
  INSERT INTO public.store_subscriptions (store_account_id, owner_user_id, plan_id, provider, status, price, trial_started_at, trial_ends_at, current_period_starts_at, current_period_ends_at, metadata)
  VALUES (p_store_account_id, auth.uid(), plan_row.id, 'manual', 'trialing', plan_row.price, now(), now() + interval '30 days', now(), now() + interval '30 days', jsonb_build_object('promotion','one_month_free','trial_hours',720))
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.start_miaifood_one_month_trial(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_miaifood_one_month_trial(uuid, text) TO authenticated;
