INSERT INTO public.erp_permission_catalog (permission_key,module_key,name,description,runtime_scope,default_operator,default_waiter)
VALUES
  ('chat.message.edit','chat','Editar mensagens próprias','Editar mensagens enviadas pelo próprio colaborador.', 'both', false, false),
  ('chat.message.delete','chat','Excluir mensagens próprias','Excluir mensagens enviadas pelo próprio colaborador.', 'both', false, false)
ON CONFLICT (permission_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,runtime_scope=EXCLUDED.runtime_scope;

CREATE OR REPLACE FUNCTION public.update_internal_chat_message(p_message_id uuid,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth SET row_security=off AS $$
BEGIN
  IF NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.message.edit')) THEN
    RAISE EXCEPTION 'unauthorized_message_edit';
  END IF;
  IF char_length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_message_body'; END IF;
  UPDATE public.internal_chat_messages SET body=btrim(p_body)
  WHERE id=p_message_id AND sender_user_id=auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'message_not_editable'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_internal_chat_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth SET row_security=off AS $$
BEGIN
  IF NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('chat.message.delete')) THEN
    RAISE EXCEPTION 'unauthorized_message_delete';
  END IF;
  UPDATE public.internal_chat_messages SET deleted_at=now(),body='Mensagem removida'
  WHERE id=p_message_id AND sender_user_id=auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'message_not_deletable'; END IF;
END; $$;
