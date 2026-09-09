-- A direct conversation has different labels for each participant. Never use
-- the stored display name alone: the recipient would otherwise see their own
-- name in the sidebar.
DROP FUNCTION IF EXISTS public.list_my_internal_chat_conversations();

CREATE FUNCTION public.list_my_internal_chat_conversations()
RETURNS TABLE(
  id uuid,
  name text,
  kind text,
  updated_at timestamptz,
  peer_user_id uuid,
  peer_name text,
  peer_photo_url text
)
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
  WITH visible_conversations AS (
    SELECT conversation.*,
      CASE WHEN conversation.kind = 'direct' THEN
        CASE WHEN conversation.created_by_user_id = auth.uid()
          THEN COALESCE(
            conversation.direct_recipient_user_id,
            (SELECT member.user_id FROM public.internal_chat_members AS member
             WHERE member.conversation_id = conversation.id AND member.user_id <> auth.uid()
             ORDER BY member.joined_at LIMIT 1)
          )
          ELSE conversation.created_by_user_id
        END
      END AS resolved_peer_user_id
    FROM public.internal_chat_conversations AS conversation
    WHERE conversation.store_account_id = v_store_id
      AND (v_is_admin OR EXISTS (
        SELECT 1 FROM public.internal_chat_members AS member
        WHERE member.conversation_id = conversation.id AND member.user_id = auth.uid()
      ))
  )
  SELECT conversation.id,
    conversation.name,
    conversation.kind,
    conversation.updated_at,
    conversation.resolved_peer_user_id,
    CASE WHEN conversation.kind = 'direct' THEN
      COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), NULLIF(profile.email, ''), 'Colaborador')
    END,
    CASE WHEN conversation.kind = 'direct' THEN employee.photo_url END
  FROM visible_conversations AS conversation
  LEFT JOIN public.profiles AS profile ON profile.user_id = conversation.resolved_peer_user_id
  LEFT JOIN public.hr_employees AS employee ON employee.profile_user_id = profile.user_id
  ORDER BY conversation.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_internal_chat_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_internal_chat_conversations() TO authenticated;
