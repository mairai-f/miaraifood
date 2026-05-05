-- # PRO Offline, planos anuais e impressora termica
-- # Esta migration documenta e prepara a primeira fase comercial do PRO Offline.
-- # O app desktop continua liberado apenas para o plano PRO pela Edge Function `desktop-license`.
-- # A tolerancia offline de 7 dias fica no contrato da licenca retornada ao executavel.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS annual_price numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.annual_price IS
  '# Preco anual comercial exibido no site. Nao muda sozinho a cobranca mensal do Asaas.';

UPDATE public.subscription_plans
SET
  annual_price = CASE
    WHEN id = 'fiado' THEN 997
    WHEN id = 'completo' THEN 2097
    WHEN id = 'pro' THEN 2997
    ELSE 0
  END,
  description = CASE
    WHEN id = 'demo' THEN 'Acesso inicial liberado por 12 horas.'
    WHEN id = 'fiado' THEN 'Plano Basico para fiado, clientes e produtos por 30 dias.'
    WHEN id = 'completo' THEN 'Gestao completa com PDV, estoque, fiscal e impressora termica instalada no computador por 30 dias.'
    WHEN id = 'pro' THEN 'Completo + desktop PRO Offline, mobile, sincronizacao e impressora termica instalada no computador por 30 dias.'
    ELSE description
  END
WHERE id IN ('demo', 'fiado', 'completo', 'pro');

UPDATE public.subscription_plans
SET name = 'Plano Basico'
WHERE id = 'fiado';

-- # Feature `thermal.printer`
-- # Completo e PRO podem divulgar/configurar impressora termica instalada no computador.
-- # Fiado/Basico e Demo nao recebem esta feature para evitar promessa comercial indevida.
DELETE FROM public.subscription_plan_features
WHERE feature_key IN ('thermal.printer', 'bematech.print', 'card.terminal.annual')
  AND plan_id NOT IN ('completo', 'pro');

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('completo', 'thermal.printer', true),
  ('completo', 'bematech.print', true),
  ('completo', 'card.terminal.annual', true),
  ('pro', 'thermal.printer', true),
  ('pro', 'bematech.print', true),
  ('pro', 'card.terminal.annual', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

COMMENT ON TABLE public.subscription_plan_features IS
  '# Liga recursos comerciais aos planos. Exemplo: desktop.app e offline.access liberam o PRO Offline; thermal.printer libera impressora nos planos Completo e PRO; card.terminal.annual marca maquininha somente nos anuais Completo e PRO.';

COMMENT ON COLUMN public.subscription_plan_features.feature_key IS
  '# Nome tecnico do recurso controlado por plano, usado pelo app, site e Edge Functions.';

-- # Feature `offline.access`
-- # O PRO Offline usa ativacao inicial online, cache local da licenca no desktop e sincronizacao posterior.
-- # A tolerancia offline comercial e de 7 dias apos o fim do ciclo de 30 dias.
COMMENT ON TABLE public.store_subscriptions IS
  '# Assinaturas da loja. current_period_ends_at define o fim dos 30 dias; o desktop PRO usa esse prazo para calcular a tolerancia offline local de 7 dias.';
