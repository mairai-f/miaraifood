-- NFC-e fiscal deve ficar restrita ao HappyCash Desktop PRO.
-- O web segue com cupom/recibo nao fiscal.
UPDATE public.subscription_plan_features
SET enabled = false
WHERE feature_key = 'fiscal.manage'
  AND plan_id IN ('demo', 'fiado', 'completo');

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES ('pro', 'fiscal.manage', true)
ON CONFLICT (plan_id, feature_key)
DO UPDATE SET enabled = true;
