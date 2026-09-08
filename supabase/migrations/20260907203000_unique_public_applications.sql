CREATE UNIQUE INDEX IF NOT EXISTS representative_applications_email_unique ON public.representative_applications (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS representative_applications_cpf_unique ON public.representative_applications (regexp_replace(cpf, '\\D', '', 'g'));
CREATE UNIQUE INDEX IF NOT EXISTS delivery_driver_applications_email_unique ON public.delivery_driver_applications (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS delivery_driver_applications_cpf_unique ON public.delivery_driver_applications (regexp_replace(cpf, '\\D', '', 'g'));
