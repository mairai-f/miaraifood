-- O gerenciamento de grupos já existe no banco (participantes, foto, arquivo e
-- auditoria), mas a listagem não devolvia a foto do grupo nem o estado de
-- arquivamento, então a interface não tinha como exibir nem oferecer as ações.
DROP FUNCTION IF EXISTS public.list_my_internal_chat_conversations();

CREATE FUNCTION public.list_my_internal_chat_conversations()
RETURNS TABLE(
  id uuid,
  name text,
  kind text,
  updated_at timestamptz,
  photo_url text,
  archived_at timestamptz,
  peer_user_id uuid,
  peer_name text,
  peer_role_label text,
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
  IF auth.uid() IS NULL OR v_owner_id IS NULL OR v_store_id IS NULL
    OR NOT (v_is_admin OR public.current_user_has_erp_permission('chat.view')) THEN RETURN; END IF;

  RETURN QUERY
  WITH visible_conversations AS (
    SELECT conversation.*,
      CASE WHEN conversation.kind = 'direct' THEN COALESCE(
        (SELECT member.user_id FROM public.internal_chat_members AS member
          WHERE member.conversation_id = conversation.id AND member.user_id <> auth.uid()
          ORDER BY member.joined_at LIMIT 1),
        NULLIF(conversation.direct_recipient_user_id, auth.uid()),
        NULLIF(conversation.created_by_user_id, auth.uid())
      ) END AS resolved_peer_user_id
    FROM public.internal_chat_conversations AS conversation
    WHERE conversation.store_account_id = v_store_id
      AND conversation.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM public.internal_chat_members AS member
          WHERE member.conversation_id = conversation.id AND member.user_id = auth.uid())
        OR (v_is_admin AND conversation.kind = 'group')
      )
  )
  SELECT conversation.id, conversation.name, conversation.kind, conversation.updated_at,
    CASE WHEN conversation.kind = 'group' THEN conversation.photo_url END,
    conversation.archived_at,
    conversation.resolved_peer_user_id,
    CASE WHEN conversation.kind <> 'direct' THEN NULL
      WHEN conversation.resolved_peer_user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), 'Colaborador') END,
    CASE WHEN conversation.kind <> 'direct' THEN NULL
      WHEN conversation.resolved_peer_user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.position, ''), NULLIF(profile.job_title, ''), CASE profile.role WHEN 'waiter' THEN 'Garçom' WHEN 'hr' THEN 'RH' ELSE 'Colaborador' END) END,
    CASE WHEN conversation.kind = 'direct' THEN COALESCE(employee.photo_url, profile.avatar_url) END
  FROM visible_conversations AS conversation
  LEFT JOIN public.profiles AS profile ON profile.user_id = conversation.resolved_peer_user_id
  LEFT JOIN public.hr_employees AS employee ON employee.profile_user_id = profile.user_id
  ORDER BY conversation.archived_at NULLS FIRST, conversation.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_internal_chat_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_internal_chat_conversations() TO authenticated;
