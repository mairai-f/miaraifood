ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS debt_due_date date;

COMMENT ON COLUMN public.clients.debt_due_date IS
  'Optional expected payment date for the client open debt balance.';
