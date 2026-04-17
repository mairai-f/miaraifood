CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY CHECK (id IN ('demo', 'fiado', 'completo', 'pro')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('trial', 'monthly', 'yearly')),
  duration_days integer NOT NULL DEFAULT 30 CHECK (duration_days >= 0),
  trial_hours integer NOT NULL DEFAULT 0 CHECK (trial_hours >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plan_features (
  plan_id text NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.store_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_cliente text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  cnpj text,
  nome_estabelecimento text NOT NULL,
  tipo_estabelecimento text NOT NULL,
  cep text NOT NULL,
  endereco text NOT NULL,
  nome_rua text NOT NULL,
  numero text,
  complemento text,
  bairro text,
  cidade text NOT NULL,
  estado text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL UNIQUE REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas')),
  provider_customer_id text NOT NULL UNIQUE,
  provider_customer_deleted boolean NOT NULL DEFAULT false,
  email text NOT NULL,
  phone text,
  cpf_cnpj text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  provider text NOT NULL DEFAULT 'asaas' CHECK (provider IN ('asaas', 'manual')),
  provider_subscription_id text UNIQUE,
  provider_payment_id text,
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  billing_type text NOT NULL DEFAULT 'PIX' CHECK (billing_type IN ('PIX')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  external_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_plans_sort_order_idx
  ON public.subscription_plans(sort_order, id);

CREATE INDEX IF NOT EXISTS subscription_plan_features_feature_key_idx
  ON public.subscription_plan_features(feature_key);

CREATE INDEX IF NOT EXISTS store_accounts_owner_user_id_idx
  ON public.store_accounts(owner_user_id);

CREATE INDEX IF NOT EXISTS billing_customers_owner_user_id_idx
  ON public.billing_customers(owner_user_id);

CREATE INDEX IF NOT EXISTS billing_customers_store_account_id_idx
  ON public.billing_customers(store_account_id);

CREATE INDEX IF NOT EXISTS store_subscriptions_owner_status_idx
  ON public.store_subscriptions(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS store_subscriptions_store_account_id_idx
  ON public.store_subscriptions(store_account_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS store_subscriptions_one_current_idx
  ON public.store_subscriptions(store_account_id)
  WHERE status IN ('trialing', 'active', 'past_due');

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subscription_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_features FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_plans_public_read" ON public.subscription_plans;
DROP POLICY IF EXISTS "subscription_plan_features_public_read" ON public.subscription_plan_features;
DROP POLICY IF EXISTS "store_accounts_select_owner" ON public.store_accounts;
DROP POLICY IF EXISTS "store_accounts_insert_owner" ON public.store_accounts;
DROP POLICY IF EXISTS "store_accounts_update_owner" ON public.store_accounts;
DROP POLICY IF EXISTS "billing_customers_select_owner" ON public.billing_customers;
DROP POLICY IF EXISTS "billing_customers_update_owner" ON public.billing_customers;
DROP POLICY IF EXISTS "store_subscriptions_select_owner" ON public.store_subscriptions;

CREATE POLICY "subscription_plans_public_read"
ON public.subscription_plans
FOR SELECT
TO anon, authenticated
USING (is_public AND is_active);

CREATE POLICY "subscription_plan_features_public_read"
ON public.subscription_plan_features
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.subscription_plans AS plan
    WHERE plan.id = subscription_plan_features.plan_id
      AND plan.is_public
      AND plan.is_active
  )
);

CREATE POLICY "store_accounts_select_owner"
ON public.store_accounts
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "store_accounts_insert_owner"
ON public.store_accounts
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "store_accounts_update_owner"
ON public.store_accounts
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "billing_customers_select_owner"
ON public.billing_customers
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

CREATE POLICY "billing_customers_update_owner"
ON public.billing_customers
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "store_subscriptions_select_owner"
ON public.store_subscriptions
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_accounts_updated_at ON public.store_accounts;
CREATE TRIGGER update_store_accounts_updated_at
BEFORE UPDATE ON public.store_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_customers_updated_at ON public.billing_customers;
CREATE TRIGGER update_billing_customers_updated_at
BEFORE UPDATE ON public.billing_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_subscriptions_updated_at ON public.store_subscriptions;
CREATE TRIGGER update_store_subscriptions_updated_at
BEFORE UPDATE ON public.store_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (
  id,
  name,
  description,
  price,
  billing_cycle,
  duration_days,
  trial_hours,
  sort_order
)
VALUES
  ('demo', 'Demo 3 Horas', 'Acesso inicial liberado por 3 horas.', 0, 'trial', 0, 3, 0),
  ('fiado', 'Plano Fiado', 'Fiado com painel, clientes, produtos e histórico básico por 30 dias.', 100, 'monthly', 30, 0, 1),
  ('completo', 'Plano Completo', 'Gestão completa do HappyCash no web por 30 dias.', 230, 'monthly', 30, 0, 2),
  ('pro', 'Plano PRO', 'Completo + desktop, mobile e recursos premium por 30 dias.', 347, 'monthly', 30, 0, 3)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  trial_hours = EXCLUDED.trial_hours,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  is_public = true;

DELETE FROM public.subscription_plan_features
WHERE plan_id IN ('demo', 'fiado', 'completo', 'pro');

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('demo', 'dashboard.view', true),
  ('demo', 'clients.manage', true),
  ('demo', 'products.manage', true),
  ('demo', 'deleted.view', true),
  ('demo', 'fiado.manage', true),
  ('demo', 'pdv.use', true),
  ('demo', 'stock.manage', true),
  ('demo', 'reports.view', true),
  ('demo', 'financial.manage', true),
  ('demo', 'notes.manage', true),
  ('demo', 'rewards.manage', true),
  ('demo', 'settings.manage', true),
  ('demo', 'operators.manage', true),
  ('demo', 'cash.manage', true),
  ('demo', 'fiscal.manage', true),
  ('demo', 'desktop.app', true),
  ('demo', 'mobile.app', true),
  ('demo', 'offline.access', true),
  ('demo', 'bematech.print', true),
  ('fiado', 'dashboard.view', true),
  ('fiado', 'clients.manage', true),
  ('fiado', 'products.manage', true),
  ('fiado', 'deleted.view', true),
  ('fiado', 'fiado.manage', true),
  ('completo', 'dashboard.view', true),
  ('completo', 'clients.manage', true),
  ('completo', 'products.manage', true),
  ('completo', 'deleted.view', true),
  ('completo', 'fiado.manage', true),
  ('completo', 'pdv.use', true),
  ('completo', 'stock.manage', true),
  ('completo', 'reports.view', true),
  ('completo', 'financial.manage', true),
  ('completo', 'notes.manage', true),
  ('completo', 'rewards.manage', true),
  ('completo', 'settings.manage', true),
  ('completo', 'operators.manage', true),
  ('completo', 'cash.manage', true),
  ('completo', 'fiscal.manage', true),
  ('pro', 'dashboard.view', true),
  ('pro', 'clients.manage', true),
  ('pro', 'products.manage', true),
  ('pro', 'deleted.view', true),
  ('pro', 'fiado.manage', true),
  ('pro', 'pdv.use', true),
  ('pro', 'stock.manage', true),
  ('pro', 'reports.view', true),
  ('pro', 'financial.manage', true),
  ('pro', 'notes.manage', true),
  ('pro', 'rewards.manage', true),
  ('pro', 'settings.manage', true),
  ('pro', 'operators.manage', true),
  ('pro', 'cash.manage', true),
  ('pro', 'fiscal.manage', true),
  ('pro', 'desktop.app', true),
  ('pro', 'mobile.app', true),
  ('pro', 'offline.access', true),
  ('pro', 'bematech.print', true);
