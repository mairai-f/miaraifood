-- Operators cannot necessarily select store_accounts directly. Resolve the
-- company scope on the server from the authenticated user instead.
CREATE OR REPLACE FUNCTION public.get_internal_chat_context()
RETURNS TABLE(store_account_id uuid, owner_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
BEGIN
  IF auth.uid() IS NULL
    OR v_owner_id IS NULL
    OR v_store_id IS NULL
    OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.view')) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_store_id, v_owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_chat_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_internal_chat_context() TO authenticated;

-- The database, not the browser, decides which conversations the signed-in
-- person may see. Administrators can audit every conversation in their tenant;
-- collaborators only receive conversations of which they are members.
CREATE OR REPLACE FUNCTION public.list_my_internal_chat_conversations()
RETURNS TABLE(id uuid, name text, kind text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
  v_is_admin boolean := public.current_user_is_admin();
BEGIN
  IF auth.uid() IS NULL
    OR v_owner_id IS NULL
    OR v_store_id IS NULL
    OR NOT (v_is_admin OR public.current_user_has_erp_permission('chat.view')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT conversation.id, conversation.name, conversation.kind, conversation.updated_at
  FROM public.internal_chat_conversations AS conversation
  WHERE conversation.store_account_id = v_store_id
    AND (
      v_is_admin
      OR EXISTS (
        SELECT 1
        FROM public.internal_chat_members AS member
        WHERE member.conversation_id = conversation.id
          AND member.user_id = auth.uid()
      )
    )
  ORDER BY conversation.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_internal_chat_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_internal_chat_conversations() TO authenticated;
