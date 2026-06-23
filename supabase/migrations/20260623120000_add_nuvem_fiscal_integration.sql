ALTER TABLE public.store_fiscal_settings
ADD COLUMN IF NOT EXISTS fiscal_provider text NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS issuer_city_ibge_code text,
ADD COLUMN IF NOT EXISTS nuvem_fiscal_company_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS nuvem_fiscal_nfce_config_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS nuvem_fiscal_certificate_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS nuvem_fiscal_last_error text;

ALTER TABLE public.store_fiscal_settings
DROP CONSTRAINT IF EXISTS store_fiscal_settings_provider_check;

ALTER TABLE public.store_fiscal_settings
ADD CONSTRAINT store_fiscal_settings_provider_check
CHECK (fiscal_provider IN ('internal', 'nuvem_fiscal'));

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS fiscal_ncm text,
ADD COLUMN IF NOT EXISTS fiscal_cfop text,
ADD COLUMN IF NOT EXISTS fiscal_origin integer,
ADD COLUMN IF NOT EXISTS fiscal_csosn text,
ADD COLUMN IF NOT EXISTS fiscal_pis_cst text,
ADD COLUMN IF NOT EXISTS fiscal_cofins_cst text,
ADD COLUMN IF NOT EXISTS fiscal_unit text NOT NULL DEFAULT 'UN',
ADD COLUMN IF NOT EXISTS fiscal_gtin text NOT NULL DEFAULT 'SEM GTIN',
ADD COLUMN IF NOT EXISTS fiscal_cest text;

ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_fiscal_origin_check;

ALTER TABLE public.products
ADD CONSTRAINT products_fiscal_origin_check
CHECK (fiscal_origin IS NULL OR fiscal_origin BETWEEN 0 AND 8);

ALTER TABLE public.fiscal_documents
ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'internal',
ADD COLUMN IF NOT EXISTS external_id text,
ADD COLUMN IF NOT EXISTS external_status text;

ALTER TABLE public.fiscal_documents
DROP CONSTRAINT IF EXISTS fiscal_documents_provider_check;

ALTER TABLE public.fiscal_documents
ADD CONSTRAINT fiscal_documents_provider_check
CHECK (provider IN ('internal', 'nuvem_fiscal'));

CREATE INDEX IF NOT EXISTS fiscal_documents_external_id_idx
  ON public.fiscal_documents(provider, external_id)
  WHERE external_id IS NOT NULL;
