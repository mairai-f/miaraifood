CREATE UNIQUE INDEX IF NOT EXISTS store_accounts_email_unique_ci_idx
  ON public.store_accounts (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS store_accounts_cnpj_unique_idx
  ON public.store_accounts (cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';
CREATE UNIQUE INDEX IF NOT EXISTS site_pending_registrations_pending_email_unique_ci_idx
  ON public.site_pending_registrations (lower(email))
  WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS site_pending_registrations_pending_cpf_cnpj_unique_idx
  ON public.site_pending_registrations (cpf_cnpj)
  WHERE status = 'pending';
