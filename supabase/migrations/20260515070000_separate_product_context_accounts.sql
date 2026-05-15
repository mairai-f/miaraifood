DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_accounts'
      AND column_name = 'product_context'
  ) THEN
    ALTER TABLE public.store_accounts
      ADD COLUMN product_context text;
  END IF;
END $$;

ALTER TABLE public.store_accounts
  ALTER COLUMN product_context SET DEFAULT 'happycash';

WITH resolved_context AS (
  SELECT
    account.id,
    COALESCE(
      (
        SELECT CASE
          WHEN subscription.plan_id IN ('food', 'food_offline') THEN 'happycashfood'
          ELSE 'happycash'
        END
        FROM public.store_subscriptions AS subscription
        WHERE subscription.store_account_id = account.id
        ORDER BY
          CASE
            WHEN subscription.status IN ('trialing', 'active', 'past_due', 'pending') THEN 0
            ELSE 1
          END,
          subscription.created_at DESC
        LIMIT 1
      ),
      'happycash'
    ) AS product_context
  FROM public.store_accounts AS account
)
UPDATE public.store_accounts AS account
SET product_context = resolved_context.product_context
FROM resolved_context
WHERE account.id = resolved_context.id
  AND (
    account.product_context IS NULL
    OR account.product_context NOT IN ('happycash', 'happycashfood')
  );

ALTER TABLE public.store_accounts
  DROP CONSTRAINT IF EXISTS store_accounts_product_context_check;

ALTER TABLE public.store_accounts
  ADD CONSTRAINT store_accounts_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood'));

ALTER TABLE public.store_accounts
  ALTER COLUMN product_context SET NOT NULL;

CREATE INDEX IF NOT EXISTS store_accounts_product_context_idx
  ON public.store_accounts(product_context);

CREATE OR REPLACE FUNCTION public.get_current_store_product_context()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT product_context
  FROM public.store_accounts
  WHERE owner_user_id = public.get_current_store_owner_id()
  LIMIT 1
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'site_pending_registrations'
      AND column_name = 'product_context'
  ) THEN
    ALTER TABLE public.site_pending_registrations
      ADD COLUMN product_context text;
  END IF;
END $$;

ALTER TABLE public.site_pending_registrations
  ALTER COLUMN product_context SET DEFAULT 'happycash';

UPDATE public.site_pending_registrations AS registration
SET product_context = account.product_context
FROM public.store_accounts AS account
WHERE registration.store_account_id = account.id
  AND (
    registration.product_context IS NULL
    OR registration.product_context NOT IN ('happycash', 'happycashfood')
  );

UPDATE public.site_pending_registrations
SET product_context = 'happycash'
WHERE product_context IS NULL
  OR product_context NOT IN ('happycash', 'happycashfood');

ALTER TABLE public.site_pending_registrations
  DROP CONSTRAINT IF EXISTS site_pending_registrations_product_context_check;

ALTER TABLE public.site_pending_registrations
  ADD CONSTRAINT site_pending_registrations_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood'));

ALTER TABLE public.site_pending_registrations
  ALTER COLUMN product_context SET NOT NULL;

CREATE INDEX IF NOT EXISTS site_pending_registrations_product_context_idx
  ON public.site_pending_registrations(product_context, status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_subscriptions'
      AND column_name = 'product_context'
  ) THEN
    ALTER TABLE public.store_subscriptions
      ADD COLUMN product_context text;
  END IF;
END $$;

ALTER TABLE public.store_subscriptions
  ALTER COLUMN product_context SET DEFAULT 'happycash';

UPDATE public.store_subscriptions AS subscription
SET product_context = COALESCE(
  account.product_context,
  CASE
    WHEN subscription.plan_id IN ('food', 'food_offline') THEN 'happycashfood'
    ELSE 'happycash'
  END
)
FROM public.store_accounts AS account
WHERE subscription.store_account_id = account.id
  AND (
    subscription.product_context IS NULL
    OR subscription.product_context NOT IN ('happycash', 'happycashfood')
  );

UPDATE public.store_subscriptions
SET product_context = CASE
  WHEN plan_id IN ('food', 'food_offline') THEN 'happycashfood'
  ELSE 'happycash'
END
WHERE product_context IS NULL
  OR product_context NOT IN ('happycash', 'happycashfood');

ALTER TABLE public.store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_product_context_check;

ALTER TABLE public.store_subscriptions
  ADD CONSTRAINT store_subscriptions_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood'));

ALTER TABLE public.store_subscriptions
  ALTER COLUMN product_context SET NOT NULL;

CREATE INDEX IF NOT EXISTS store_subscriptions_owner_product_status_idx
  ON public.store_subscriptions(owner_user_id, product_context, status, created_at DESC);
