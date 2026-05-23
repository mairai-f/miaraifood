-- Admin-only registry to make product ownership readable in the database.
-- The frontend roles do not receive grants on these objects.

CREATE TABLE IF NOT EXISTS public.system_account_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  product_context text NOT NULL,
  owner_email text NOT NULL,
  customer_name text NOT NULL DEFAULT '',
  store_name text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'store_accounts',
  is_demo boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_account_registry_product_context_check
    CHECK (product_context IN ('happycash', 'happycashfood', 'happycashagenda')),
  CONSTRAINT system_account_registry_owner_context_unique
    UNIQUE (owner_user_id, product_context),
  CONSTRAINT system_account_registry_store_account_unique
    UNIQUE (store_account_id)
);

ALTER TABLE public.system_account_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_account_registry FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS system_account_registry_context_email_idx
  ON public.system_account_registry(product_context, lower(owner_email));

CREATE OR REPLACE FUNCTION public.sync_system_account_registry_from_store_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  resolved_email text;
BEGIN
  SELECT COALESCE(NULLIF(NEW.email, ''), auth_user.email, 'sem-email@happycash.local')
  INTO resolved_email
  FROM auth.users AS auth_user
  WHERE auth_user.id = NEW.owner_user_id;

  resolved_email := COALESCE(resolved_email, NULLIF(NEW.email, ''), 'sem-email@happycash.local');

  DELETE FROM public.system_account_registry
  WHERE store_account_id = NEW.id
    AND product_context <> NEW.product_context;

  INSERT INTO public.system_account_registry (
    owner_user_id,
    store_account_id,
    product_context,
    owner_email,
    customer_name,
    store_name,
    source,
    is_demo,
    metadata
  )
  VALUES (
    NEW.owner_user_id,
    NEW.id,
    NEW.product_context,
    lower(resolved_email),
    COALESCE(NULLIF(NEW.nome_cliente, ''), split_part(resolved_email, '@', 1)),
    COALESCE(NULLIF(NEW.nome_estabelecimento, ''), NEW.product_context),
    'store_accounts',
    false,
    jsonb_build_object('synced_from', 'store_accounts')
  )
  ON CONFLICT (owner_user_id, product_context) DO UPDATE
  SET
    store_account_id = EXCLUDED.store_account_id,
    owner_email = EXCLUDED.owner_email,
    customer_name = EXCLUDED.customer_name,
    store_name = EXCLUDED.store_name,
    source = EXCLUDED.source,
    metadata = public.system_account_registry.metadata || EXCLUDED.metadata,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_system_account_registry_store_accounts ON public.store_accounts;
CREATE TRIGGER sync_system_account_registry_store_accounts
AFTER INSERT OR UPDATE OF owner_user_id, email, nome_cliente, nome_estabelecimento, product_context
ON public.store_accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_system_account_registry_from_store_account();

INSERT INTO public.system_account_registry (
  owner_user_id,
  store_account_id,
  product_context,
  owner_email,
  customer_name,
  store_name,
  source,
  is_demo,
  metadata
)
SELECT
  account.owner_user_id,
  account.id,
  account.product_context,
  lower(COALESCE(NULLIF(account.email, ''), auth_user.email, 'sem-email@happycash.local')),
  COALESCE(NULLIF(account.nome_cliente, ''), split_part(COALESCE(NULLIF(account.email, ''), auth_user.email, 'cliente@happycash.local'), '@', 1)),
  COALESCE(NULLIF(account.nome_estabelecimento, ''), account.product_context),
  'store_accounts',
  false,
  jsonb_build_object('backfilled_from', 'store_accounts')
FROM public.store_accounts AS account
LEFT JOIN auth.users AS auth_user
  ON auth_user.id = account.owner_user_id
ON CONFLICT (owner_user_id, product_context) DO UPDATE
SET
  store_account_id = EXCLUDED.store_account_id,
  owner_email = EXCLUDED.owner_email,
  customer_name = EXCLUDED.customer_name,
  store_name = EXCLUDED.store_name,
  source = EXCLUDED.source,
  metadata = public.system_account_registry.metadata || EXCLUDED.metadata,
  updated_at = now();

