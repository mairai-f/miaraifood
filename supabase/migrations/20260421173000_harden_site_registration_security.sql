CREATE TABLE IF NOT EXISTS public.site_pending_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome_cliente text NOT NULL,
  telefone text NOT NULL,
  cpf_cnpj text NOT NULL,
  nome_estabelecimento text NOT NULL,
  tipo_estabelecimento text NOT NULL,
  cep text NOT NULL,
  endereco text NOT NULL,
  nome_rua text NOT NULL,
  numero text,
  complemento text,
  bairro text,
  cidade text NOT NULL,
  estado text NOT NULL,
  failure_reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  trial_ends_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_pending_registrations_status_created_at_idx
  ON public.site_pending_registrations(status, created_at DESC);
ALTER TABLE public.site_pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pending_registrations FORCE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS update_site_pending_registrations_updated_at ON public.site_pending_registrations;
CREATE TRIGGER update_site_pending_registrations_updated_at
BEFORE UPDATE ON public.site_pending_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE IF NOT EXISTS public.site_registration_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text,
  email_hash text,
  status text NOT NULL CHECK (status IN ('blocked', 'config_error', 'created', 'failed', 'honeypot', 'invalid')),
  origin text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_registration_attempts_created_at_idx
  ON public.site_registration_attempts(created_at DESC);
CREATE INDEX IF NOT EXISTS site_registration_attempts_ip_hash_created_at_idx
  ON public.site_registration_attempts(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_registration_attempts_email_hash_created_at_idx
  ON public.site_registration_attempts(email_hash, created_at DESC)
  WHERE email_hash IS NOT NULL;
ALTER TABLE public.site_registration_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_registration_attempts FORCE ROW LEVEL SECURITY;
