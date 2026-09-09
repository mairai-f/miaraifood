CREATE OR REPLACE FUNCTION public.internal_chat_user_is_member(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_chat_members WHERE conversation_id = p_conversation_id AND user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.internal_chat_is_owner(p_store_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_accounts WHERE id = p_store_account_id AND owner_user_id = auth.uid());
$$;
