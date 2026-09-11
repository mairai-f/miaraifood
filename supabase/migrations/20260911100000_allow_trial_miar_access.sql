-- Todo cliente em período de trial pode usar a MIAR Gestora IA.
CREATE OR REPLACE FUNCTION public.current_store_has_ai_feature(target_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_subscriptions subscription
    WHERE subscription.owner_user_id = public.get_current_store_owner_id()
      AND subscription.status = 'trialing'
      AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
  )
  OR EXISTS (
    SELECT 1
    FROM public.subscription_plan_features feature
    WHERE feature.plan_id = public.get_current_store_plan_id()
      AND feature.feature_key = target_feature
      AND feature.enabled
  );
$$;

CREATE OR REPLACE FUNCTION public.start_miar_assistant_turn(
  p_message text,
  p_conversation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  plan text := public.get_current_store_plan_id();
  limit_value integer;
  period date := date_trunc('month', now())::date;
  used integer;
  conversation public.ai_assistant_conversations;
  new_message_id uuid;
  clean_message text := btrim(coalesce(p_message, ''));
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000'; END IF;
  IF char_length(clean_message) = 0 OR char_length(clean_message) > 4000 THEN RAISE EXCEPTION 'Mensagem inválida' USING ERRCODE = '22023'; END IF;
  IF NOT public.current_store_has_ai_feature('ai.miar.use') THEN RAISE EXCEPTION 'A MIAR Gestora IA não está disponível no plano %', COALESCE(plan, 'atual') USING ERRCODE = '42501'; END IF;
  IF NOT public.current_user_has_erp_permission('ai.miar.chat') THEN RAISE EXCEPTION 'Sem permissão para usar a MIAR Gestora IA' USING ERRCODE = '42501'; END IF;
  SELECT monthly_message_limit INTO limit_value FROM public.ai_assistant_quota_policies WHERE plan_id = plan;
  IF EXISTS (SELECT 1 FROM public.store_subscriptions s WHERE s.owner_user_id = owner_id AND s.status = 'trialing' AND COALESCE(s.trial_ends_at, s.current_period_ends_at) > now()) AND COALESCE(limit_value, 0) = 0 THEN limit_value := 20; END IF;
  limit_value := COALESCE(limit_value, 0);
  INSERT INTO public.ai_assistant_usage (owner_user_id, period_start, messages_used) VALUES (owner_id, period, 0) ON CONFLICT (owner_user_id, period_start) DO NOTHING;
  SELECT messages_used INTO used FROM public.ai_assistant_usage WHERE owner_user_id = owner_id AND period_start = period FOR UPDATE;
  IF used >= limit_value THEN RAISE EXCEPTION 'Cota mensal da MIAR esgotada (% de % mensagens)', used, limit_value USING ERRCODE = '53400'; END IF;
  IF p_conversation_id IS NULL THEN
    INSERT INTO public.ai_assistant_conversations (owner_user_id, store_account_id, created_by_user_id, title) VALUES (owner_id, (SELECT id FROM public.store_accounts WHERE owner_user_id = owner_id ORDER BY created_at LIMIT 1), auth.uid(), left(clean_message, 80)) RETURNING * INTO conversation;
  ELSE
    SELECT * INTO conversation FROM public.ai_assistant_conversations WHERE id = p_conversation_id AND owner_user_id = owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada' USING ERRCODE = '42501'; END IF;
  END IF;
  INSERT INTO public.ai_assistant_messages (conversation_id, owner_user_id, author_user_id, role, content) VALUES (conversation.id, owner_id, auth.uid(), 'user', clean_message) RETURNING id INTO new_message_id;
  UPDATE public.ai_assistant_usage SET messages_used = messages_used + 1, updated_at = now() WHERE owner_user_id = owner_id AND period_start = period;
  UPDATE public.ai_assistant_conversations SET updated_at = now() WHERE id = conversation.id;
  RETURN jsonb_build_object('conversation_id', conversation.id, 'message_id', new_message_id, 'messages_remaining', GREATEST(limit_value - (used + 1), 0));
END;
$$;
