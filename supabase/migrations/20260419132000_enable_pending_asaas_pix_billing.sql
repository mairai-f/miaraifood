ALTER TABLE public.store_subscriptions
DROP CONSTRAINT IF EXISTS store_subscriptions_status_check;
ALTER TABLE public.store_subscriptions
ADD CONSTRAINT store_subscriptions_status_check
CHECK (status IN ('pending', 'trialing', 'active', 'past_due', 'canceled', 'expired'));
CREATE UNIQUE INDEX IF NOT EXISTS store_subscriptions_one_pending_idx
  ON public.store_subscriptions(store_account_id)
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS store_subscriptions_provider_payment_id_idx
  ON public.store_subscriptions(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS billing_webhook_events_provider_event_idx
  ON public.billing_webhook_events(provider, provider_event_id);
