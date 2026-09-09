CREATE OR REPLACE FUNCTION public.get_my_internal_chat_unread_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
  SELECT count(*)::integer
  FROM public.internal_chat_messages message
  JOIN public.internal_chat_members membership
    ON membership.conversation_id = message.conversation_id
   AND membership.user_id = auth.uid()
  JOIN public.internal_chat_conversations conversation
    ON conversation.id = message.conversation_id
  WHERE message.sender_user_id <> auth.uid()
    AND message.deleted_at IS NULL
    AND (membership.last_read_at IS NULL OR message.created_at > membership.last_read_at)
    AND conversation.archived_at IS NULL
    AND conversation.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_internal_chat_unread_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_internal_chat_unread_count() TO authenticated;
