-- Public logo display size controlled by the HappyCash Agenda admin.

ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS logo_size numeric NOT NULL DEFAULT 36;

ALTER TABLE public.agenda_business_settings
  ADD CONSTRAINT agenda_business_settings_logo_size_range
    CHECK (logo_size >= 24 AND logo_size <= 64) NOT VALID;
