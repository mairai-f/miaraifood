DROP INDEX IF EXISTS public.store_accounts_cnpj_unique_idx;
DROP INDEX IF EXISTS public.site_pending_registrations_pending_cpf_cnpj_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS store_accounts_cnpj_product_context_unique_idx
  ON public.store_accounts (cnpj, product_context)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

CREATE UNIQUE INDEX IF NOT EXISTS site_pending_registrations_pending_cpf_cnpj_product_context_uni
  ON public.site_pending_registrations (cpf_cnpj, product_context)
  WHERE status = 'pending';
