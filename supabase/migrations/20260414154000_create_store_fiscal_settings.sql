CREATE TABLE IF NOT EXISTS public.store_fiscal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nfce_enabled boolean NOT NULL DEFAULT false,
  nfce_environment text NOT NULL DEFAULT 'homologacao' CHECK (nfce_environment IN ('homologacao', 'producao')),
  nfce_series integer NOT NULL DEFAULT 1 CHECK (nfce_series > 0),
  nfce_next_number integer NOT NULL DEFAULT 1 CHECK (nfce_next_number > 0),
  issuer_state text NOT NULL DEFAULT 'SP' CHECK (issuer_state = 'SP'),
  issuer_legal_name text,
  issuer_trade_name text,
  issuer_cnpj text,
  issuer_state_registration text,
  issuer_tax_regime text CHECK (issuer_tax_regime IN ('1', '2', '3')),
  operation_nature text,
  csc_id text,
  csc_token text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_zip_code text,
  danfe_message text,
  contingency_offline_enabled boolean NOT NULL DEFAULT true,
  print_customer_copy boolean NOT NULL DEFAULT true,
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_fiscal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_fiscal_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_fiscal_settings_select_admin_store" ON public.store_fiscal_settings;
DROP POLICY IF EXISTS "store_fiscal_settings_insert_admin_store" ON public.store_fiscal_settings;
DROP POLICY IF EXISTS "store_fiscal_settings_update_admin_store" ON public.store_fiscal_settings;

CREATE POLICY "store_fiscal_settings_select_admin_store"
ON public.store_fiscal_settings
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);

CREATE POLICY "store_fiscal_settings_insert_admin_store"
ON public.store_fiscal_settings
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);

CREATE POLICY "store_fiscal_settings_update_admin_store"
ON public.store_fiscal_settings
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);

CREATE INDEX IF NOT EXISTS store_fiscal_settings_owner_user_id_idx
  ON public.store_fiscal_settings(owner_user_id);

DROP TRIGGER IF EXISTS update_store_fiscal_settings_updated_at ON public.store_fiscal_settings;
CREATE TRIGGER update_store_fiscal_settings_updated_at
BEFORE UPDATE ON public.store_fiscal_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
