-- Fixed application routes cannot also be used as public business slugs.
-- Keep this NOT VALID so legacy rows remain readable through ?empresa=slug
-- until their owner chooses a new public link. New inserts and updates are
-- still checked immediately by PostgreSQL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_business_settings_slug_not_reserved'
      AND conrelid = 'public.agenda_business_settings'::regclass
  ) THEN
    ALTER TABLE public.agenda_business_settings
      ADD CONSTRAINT agenda_business_settings_slug_not_reserved
      CHECK (
        slug <> ALL (
          ARRAY[
            'login',
            'agendamento',
            'booking',
            'meus-agendamentos',
            'my-appointments',
            'painel',
            'painel-barbeiro',
            'painel-profissional',
            'admin',
            'barber',
            'professional',
            'produtos',
            'products',
            'auth',
            'reset-password'
          ]::text[]
        )
      ) NOT VALID;
  END IF;
END $$;
