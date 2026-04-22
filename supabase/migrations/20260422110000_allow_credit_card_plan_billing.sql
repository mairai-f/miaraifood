ALTER TABLE public.store_subscriptions
DROP CONSTRAINT IF EXISTS store_subscriptions_billing_type_check;

ALTER TABLE public.store_subscriptions
ADD CONSTRAINT store_subscriptions_billing_type_check
CHECK (billing_type IN ('PIX', 'CREDIT_CARD'));
