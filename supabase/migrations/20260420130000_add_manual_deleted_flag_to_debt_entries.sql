ALTER TABLE public.debt_entries
ADD COLUMN IF NOT EXISTS manual_deleted boolean NOT NULL DEFAULT false;
