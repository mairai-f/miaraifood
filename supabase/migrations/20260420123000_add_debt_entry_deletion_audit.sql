ALTER TABLE public.debt_entries
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_reason text,
ADD COLUMN IF NOT EXISTS deleted_by text;
