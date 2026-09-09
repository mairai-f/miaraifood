-- Proprietário da empresa tem supervisão total; colaboradores só acessam grupos onde são membros.
CREATE OR REPLACE FUNCTION public.internal_chat_is_owner(p_store_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_accounts a WHERE a.id=p_store_account_id AND a.owner_user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.internal_chat_is_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.internal_chat_is_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS internal_chat_conversation_member ON public.internal_chat_conversations;
CREATE POLICY internal_chat_conversation_access ON public.internal_chat_conversations FOR SELECT TO authenticated
USING (public.internal_chat_is_owner(store_account_id) OR EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=id AND m.user_id=auth.uid()));
CREATE POLICY internal_chat_conversation_owner_manage ON public.internal_chat_conversations FOR ALL TO authenticated
USING (public.internal_chat_is_owner(store_account_id)) WITH CHECK (public.internal_chat_is_owner(store_account_id));
DROP POLICY IF EXISTS internal_chat_member_self ON public.internal_chat_members;
CREATE POLICY internal_chat_member_access ON public.internal_chat_members FOR SELECT TO authenticated
USING (user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=conversation_id AND public.internal_chat_is_owner(c.store_account_id)));
CREATE POLICY internal_chat_member_owner_manage ON public.internal_chat_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=conversation_id AND public.internal_chat_is_owner(c.store_account_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=conversation_id AND public.internal_chat_is_owner(c.store_account_id)));
DROP POLICY IF EXISTS internal_chat_message_member ON public.internal_chat_messages;
CREATE POLICY internal_chat_message_access ON public.internal_chat_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.internal_chat_conversations c WHERE c.id=conversation_id AND (public.internal_chat_is_owner(c.store_account_id) OR EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=c.id AND m.user_id=auth.uid()))));
CREATE POLICY internal_chat_message_send ON public.internal_chat_messages FOR INSERT TO authenticated
WITH CHECK (sender_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=internal_chat_messages.conversation_id AND m.user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.internal_chat_audit_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.internal_chat_audit(conversation_id,actor_user_id,action,metadata)
 VALUES (COALESCE(NEW.conversation_id,OLD.conversation_id),auth.uid(),TG_OP, jsonb_build_object('message_id',COALESCE(NEW.id,OLD.id)));
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER internal_chat_message_audit AFTER INSERT OR UPDATE OR DELETE ON public.internal_chat_messages FOR EACH ROW EXECUTE FUNCTION public.internal_chat_audit_message();
ALTER TABLE public.internal_chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.internal_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_conversations, public.internal_chat_messages;
