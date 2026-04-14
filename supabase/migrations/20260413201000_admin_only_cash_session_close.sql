DROP POLICY IF EXISTS "cash_sessions_update_store" ON public.cash_sessions;

CREATE POLICY "cash_sessions_update_store"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
);
