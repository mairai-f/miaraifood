ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'appointment',
  ADD COLUMN IF NOT EXISTS public_queue_visible boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_business_settings_service_mode_check'
      AND conrelid = 'public.agenda_business_settings'::regclass
  ) THEN
    ALTER TABLE public.agenda_business_settings
      ADD CONSTRAINT agenda_business_settings_service_mode_check
      CHECK (service_mode IN ('appointment', 'walk_in', 'both')) NOT VALID;
  END IF;
END $$;

