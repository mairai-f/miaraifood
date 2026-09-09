-- A display name is mutable and may differ from the login username. Direct
-- chats must be identified by authenticated user ids only.
ALTER TABLE public.internal_chat_conversations
  ADD COLUMN IF NOT EXISTS direct_recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS internal_chat_direct_recipient_idx
  ON public.internal_chat_conversations(store_account_id, created_by_user_id, direct_recipient_user_id)
  WHERE kind = 'direct';

CREATE OR REPLACE FUNCTION public.ensure_internal_direct_conversation(p_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
  v_name text;
  v_conversation_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_target_user_id IS NULL OR p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'invalid_direct_conversation'; END IF;
  IF v_owner_id IS NULL OR v_store_id IS NULL OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.view')) THEN RAISE EXCEPTION 'unauthorized_chat_access'; END IF;

  SELECT COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), NULLIF(profile.email, ''), 'Colaborador')
  INTO v_name
  FROM public.profiles profile LEFT JOIN public.hr_employees employee ON employee.profile_user_id = profile.user_id
  WHERE profile.user_id = p_target_user_id AND profile.owner_user_id = v_owner_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'target_not_in_company'; END IF;

  SELECT id INTO v_conversation_id
  FROM public.internal_chat_conversations
  WHERE store_account_id = v_store_id AND kind = 'direct'
    AND ((created_by_user_id = auth.uid() AND direct_recipient_user_id = p_target_user_id)
      OR (created_by_user_id = p_target_user_id AND direct_recipient_user_id = auth.uid()))
  ORDER BY updated_at DESC LIMIT 1;

  -- Upgrade an old owner-only direct chat when its visual name still matches.
  IF v_conversation_id IS NULL THEN
    SELECT c.id INTO v_conversation_id
    FROM public.internal_chat_conversations c
    WHERE c.store_account_id = v_store_id AND c.kind = 'direct'
      AND c.created_by_user_id = auth.uid() AND c.direct_recipient_user_id IS NULL
      AND lower(trim(c.name)) = lower(trim(v_name))
    ORDER BY c.updated_at DESC LIMIT 1;
    IF v_conversation_id IS NOT NULL THEN
      UPDATE public.internal_chat_conversations SET direct_recipient_user_id = p_target_user_id WHERE id = v_conversation_id;
    END IF;
  END IF;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.internal_chat_conversations(store_account_id, owner_user_id, name, kind, created_by_user_id, direct_recipient_user_id)
    VALUES (v_store_id, v_owner_id, v_name, 'direct', auth.uid(), p_target_user_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
  VALUES (v_conversation_id, p_target_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN v_conversation_id;
END;
$$;

ALTER TABLE public.internal_chat_members REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_chat_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
