CREATE TABLE IF NOT EXISTS public.access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  username text,
  email text,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'site')),
  client_session_id text NOT NULL,
  device_type text NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  os_name text,
  browser_name text,
  ip_address text,
  country_code text,
  user_agent text,
  login_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, user_id, source, client_session_id)
);
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_session_id uuid REFERENCES public.access_sessions(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  username text,
  email text,
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('system', 'site')),
  event_type text NOT NULL CHECK (event_type IN ('login', 'logout')),
  device_type text NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'unknown')),
  os_name text,
  browser_name text,
  ip_address text,
  country_code text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_sessions_owner_last_seen_idx
  ON public.access_sessions(owner_user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS access_sessions_owner_active_idx
  ON public.access_sessions(owner_user_id, ended_at, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_owner_occurred_idx
  ON public.access_logs(owner_user_id, occurred_at DESC);
ALTER TABLE public.access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_sessions_select_store" ON public.access_sessions;
DROP POLICY IF EXISTS "access_logs_select_store" ON public.access_logs;
CREATE POLICY "access_sessions_select_store"
ON public.access_sessions
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('settings.manage')
);
CREATE POLICY "access_logs_select_store"
ON public.access_logs
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('settings.manage')
);
DROP TRIGGER IF EXISTS update_access_sessions_updated_at ON public.access_sessions;
CREATE TRIGGER update_access_sessions_updated_at
BEFORE UPDATE ON public.access_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
