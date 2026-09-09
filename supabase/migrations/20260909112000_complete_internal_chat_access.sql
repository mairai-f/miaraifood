DROP POLICY IF EXISTS internal_chat_audit_member ON public.internal_chat_audit;
CREATE POLICY internal_chat_audit_access ON public.internal_chat_audit FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.internal_chat_conversations c
  WHERE c.id=conversation_id AND (
    public.internal_chat_is_owner(c.store_account_id)
    OR EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=c.id AND m.user_id=auth.uid())
  )
));

CREATE OR REPLACE FUNCTION public.internal_chat_prune_expired_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  DELETE FROM public.internal_chat_audit WHERE expires_at <= now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS internal_chat_audit_prune ON public.internal_chat_audit;
CREATE TRIGGER internal_chat_audit_prune BEFORE INSERT ON public.internal_chat_audit
FOR EACH STATEMENT EXECUTE FUNCTION public.internal_chat_prune_expired_audit();

CREATE OR REPLACE FUNCTION public.internal_chat_audit_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.internal_chat_audit(conversation_id,actor_user_id,action,metadata)
 VALUES (COALESCE(NEW.conversation_id,OLD.conversation_id),auth.uid(),TG_TABLE_NAME || ':' || TG_OP,
   jsonb_build_object('member_user_id',COALESCE(NEW.user_id,OLD.user_id)));
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER internal_chat_membership_audit AFTER INSERT OR UPDATE OR DELETE ON public.internal_chat_members
FOR EACH ROW EXECUTE FUNCTION public.internal_chat_audit_membership();
CREATE OR REPLACE FUNCTION public.internal_chat_audit_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.internal_chat_audit(conversation_id,actor_user_id,action,metadata)
 VALUES (NEW.id,auth.uid(),'conversation:' || TG_OP,jsonb_build_object('name',NEW.name));
 RETURN NEW;
END $$;
CREATE TRIGGER internal_chat_conversation_audit AFTER INSERT OR UPDATE ON public.internal_chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.internal_chat_audit_conversation();
