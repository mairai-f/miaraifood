-- O dono da empresa pode enviar na própria conversa mesmo durante a criação
-- do grupo; colaboradores continuam obrigados a ser membros explícitos.
DROP POLICY IF EXISTS internal_chat_message_send ON public.internal_chat_messages;
CREATE POLICY internal_chat_message_send ON public.internal_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.internal_chat_conversations c
    WHERE c.id = internal_chat_messages.conversation_id
      AND (
        public.internal_chat_is_owner(c.store_account_id)
        OR EXISTS (
          SELECT 1 FROM public.internal_chat_members m
          WHERE m.conversation_id = c.id AND m.user_id = auth.uid()
        )
      )
  )
);
