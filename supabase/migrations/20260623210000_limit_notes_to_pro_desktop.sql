-- A area de Notas/NFC-e deve aparecer somente para o HappyCash Desktop PRO.
-- O web e os planos Demo/Fiado/Completo seguem com cupom/recibo nao fiscal.
UPDATE public.subscription_plan_features
SET enabled = false
WHERE feature_key = 'notes.manage'
  AND plan_id IN ('demo', 'fiado', 'completo');

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES ('pro', 'notes.manage', true)
ON CONFLICT (plan_id, feature_key)
DO UPDATE SET enabled = true;
