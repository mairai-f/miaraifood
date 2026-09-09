CREATE OR REPLACE FUNCTION public.list_internal_chat_group_members(p_conversation_id uuid)
RETURNS TABLE(user_id uuid, name text, photo_url text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  IF NOT public.internal_chat_can_manage_group('chat.group.members.manage') THEN RAISE EXCEPTION 'unauthorized_group_members'; END IF;
  RETURN QUERY
  SELECT member.user_id, COALESCE(NULLIF(employee.full_name,''),NULLIF(profile.username,''),'Colaborador'), employee.photo_url
  FROM public.internal_chat_members member
  JOIN public.internal_chat_conversations conversation ON conversation.id=member.conversation_id
  LEFT JOIN public.profiles profile ON profile.user_id=member.user_id
  LEFT JOIN public.hr_employees employee ON employee.profile_user_id=member.user_id
  WHERE member.conversation_id=p_conversation_id AND conversation.owner_user_id=v_owner_id AND conversation.kind='group' AND conversation.deleted_at IS NULL
  ORDER BY member.joined_at;
END; $$;

CREATE OR REPLACE FUNCTION public.list_internal_chat_audit(p_conversation_id uuid)
RETURNS TABLE(id uuid, action text, created_at timestamptz, actor_name text, metadata jsonb)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  IF NOT public.internal_chat_can_manage_group('chat.audit.view') THEN RAISE EXCEPTION 'unauthorized_chat_audit'; END IF;
  RETURN QUERY
  SELECT audit.id,audit.action,audit.created_at,
    CASE WHEN audit.actor_user_id=v_owner_id THEN 'Administrador' ELSE COALESCE(NULLIF(employee.full_name,''),NULLIF(profile.username,''),'Sistema') END,
    audit.metadata
  FROM public.internal_chat_audit audit
  JOIN public.internal_chat_conversations conversation ON conversation.id=audit.conversation_id
  LEFT JOIN public.profiles profile ON profile.user_id=audit.actor_user_id
  LEFT JOIN public.hr_employees employee ON employee.profile_user_id=profile.user_id
  WHERE audit.conversation_id=p_conversation_id AND conversation.owner_user_id=v_owner_id
  ORDER BY audit.created_at DESC LIMIT 200;
END; $$;

REVOKE ALL ON FUNCTION public.list_internal_chat_group_members(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_internal_chat_audit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_internal_chat_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_internal_chat_audit(uuid) TO authenticated;
