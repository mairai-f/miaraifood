ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS delivery_courier_name text,
  ADD COLUMN IF NOT EXISTS service_ticket_number integer CHECK (service_ticket_number > 0);

CREATE OR REPLACE FUNCTION public.get_store_receipt_profile()
RETURNS TABLE (
  store_name text,
  tax_id text,
  phone text,
  address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    COALESCE(
      NULLIF(trim(fiscal.issuer_trade_name), ''),
      NULLIF(trim(account.nome_estabelecimento), ''),
      'HappyCash'
    ) AS store_name,
    COALESCE(
      NULLIF(regexp_replace(COALESCE(fiscal.issuer_cnpj, ''), '\D', '', 'g'), ''),
      NULLIF(regexp_replace(COALESCE(account.cnpj, ''), '\D', '', 'g'), '')
    ) AS tax_id,
    NULLIF(trim(account.telefone), '') AS phone,
    NULLIF(trim(account.endereco), '') AS address
  FROM public.store_accounts AS account
  LEFT JOIN public.store_fiscal_settings AS fiscal
    ON fiscal.owner_user_id = account.owner_user_id
  WHERE account.owner_user_id = public.get_current_store_owner_id()
  ORDER BY account.created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_store_receipt_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_receipt_profile() TO authenticated;
