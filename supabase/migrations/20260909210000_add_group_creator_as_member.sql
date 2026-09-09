-- Quem cria o grupo nunca era inserido como participante: a função inseria
-- apenas os selecionados, e o dono entrava por trigger. Um colaborador com
-- chat.group.create criava o grupo e ele desaparecia da lista dele na hora,
-- porque a listagem exige participação -- a tela ainda tentava abrir a
-- conversa recém-criada e recebia chat_conversation_not_available.
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
  VALUES (v_id, auth.uid(), CASE WHEN auth.uid() = v_owner_id THEN 'owner' ELSE 'member' END)
  ON CONFLICT (conversation_id,user_id) DO NOTHING;

  INSERT INTO public.internal_chat_members(conversation_id,user_id,role)
  SELECT v_id, profile.user_id, 'member'
  FROM public.profiles profile
  WHERE profile.owner_user_id=v_owner_id AND profile.user_id=ANY(coalesce(p_member_ids, '{}')) AND profile.user_id<>v_owner_id
  ON CONFLICT (conversation_id,user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_internal_chat_group(text,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_internal_chat_group(text,uuid[]) TO authenticated;

-- Grupos já criados sem o autor entre os participantes recebem o autor agora.
INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
SELECT conversation.id, conversation.created_by_user_id,
  CASE WHEN conversation.created_by_user_id = conversation.owner_user_id THEN 'owner' ELSE 'member' END
FROM public.internal_chat_conversations conversation
WHERE conversation.kind = 'group'
  AND conversation.deleted_at IS NULL
  AND conversation.created_by_user_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;
