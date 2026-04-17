ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30 CHECK (duration_days >= 0);

UPDATE public.subscription_plans
SET
  duration_days = CASE
    WHEN id = 'demo' THEN 0
    ELSE 30
  END,
  description = CASE
    WHEN id = 'demo' THEN 'Acesso inicial liberado por 3 horas.'
    WHEN id = 'fiado' THEN 'Fiado com painel, clientes, produtos e histórico básico por 30 dias.'
    WHEN id = 'completo' THEN 'Gestão completa do HappyCash no web por 30 dias.'
    WHEN id = 'pro' THEN 'Completo + desktop, mobile e recursos premium por 30 dias.'
    ELSE description
  END
WHERE id IN ('demo', 'fiado', 'completo', 'pro');
