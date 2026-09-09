-- Chat contacts must be resolved on the server. A collaborator has no broad
-- SELECT privilege on profiles, but may see colleagues who are eligible for
-- the same internal chat tenant.
CREATE OR REPLACE FUNCTION public.list_internal_chat_contacts()
RETURNS TABLE(
  user_id uuid,
  display_name text,
  role_label text,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
BEGIN
  IF auth.uid() IS NULL OR v_owner_id IS NULL OR v_store_id IS NULL
    OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.view')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT profile.user_id,
    CASE WHEN profile.user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), 'Colaborador') END,
    CASE WHEN profile.user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.position, ''), NULLIF(profile.job_title, ''),
        CASE profile.role WHEN 'waiter' THEN 'Garçom' WHEN 'hr' THEN 'RH' ELSE 'Colaborador' END) END,
    COALESCE(employee.photo_url, profile.avatar_url)
  FROM public.profiles AS profile
  LEFT JOIN public.hr_employees AS employee ON employee.profile_user_id = profile.user_id
  WHERE profile.owner_user_id = v_owner_id
    AND profile.user_id <> auth.uid()
    AND (profile.user_id = v_owner_id OR public.erp_user_has_permission(profile.user_id, 'chat.view'))
  ORDER BY 2;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_chat_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_chat_contacts() TO authenticated;

-- The receipt belongs to the message data, never to a browser guess. A sent
-- message is read only when every other current member has read past it.
CREATE OR REPLACE FUNCTION public.list_internal_chat_messages(p_conversation_id uuid)
RETURNS TABLE(
  id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  body text,
  created_at timestamptz,
  deleted_at timestamptz,
  read_by_all boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
BEGIN
  IF auth.uid() IS NULL OR v_store_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.internal_chat_conversations conversation
    WHERE conversation.id = p_conversation_id
      AND conversation.store_account_id = v_store_id
      AND (public.current_user_is_admin() OR EXISTS (
        SELECT 1 FROM public.internal_chat_members member
        WHERE member.conversation_id = conversation.id AND member.user_id = auth.uid()
      ))
  ) THEN
    RAISE EXCEPTION 'chat_conversation_not_available';
  END IF;

  RETURN QUERY
  SELECT message.id, message.conversation_id, message.sender_user_id,
    message.body, message.created_at, message.deleted_at,
    NOT EXISTS (
      SELECT 1 FROM public.internal_chat_members member
      WHERE member.conversation_id = message.conversation_id
        AND member.user_id <> message.sender_user_id
        AND (member.last_read_at IS NULL OR member.last_read_at < message.created_at)
    )
  FROM public.internal_chat_messages message
  WHERE message.conversation_id = p_conversation_id
  ORDER BY message.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.list_internal_chat_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_chat_messages(uuid) TO authenticated;
