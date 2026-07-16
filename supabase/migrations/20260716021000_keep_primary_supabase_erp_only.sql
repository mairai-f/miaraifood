-- Remove remaining Food/Agenda catalog and account rows from the primary
-- HappyCash Supabase project. Standalone products must use their own Supabase.

BEGIN;

DELETE FROM public.subscription_plan_features
WHERE plan_id IN ('food', 'food_offline', 'agenda')
   OR feature_key LIKE 'restaurant.%'
   OR feature_key LIKE 'agenda.%';

DELETE FROM public.store_subscriptions
WHERE product_context IN ('happycashfood', 'happycashagenda')
   OR plan_id IN ('food', 'food_offline', 'agenda');

DELETE FROM public.system_account_registry
WHERE product_context IN ('happycashfood', 'happycashagenda');

DELETE FROM public.store_accounts
WHERE product_context IN ('happycashfood', 'happycashagenda');

DELETE FROM public.subscription_plans
WHERE id IN ('food', 'food_offline', 'agenda');

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_product_context_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_product_context_check
  CHECK (product_context = 'happycash');

ALTER TABLE public.store_accounts
  DROP CONSTRAINT IF EXISTS store_accounts_product_context_check;

ALTER TABLE public.store_accounts
  ADD CONSTRAINT store_accounts_product_context_check
  CHECK (product_context = 'happycash');

ALTER TABLE public.store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_product_context_check;

ALTER TABLE public.store_subscriptions
  ADD CONSTRAINT store_subscriptions_product_context_check
  CHECK (product_context = 'happycash');

ALTER TABLE public.system_account_registry
  DROP CONSTRAINT IF EXISTS system_account_registry_product_context_check;

ALTER TABLE public.system_account_registry
  ADD CONSTRAINT system_account_registry_product_context_check
  CHECK (product_context = 'happycash');

CREATE OR REPLACE VIEW public.admin_system_emails AS
SELECT
  registry.product_context,
  'HappyCash ERP'::text AS system_name,
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
  'happycash'::text AS product_context,
  'HappyCash ERP'::text AS system_name,
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
  ON account.id = client.store_account_id;

REVOKE ALL ON TABLE public.admin_system_emails FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_system_clients FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_system_emails TO service_role;
GRANT SELECT ON TABLE public.admin_system_clients TO service_role;

COMMIT;
