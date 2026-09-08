-- Corrige contas criadas pelo cadastro do site que ficaram sem assinatura
-- e normaliza o período promocional para 30 dias.
UPDATE public.store_subscriptions
SET trial_ends_at = trial_started_at + interval '30 days',
    current_period_ends_at = trial_started_at + interval '30 days'
WHERE status = 'trialing'
  AND trial_started_at IS NOT NULL
  AND trial_ends_at < trial_started_at + interval '30 days';

-- Contas finalizadas sem assinatura recebem o plano Inicial em período gratuito.
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
  jsonb_build_object('promotion', 'one_month_free', 'created_via', 'migration')
FROM public.store_accounts account
WHERE NOT EXISTS (
  SELECT 1
  FROM public.store_subscriptions subscription
  WHERE subscription.store_account_id = account.id
    AND subscription.status IN ('trialing', 'active', 'past_due', 'pending')
)
AND NOT EXISTS (
  SELECT 1
  FROM public.store_subscriptions used_trial
  WHERE used_trial.store_account_id = account.id
    AND used_trial.trial_started_at IS NOT NULL
);

COMMENT ON TABLE public.store_subscriptions IS
  'Assinaturas MIAR AI/FOOD. Novos estabelecimentos recebem 30 dias completos de acesso; após o vencimento sem pagamento, o acesso é bloqueado.';
