-- A direct conversation is only possible when the selected employee has chat
-- access too; the UI filter is not the security boundary.
DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.ensure_internal_direct_conversation(uuid)'::regprocedure)
  INTO v_definition;
  v_definition := replace(
    v_definition,
    'IF v_name IS NULL THEN RAISE EXCEPTION ''target_not_in_company''; END IF;',
    'IF v_name IS NULL OR NOT public.erp_user_has_permission(p_target_user_id, ''chat.view'') THEN RAISE EXCEPTION ''target_not_authorized_for_chat''; END IF;'
  );
  EXECUTE v_definition;
END $$;
