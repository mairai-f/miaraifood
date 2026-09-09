DO $$
DECLARE v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.list_my_internal_chat_conversations()'::regprocedure) INTO v_definition;
  v_definition := replace(v_definition, 'CASE WHEN conversation.kind = ''direct'' THEN employee.photo_url END', 'CASE WHEN conversation.kind = ''direct'' THEN COALESCE(employee.photo_url, profile.avatar_url) END');
  EXECUTE v_definition;
END $$;
