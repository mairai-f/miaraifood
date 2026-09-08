UPDATE public.subscription_plans
SET
  name = 'Demo 12 Horas',
  description = 'Acesso inicial liberado por 12 horas.',
  trial_hours = 12
WHERE id = 'demo';
UPDATE public.store_subscriptions
SET
  trial_ends_at = trial_started_at + interval '12 hours',
  current_period_ends_at = trial_started_at + interval '12 hours'
WHERE plan_id = 'demo'
  AND status = 'trialing'
  AND trial_started_at IS NOT NULL
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < trial_started_at + interval '12 hours';
