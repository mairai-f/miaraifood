ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(10,2);
