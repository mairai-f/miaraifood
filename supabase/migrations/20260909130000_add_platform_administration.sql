CREATE TABLE IF NOT EXISTS public.platform_banned_emails (
  email text PRIMARY KEY, reason text, banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  banned_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  establishment_name text NOT NULL, person_name text NOT NULL, person_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','revoked','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'), created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.platform_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL UNIQUE,
  cities text NOT NULL DEFAULT '', revenue numeric(12,2) NOT NULL DEFAULT 0, managers integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL DEFAULT '', after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Estado administrativo separado da assinatura comercial. Isso evita usar
-- "cancelado" como sinônimo de bloqueio manual e preserva a cobrança.
CREATE TABLE IF NOT EXISTS public.platform_company_controls (
  store_account_id uuid PRIMARY KEY REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  is_suspended boolean NOT NULL DEFAULT false,
  suspended_reason text,
  suspended_at timestamptz,
  deleted_at timestamptz,
  deleted_reason text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_banned_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_company_controls ENABLE ROW LEVEL SECURITY;
