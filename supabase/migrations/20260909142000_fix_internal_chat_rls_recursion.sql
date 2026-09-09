CREATE OR REPLACE FUNCTION public.internal_chat_user_is_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_chat_members WHERE conversation_id = p_conversation_id AND user_id = p_user_id);
$$;
REVOKE ALL ON FUNCTION public.internal_chat_user_is_member(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_chat_user_is_member(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS internal_chat_conversation_access ON public.internal_chat_conversations;
CREATE POLICY internal_chat_conversation_access ON public.internal_chat_conversations FOR SELECT TO authenticated
USING (public.internal_chat_is_owner(store_account_id) OR public.internal_chat_user_is_member(id, auth.uid()));

DROP POLICY IF EXISTS internal_chat_member_access ON public.internal_chat_members;
CREATE POLICY internal_chat_member_access ON public.internal_chat_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id = conversation_id AND public.internal_chat_is_owner(c.store_account_id)));

DROP POLICY IF EXISTS internal_chat_message_access ON public.internal_chat_messages;
CREATE POLICY internal_chat_message_access ON public.internal_chat_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id = conversation_id AND (public.internal_chat_is_owner(c.store_account_id) OR public.internal_chat_user_is_member(c.id, auth.uid()))));

DROP POLICY IF EXISTS internal_chat_message_send ON public.internal_chat_messages;
CREATE POLICY internal_chat_message_send ON public.internal_chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id = conversation_id AND (public.internal_chat_is_owner(c.store_account_id) OR public.internal_chat_user_is_member(c.id, auth.uid()))));
