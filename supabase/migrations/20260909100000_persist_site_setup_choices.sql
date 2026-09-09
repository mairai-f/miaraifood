-- Persiste as escolhas feitas no cadastro público para que a ativação não prometa
-- recursos que ficaram apenas no estado do navegador.
ALTER TABLE public.site_pending_registrations
  ADD COLUMN IF NOT EXISTS setup_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS setup_config jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.store_accounts.setup_config IS
  'Configuração inicial escolhida no cadastro: segmento, modalidades, pagamentos, mesas e cardápio.';
