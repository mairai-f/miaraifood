-- A tela bloqueava mais que o banco.
--
-- decide_miar_assistant_action e record_miar_assistant_reply liberam ações com
-- current_store_has_ai_feature('ai.miar.actions'), que vale para quem está em
-- período de teste. Já get_miar_assistant_access exigia ISSO **e** a coluna
-- allows_actions da tabela de cotas, verdadeira só em intermediario/premium.
-- Resultado: loja em teste via "o plano não permite" com o banco liberando —
-- e, desde que a Edge Function passou a esconder as ferramentas de alteração
-- com base nesse campo, a MIAR deixou de propor cadastro, venda e promoção.
--
-- Fonte de verdade única: o recurso de plano. A tabela de cotas volta a cuidar
-- só do limite de mensagens, com o mesmo fallback de teste que
-- start_miar_assistant_turn já aplica (20 mensagens quando o plano não define).
CREATE OR REPLACE FUNCTION public.get_miar_assistant_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  plan text := public.get_current_store_plan_id();
  policy public.ai_assistant_quota_policies;
  used integer := 0;
  period date := date_trunc('month', now())::date;
  trialing boolean;
  limit_value integer;
BEGIN
  IF owner_id IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO policy FROM public.ai_assistant_quota_policies WHERE plan_id = plan;

  SELECT COALESCE(usage.messages_used, 0) INTO used
  FROM public.ai_assistant_usage usage
  WHERE usage.owner_user_id = owner_id AND usage.period_start = period;

  trialing := EXISTS (
    SELECT 1
    FROM public.store_subscriptions subscription
    WHERE subscription.owner_user_id = owner_id
      AND subscription.status = 'trialing'
      AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
  );

  limit_value := COALESCE(policy.monthly_message_limit, 0);
  IF trialing AND limit_value = 0 THEN
    limit_value := 20;
  END IF;

  RETURN jsonb_build_object(
    'owner_user_id', owner_id,
    'has_access', COALESCE(public.current_store_has_ai_feature('ai.miar.use'), false)
                  AND COALESCE(public.current_user_has_erp_permission('ai.miar.chat'), false),
    'plan_id', plan,
    'plan_allows_ai', COALESCE(public.current_store_has_ai_feature('ai.miar.use'), false),
    'user_can_chat', COALESCE(public.current_user_has_erp_permission('ai.miar.chat'), false),
    'user_can_execute', COALESCE(public.current_user_has_erp_permission('ai.miar.execute'), false),
    -- Mesma regra que decide_miar_assistant_action aplica na hora de confirmar.
    'plan_allows_actions', COALESCE(public.current_store_has_ai_feature('ai.miar.actions'), false),
    'in_trial', trialing,
    'message_limit', limit_value,
    'messages_used', COALESCE(used, 0),
    'messages_remaining', GREATEST(limit_value - COALESCE(used, 0), 0),
    'period_start', period,
    'period_end', (period + interval '1 month')::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_miar_assistant_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_miar_assistant_access() TO authenticated;

COMMENT ON COLUMN public.ai_assistant_quota_policies.allows_actions IS
  'Apenas informativo. Quem decide se a MIAR pode alterar dados é o recurso de plano ai.miar.actions (current_store_has_ai_feature), usado por get_miar_assistant_access, record_miar_assistant_reply e decide_miar_assistant_action.';
