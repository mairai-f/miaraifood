ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate_pct numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_commission_rate_pct_range,
  ADD CONSTRAINT profiles_commission_rate_pct_range
    CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 100);

COMMENT ON COLUMN public.profiles.commission_enabled IS
  'Indica se o colaborador participa do relatorio de comissoes.';

COMMENT ON COLUMN public.profiles.commission_rate_pct IS
  'Percentual de comissao do colaborador sobre vendas liquidas registradas no periodo.';
