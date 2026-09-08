-- # Correcao: impressora termica somente nos planos anuais.
-- # Remove features genericas de impressora mensal e deixa apenas a regra anual.

UPDATE public.subscription_plans
SET description = CASE
  WHEN id = 'completo' THEN 'Gestao completa com PDV, estoque e fiscal por 30 dias.'
  WHEN id = 'pro' THEN 'Completo + desktop PRO Offline, mobile e sincronizacao por 30 dias.'
  ELSE description
END
WHERE id IN ('completo', 'pro');
DELETE FROM public.subscription_plan_features
WHERE feature_key IN ('card.terminal.annual', 'thermal.printer', 'bematech.print');
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('completo', 'thermal.printer.annual', true),
  ('pro', 'thermal.printer.annual', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;
COMMENT ON TABLE public.subscription_plan_features IS
  '# Liga recursos comerciais aos planos. desktop.app e offline.access liberam o PRO Offline; thermal.printer.annual marca impressora somente nos planos anuais Completo e PRO.';
