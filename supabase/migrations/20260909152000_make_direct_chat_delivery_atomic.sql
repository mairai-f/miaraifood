-- Creates/repairs a direct conversation in one transaction. Older browser
-- code inserted the owner twice, which could leave a conversation without its
-- intended recipient and make messages invisible to that collaborator.
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
  IF auth.uid() IS NULL OR p_target_user_id IS NULL OR p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid_direct_conversation';
  END IF;

  IF v_owner_id IS NULL OR v_store_id IS NULL
    OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.view')) THEN
    RAISE EXCEPTION 'unauthorized_chat_access';
  END IF;

  SELECT COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), NULLIF(profile.email, ''), 'Colaborador')
  INTO v_name
  FROM public.profiles profile
  LEFT JOIN public.hr_employees employee ON employee.profile_user_id = profile.user_id
  WHERE profile.user_id = p_target_user_id
    AND profile.owner_user_id = v_owner_id;

  IF v_name IS NULL THEN RAISE EXCEPTION 'target_not_in_company'; END IF;

  SELECT c.id INTO v_conversation_id
  FROM public.internal_chat_conversations c
  WHERE c.store_account_id = v_store_id
    AND c.kind = 'direct'
    AND (
      EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id = c.id AND m.user_id = auth.uid())
      AND (EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id = c.id AND m.user_id = p_target_user_id)
        OR (c.created_by_user_id = auth.uid() AND c.name = v_name))
    )
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.internal_chat_conversations(store_account_id, owner_user_id, name, kind, created_by_user_id)
    VALUES (v_store_id, v_owner_id, v_name, 'direct', auth.uid())
    RETURNING id INTO v_conversation_id;
  END IF;

  -- The owner is added by trigger. Only the target is inserted here.
  INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
  VALUES (v_conversation_id, p_target_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_internal_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_internal_direct_conversation(uuid) TO authenticated;
