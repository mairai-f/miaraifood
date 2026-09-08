CREATE TABLE IF NOT EXISTS public.store_payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('pix_manual','mercado_pago','asaas','stripe','outro')),
  display_name text NOT NULL DEFAULT '',
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  enabled boolean NOT NULL DEFAULT false,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_config_encrypted bytea,
  secret_ref text,
  webhook_secret_encrypted bytea,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, provider)
);

CREATE TABLE IF NOT EXISTS public.store_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.store_payment_providers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.food_orders(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  method text NOT NULL CHECK (method IN ('pix','credit_card','debit_card','cash','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorized','paid','failed','refunded','cancelled')),
  provider_transaction_id text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_payment_provider_owner ON public.store_payment_providers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin()) WITH CHECK (EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin());
CREATE POLICY store_payment_transaction_owner ON public.store_payment_transactions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin());
REVOKE ALL ON public.store_payment_providers, public.store_payment_transactions FROM anon;
-- Segredos nunca são retornados ao cliente. A aplicação usa a view segura;
-- somente funções/Edge Functions com service_role manipulam as colunas secretas.
CREATE OR REPLACE VIEW public.store_payment_providers_safe
WITH (security_invoker = true) AS
SELECT id, store_account_id, provider, display_name, environment, enabled,
       public_config, secret_ref, created_by, created_at, updated_at
FROM public.store_payment_providers;

REVOKE ALL ON public.store_payment_providers FROM authenticated;
GRANT SELECT ON public.store_payment_providers_safe TO authenticated;
GRANT INSERT (store_account_id, provider, display_name, environment, enabled, public_config, secret_ref, created_by)
  ON public.store_payment_providers TO authenticated;
GRANT UPDATE (display_name, environment, enabled, public_config, secret_ref)
  ON public.store_payment_providers TO authenticated;
GRANT DELETE ON public.store_payment_providers TO authenticated;
GRANT SELECT ON public.store_payment_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_store_payment_provider_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS store_payment_providers_touch_updated_at ON public.store_payment_providers;
CREATE TRIGGER store_payment_providers_touch_updated_at
BEFORE UPDATE ON public.store_payment_providers
FOR EACH ROW EXECUTE FUNCTION public.touch_store_payment_provider_updated_at();
GRANT SELECT ON public.store_payment_transactions TO authenticated;
