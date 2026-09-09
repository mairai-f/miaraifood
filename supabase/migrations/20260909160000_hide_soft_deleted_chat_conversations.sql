-- Keep soft-deleted conversations out of every normal chat listing.
DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.list_my_internal_chat_conversations()'::regprocedure)
  INTO v_definition;
  v_definition := replace(
    v_definition,
    'WHERE conversation.store_account_id = v_store_id' || chr(10) || '      AND (v_is_admin',
    'WHERE conversation.store_account_id = v_store_id' || chr(10) || '      AND conversation.deleted_at IS NULL' || chr(10) || '      AND (v_is_admin'
  );
  EXECUTE v_definition;
END $$;
