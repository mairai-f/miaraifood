-- Mantém o product_context legado para compatibilidade, mas remove a marca
-- HappyCash de todas as visões administrativas consumidas pela Supergestora.

CREATE OR REPLACE VIEW public.admin_system_emails AS
SELECT
  registry.product_context,
  'MIAR AI/FOOD'::text AS system_name,
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
  'MIAR AI/FOOD'::text AS system_name,
  'clients'::text AS client_source,
  client.id AS client_id,
  client.name AS client_name,
  NULL::text AS client_email,
  client.phone AS client_phone,
  client.deleted,
  client.user_id AS owner_user_id,
  NULL::uuid AS store_account_id,
  NULL::text AS store_account_email,
  NULL::text AS store_name,
  client.created_at,
  client.updated_at
FROM public.clients AS client;

REVOKE ALL ON TABLE public.admin_system_emails FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_system_clients FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_system_emails TO service_role;
GRANT SELECT ON TABLE public.admin_system_clients TO service_role;
