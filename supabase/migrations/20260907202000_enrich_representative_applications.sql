ALTER TABLE public.representative_applications
  ADD COLUMN IF NOT EXISTS represented_company boolean,
  ADD COLUMN IF NOT EXISTS prospecting_channels text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS representation_type text NOT NULL DEFAULT 'independent'
    CHECK (representation_type IN ('independent','agency','referral_partner')),
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_cnpj text,
  ADD COLUMN IF NOT EXISTS has_client_portfolio boolean NOT NULL DEFAULT false;
