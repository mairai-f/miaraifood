CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_owner_created_idx
  ON public.audit_logs(owner_user_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_select_store_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_store_admin"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.get_current_user_role() = 'admin'
);
DROP POLICY IF EXISTS "audit_logs_insert_store" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_store"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND actor_user_id = auth.uid()
);
