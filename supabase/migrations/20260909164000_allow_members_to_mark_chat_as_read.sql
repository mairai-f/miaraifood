-- A member may only update their own read marker; this does not grant any
-- permission to add, remove or alter other conversation members.
DROP POLICY IF EXISTS internal_chat_member_self_read ON public.internal_chat_members;
CREATE POLICY internal_chat_member_self_read
ON public.internal_chat_members
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
