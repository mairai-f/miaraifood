ALTER TABLE public.store_fiscal_settings
ADD COLUMN IF NOT EXISTS fiscal_mode text NOT NULL DEFAULT 'receipt_only',
ADD COLUMN IF NOT EXISTS danfe_auto_print boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS danfe_store_locally boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS consumer_document_prompt_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS danfe_print_width text NOT NULL DEFAULT '80mm';

ALTER TABLE public.store_fiscal_settings
DROP CONSTRAINT IF EXISTS store_fiscal_settings_fiscal_mode_check;

ALTER TABLE public.store_fiscal_settings
ADD CONSTRAINT store_fiscal_settings_fiscal_mode_check
CHECK (fiscal_mode IN ('receipt_only', 'nfce'));

ALTER TABLE public.store_fiscal_settings
DROP CONSTRAINT IF EXISTS store_fiscal_settings_danfe_print_width_check;

ALTER TABLE public.store_fiscal_settings
ADD CONSTRAINT store_fiscal_settings_danfe_print_width_check
CHECK (danfe_print_width IN ('80mm', '58mm'));

UPDATE public.store_fiscal_settings
SET fiscal_mode = 'nfce'
WHERE nfce_enabled = true
  AND fiscal_mode = 'receipt_only';

ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS fiscal_customer_document text,
ADD COLUMN IF NOT EXISTS fiscal_customer_name text;
