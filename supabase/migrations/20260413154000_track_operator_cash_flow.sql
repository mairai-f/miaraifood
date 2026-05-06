ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_operator_user_id_idx
  ON public.sales(operator_user_id, date DESC);
CREATE INDEX IF NOT EXISTS sales_cash_session_id_idx
  ON public.sales(cash_session_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_operator_user_id_idx
  ON public.expenses(operator_user_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_cash_session_id_idx
  ON public.expenses(cash_session_id, date DESC);
UPDATE public.sales AS s
SET operator_user_id = p.user_id
FROM public.profiles AS p
WHERE s.operator_user_id IS NULL
  AND NULLIF(trim(coalesce(s.seller_name, '')), '') IS NOT NULL
  AND lower(trim(p.username)) = lower(trim(s.seller_name))
  AND p.owner_user_id = s.user_id;
UPDATE public.sales AS s
SET cash_session_id = cs.id
FROM public.cash_sessions AS cs
WHERE s.cash_session_id IS NULL
  AND s.operator_user_id IS NOT NULL
  AND cs.owner_user_id = s.user_id
  AND cs.operator_user_id = s.operator_user_id
  AND s.date >= cs.opened_at
  AND (cs.closed_at IS NULL OR s.date <= cs.closed_at);
