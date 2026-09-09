-- O administrador/dono da assinatura sempre participa das conversas da própria
-- empresa. Isso garante leitura, envio e entrega Realtime mesmo sem inclusão
-- manual no grupo.
CREATE OR REPLACE FUNCTION public.internal_chat_add_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS internal_chat_owner_member ON public.internal_chat_conversations;
CREATE TRIGGER internal_chat_owner_member
AFTER INSERT ON public.internal_chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.internal_chat_add_owner_member();

INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
SELECT c.id, c.owner_user_id, 'owner'
FROM public.internal_chat_conversations c
ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'owner';