CREATE OR REPLACE VIEW public.admin_system_emails AS
SELECT
  registry.product_context,
  CASE registry.product_context
    WHEN 'happycashfood' THEN 'HappyCashFood'
    WHEN 'happycashagenda' THEN 'HappyCash Agenda'
    ELSE 'HappyCash PDV Fiado'
  END AS system_name,
  registry.owner_email,
  auth_user.email AS auth_email,
  profile.email AS profile_email,
  account.email AS store_account_email,
  registry.customer_name,
  registry.store_name,
  registry.owner_user_id,
  registry.store_account_id,
  profile.role AS profile_role,
  latest_subscription.plan_id,
  latest_subscription.status AS subscription_status,
  latest_subscription.current_period_ends_at,
  registry.is_demo,
  registry.created_at,
  registry.updated_at
FROM public.system_account_registry AS registry
LEFT JOIN auth.users AS auth_user
  ON auth_user.id = registry.owner_user_id
LEFT JOIN public.profiles AS profile
  ON profile.user_id = registry.owner_user_id
LEFT JOIN public.store_accounts AS account
  ON account.id = registry.store_account_id
LEFT JOIN LATERAL (
  SELECT
    subscription.plan_id,
    subscription.status,
    subscription.current_period_ends_at,
    subscription.created_at
  FROM public.store_subscriptions AS subscription
  WHERE subscription.owner_user_id = registry.owner_user_id
    AND subscription.product_context = registry.product_context
  ORDER BY
    CASE subscription.status
      WHEN 'active' THEN 0
      WHEN 'past_due' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'trialing' THEN 3
      ELSE 4
    END,
    subscription.created_at DESC
  LIMIT 1
) AS latest_subscription ON true;

CREATE OR REPLACE VIEW public.admin_system_clients AS
SELECT
  COALESCE(client.product_context, 'happycash') AS product_context,
  CASE COALESCE(client.product_context, 'happycash')
    WHEN 'happycashfood' THEN 'HappyCashFood'
    ELSE 'HappyCash PDV Fiado'
  END AS system_name,
  'clients'::text AS client_source,
  client.id AS client_id,
  client.name AS client_name,
  client.email AS client_email,
  client.phone AS client_phone,
  client.deleted,
  COALESCE(account.owner_user_id, client.user_id) AS owner_user_id,
  account.id AS store_account_id,
  account.email AS store_account_email,
  account.nome_estabelecimento AS store_name,
  client.created_at,
  client.updated_at
FROM public.clients AS client
LEFT JOIN public.store_accounts AS account
  ON account.id = client.store_account_id

UNION ALL

SELECT
  'happycashagenda'::text AS product_context,
  'HappyCash Agenda'::text AS system_name,
  'agenda_clients'::text AS client_source,
  client.id AS client_id,
  client.name AS client_name,
  client.email AS client_email,
  client.phone AS client_phone,
  false AS deleted,
  client.owner_user_id,
  client.store_account_id,
  account.email AS store_account_email,
  account.nome_estabelecimento AS store_name,
  client.created_at,
  client.updated_at
FROM public.agenda_clients AS client
LEFT JOIN public.store_accounts AS account
  ON account.id = client.store_account_id

UNION ALL

SELECT
  'happycashfood'::text AS product_context,
  'HappyCashFood'::text AS system_name,
  'restaurant_menu_customers'::text AS client_source,
  customer.id AS client_id,
  customer.name AS client_name,
  customer.email AS client_email,
  customer.phone AS client_phone,
  false AS deleted,
  customer.owner_user_id,
  customer.store_account_id,
  account.email AS store_account_email,
  account.nome_estabelecimento AS store_name,
  customer.created_at,
  customer.updated_at
FROM public.restaurant_menu_customers AS customer
LEFT JOIN public.store_accounts AS account
  ON account.id = customer.store_account_id;

REVOKE ALL ON TABLE public.system_account_registry FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_system_emails FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_system_clients FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_account_registry TO service_role;
GRANT SELECT ON TABLE public.admin_system_emails TO service_role;
GRANT SELECT ON TABLE public.admin_system_clients TO service_role;
