-- Adicionar índices para melhorar performance em queries frequentes
-- Índices em debt_entries
CREATE INDEX IF NOT EXISTS idx_debt_entries_client_id ON public.debt_entries (client_id);
CREATE INDEX IF NOT EXISTS idx_debt_entries_date_added ON public.debt_entries (date_added DESC);
CREATE INDEX IF NOT EXISTS idx_debt_entries_status ON public.debt_entries (status);

-- Índices em payments
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments (client_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments (date DESC);

-- Índices em clients
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients (user_id);

-- Índices em sales (se não existirem)
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales (user_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales (date DESC);

-- Índices em expenses (se não existirem)
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);