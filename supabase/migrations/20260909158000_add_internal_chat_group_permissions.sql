-- Fine-grained, server-enforced permissions for group conversations.
INSERT INTO public.erp_permission_catalog (permission_key,module_key,name,description,runtime_scope,default_operator,default_waiter)
VALUES
  ('chat.group.create','chat','Criar grupos','Criar grupos de conversa da equipe.', 'web', false, false),
  ('chat.group.edit','chat','Editar grupos','Alterar o nome de grupos da equipe.', 'web', false, false),
  ('chat.group.photo.edit','chat','Alterar foto de grupos','Alterar a imagem de grupos da equipe.', 'web', false, false),
  ('chat.group.members.manage','chat','Gerenciar participantes','Adicionar e remover participantes de grupos.', 'web', false, false),
  ('chat.group.archive','chat','Arquivar grupos','Arquivar e restaurar grupos da equipe.', 'web', false, false),
  ('chat.audit.view','chat','Ver auditoria do chat','Consultar o histórico auditável das conversas.', 'web', false, false),
  ('chat.group.delete','chat','Excluir grupos','Permissão informativa: a exclusão definitiva é exclusiva do dono.', 'web', false, false)
ON CONFLICT (permission_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope;

ALTER TABLE public.internal_chat_conversations
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.internal_chat_can_manage_group(p_permission_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.current_user_is_admin() OR public.current_user_has_erp_permission(p_permission_key);
$$;

CREATE OR REPLACE FUNCTION public.create_internal_chat_group(p_name text, p_member_ids uuid[] DEFAULT '{}')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_owner_id IS NULL OR v_store_id IS NULL
    OR NOT public.internal_chat_can_manage_group('chat.group.create') THEN RAISE EXCEPTION 'unauthorized_group_create'; END IF;
  IF char_length(btrim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'invalid_group_name'; END IF;
  INSERT INTO public.internal_chat_conversations(store_account_id,owner_user_id,name,kind,created_by_user_id)
  VALUES (v_store_id,v_owner_id,btrim(p_name),'group',auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.internal_chat_members(conversation_id,user_id,role)
  SELECT v_id, profile.user_id, 'member'
  FROM public.profiles profile
  WHERE profile.owner_user_id=v_owner_id AND profile.user_id=ANY(coalesce(p_member_ids, '{}')) AND profile.user_id<>v_owner_id
  ON CONFLICT (conversation_id,user_id) DO NOTHING;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_internal_chat_group(p_conversation_id uuid, p_name text DEFAULT NULL, p_photo_url text DEFAULT NULL, p_clear_photo boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=p_conversation_id AND c.owner_user_id=v_owner_id AND c.kind='group' AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'group_not_found'; END IF;
  IF p_name IS NOT NULL AND (NOT public.internal_chat_can_manage_group('chat.group.edit') OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80) THEN RAISE EXCEPTION 'unauthorized_or_invalid_group_name'; END IF;
  IF (p_photo_url IS NOT NULL OR p_clear_photo) AND NOT public.internal_chat_can_manage_group('chat.group.photo.edit') THEN RAISE EXCEPTION 'unauthorized_group_photo'; END IF;
  UPDATE public.internal_chat_conversations SET
    name=COALESCE(btrim(p_name),name),
    photo_url=CASE WHEN p_clear_photo THEN NULL WHEN p_photo_url IS NOT NULL THEN NULLIF(btrim(p_photo_url),'') ELSE photo_url END,
    updated_at=now()
  WHERE id=p_conversation_id;
END; $$;

CREATE OR REPLACE FUNCTION public.set_internal_chat_group_members(p_conversation_id uuid, p_member_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  IF NOT public.internal_chat_can_manage_group('chat.group.members.manage') THEN RAISE EXCEPTION 'unauthorized_group_members'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=p_conversation_id AND c.owner_user_id=v_owner_id AND c.kind='group' AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'group_not_found'; END IF;
  DELETE FROM public.internal_chat_members member
  WHERE member.conversation_id=p_conversation_id AND member.user_id<>v_owner_id
    AND NOT (member.user_id=ANY(coalesce(p_member_ids, '{}')));
  INSERT INTO public.internal_chat_members(conversation_id,user_id,role)
  SELECT p_conversation_id, profile.user_id, 'member'
  FROM public.profiles profile
  WHERE profile.owner_user_id=v_owner_id AND profile.user_id=ANY(coalesce(p_member_ids, '{}')) AND profile.user_id<>v_owner_id
  ON CONFLICT (conversation_id,user_id) DO NOTHING;
  UPDATE public.internal_chat_conversations SET updated_at=now() WHERE id=p_conversation_id;
END; $$;

CREATE OR REPLACE FUNCTION public.archive_internal_chat_group(p_conversation_id uuid, p_archive boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  IF NOT public.internal_chat_can_manage_group('chat.group.archive') THEN RAISE EXCEPTION 'unauthorized_group_archive'; END IF;
  UPDATE public.internal_chat_conversations SET archived_at=CASE WHEN p_archive THEN now() ELSE NULL END, updated_at=now()
  WHERE id=p_conversation_id AND owner_user_id=v_owner_id AND kind='group' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'group_not_found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_internal_chat_conversation(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE v_owner_id uuid := public.get_current_store_owner_id(); BEGIN
  -- Subscription owner only. Soft deletion preserves the required audit trail.
  IF auth.uid() IS NULL OR auth.uid()<>v_owner_id THEN RAISE EXCEPTION 'only_subscription_owner_can_delete'; END IF;
  UPDATE public.internal_chat_conversations SET deleted_at=now(), archived_at=COALESCE(archived_at,now()), updated_at=now()
  WHERE id=p_conversation_id AND owner_user_id=v_owner_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation_not_found'; END IF;
  INSERT INTO public.internal_chat_audit(conversation_id,actor_user_id,action,metadata)
  VALUES(p_conversation_id,auth.uid(),'conversation:SOFT_DELETE',jsonb_build_object('preserved_until',now()+interval '3 months'));
END; $$;

REVOKE ALL ON FUNCTION public.create_internal_chat_group(text,uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_internal_chat_group(uuid,text,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_internal_chat_group_members(uuid,uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_internal_chat_group(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_internal_chat_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_internal_chat_group(text,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_internal_chat_group(uuid,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_internal_chat_group_members(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_internal_chat_group(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_internal_chat_conversation(uuid) TO authenticated;
