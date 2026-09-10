-- MIAR Gestora IA: assistente de gestão exclusiva do estabelecimento.
-- Escopo por tenant reaproveitando get_current_store_owner_id() e as políticas
-- RLS já existentes. A função de borda consulta o banco com o JWT do próprio
-- usuário, então o isolamento entre empresas é o mesmo do resto do ERP.
-- Idempotente: pode ser reexecutada com segurança.

-- ---------------------------------------------------------------------------
-- 1. Permissões de operador
-- ---------------------------------------------------------------------------
INSERT INTO public.erp_permission_catalog
  (permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter)
VALUES
  ('ai.miar.chat', 'ai', 'Conversar com a MIAR Gestora IA',
   'Abrir a assistente e fazer perguntas sobre a operação da loja.', 'web', false, false),
  ('ai.miar.execute', 'ai', 'Aplicar ações sugeridas pela MIAR',
   'Confirmar alterações de preço, estoque, produtos e pedidos propostos pela IA.', 'web', false, false)
ON CONFLICT (permission_key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      module_key = EXCLUDED.module_key,
      runtime_scope = EXCLUDED.runtime_scope;

-- ---------------------------------------------------------------------------
-- 2. Features de plano
-- Tiozão e Inicial ficam de fora de propósito: a IA operacional começa no
-- Intermediário (Manual, seções 19 e 27).
-- ---------------------------------------------------------------------------
-- 'demo' é o plano gratuito: ganha conversa limitada a 20 mensagens/mês como
-- amostra, mas nunca 'ai.miar.actions' — IA de plano grátis não altera dados.
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('demo', 'ai.miar.use', true),
  ('intermediario', 'ai.miar.use', true),
  ('intermediario', 'ai.miar.actions', true),
  ('premium', 'ai.miar.use', true),
  ('premium', 'ai.miar.actions', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

DELETE FROM public.subscription_plan_features
WHERE feature_key = 'ai.miar.use'
  AND plan_id NOT IN ('demo', 'intermediario', 'premium');

DELETE FROM public.subscription_plan_features
WHERE feature_key = 'ai.miar.actions'
  AND plan_id NOT IN ('intermediario', 'premium');

-- ---------------------------------------------------------------------------
-- 3. Verificação estrita de plano
-- current_store_has_feature() libera tudo durante o trial e para contas novas
-- sem assinatura. Para a IA isso quebraria a regra "Tiozão/Inicial sem IA",
-- então a checagem da IA olha apenas as features do plano vigente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_store_has_ai_feature(target_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscription_plan_features feature
    WHERE feature.plan_id = public.get_current_store_plan_id()
      AND feature.feature_key = target_feature
      AND feature.enabled
  );
$$;

REVOKE ALL ON FUNCTION public.current_store_has_ai_feature(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_store_has_ai_feature(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Cotas mensais por plano
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_quota_policies (
  plan_id text PRIMARY KEY REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  monthly_message_limit integer NOT NULL DEFAULT 0 CHECK (monthly_message_limit >= 0),
  allows_actions boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ai_assistant_quota_policies (plan_id, monthly_message_limit, allows_actions)
VALUES
  ('demo',          20,   false),
  ('tiozao',        0,    false),
  ('inicial',       0,    false),
  ('fiado',         0,    false),
  ('completo',      0,    false),
  ('pro',           0,    false),
  ('intermediario', 1500, true),
  ('premium',       5000, true)
ON CONFLICT (plan_id) DO UPDATE
  SET monthly_message_limit = EXCLUDED.monthly_message_limit,
      allows_actions = EXCLUDED.allows_actions,
      updated_at = now();

ALTER TABLE public.ai_assistant_quota_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_quota_policies_read" ON public.ai_assistant_quota_policies;
CREATE POLICY "ai_quota_policies_read"
ON public.ai_assistant_quota_policies
FOR SELECT TO authenticated
USING (true);

-- ---------------------------------------------------------------------------
-- 5. Consumo mensal por estabelecimento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_usage (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  messages_used integer NOT NULL DEFAULT 0 CHECK (messages_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, period_start)
);

ALTER TABLE public.ai_assistant_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_select_store" ON public.ai_assistant_usage;
CREATE POLICY "ai_usage_select_store"
ON public.ai_assistant_usage
FOR SELECT TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());

-- ---------------------------------------------------------------------------
-- 6. Histórico de conversas e análises
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Nova conversa' CHECK (char_length(title) BETWEEN 1 AND 200),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_assistant_conversations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL DEFAULT '',
  -- Ferramentas de leitura executadas e resumo do contexto usado na resposta.
  tool_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_assistant_conversations_store_idx
  ON public.ai_assistant_conversations (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_assistant_messages_conversation_idx
  ON public.ai_assistant_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 7. Ações propostas pela IA, sempre pendentes até confirmação humana
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_assistant_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_assistant_conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.ai_assistant_messages(id) ON DELETE SET NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  -- Argumentos exatos que a IA propôs; a execução relê daqui, nunca do cliente.
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'failed', 'expired')),
  result jsonb,
  error_message text,
  decided_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_assistant_actions_pending_idx
  ON public.ai_assistant_actions (owner_user_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. RLS: tudo restrito ao próprio estabelecimento e a quem tem permissão
-- ---------------------------------------------------------------------------
ALTER TABLE public.ai_assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assistant_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_select_store" ON public.ai_assistant_conversations;
DROP POLICY IF EXISTS "ai_conversations_insert_store" ON public.ai_assistant_conversations;
DROP POLICY IF EXISTS "ai_conversations_update_store" ON public.ai_assistant_conversations;
DROP POLICY IF EXISTS "ai_conversations_delete_store" ON public.ai_assistant_conversations;

CREATE POLICY "ai_conversations_select_store"
ON public.ai_assistant_conversations
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('ai.miar.chat')
);

CREATE POLICY "ai_conversations_insert_store"
ON public.ai_assistant_conversations
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_ai_feature('ai.miar.use')
  AND public.current_user_has_erp_permission('ai.miar.chat')
);

CREATE POLICY "ai_conversations_update_store"
ON public.ai_assistant_conversations
FOR UPDATE TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('ai.miar.chat')
)
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

CREATE POLICY "ai_conversations_delete_store"
ON public.ai_assistant_conversations
FOR DELETE TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('ai.miar.chat')
);

DROP POLICY IF EXISTS "ai_messages_select_store" ON public.ai_assistant_messages;
CREATE POLICY "ai_messages_select_store"
ON public.ai_assistant_messages
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('ai.miar.chat')
);

DROP POLICY IF EXISTS "ai_actions_select_store" ON public.ai_assistant_actions;
CREATE POLICY "ai_actions_select_store"
ON public.ai_assistant_actions
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('ai.miar.chat')
);

-- ---------------------------------------------------------------------------
-- 9. RPCs
-- Escrita em mensagens/ações/consumo passa só por aqui: as tabelas acima não
-- têm policy de INSERT/UPDATE para "authenticated" de propósito, para que a
-- cota não possa ser contornada pelo cliente.
-- ---------------------------------------------------------------------------
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
BEGIN
  IF owner_id IS NULL THEN
    RETURN jsonb_build_object('has_access', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO policy FROM public.ai_assistant_quota_policies WHERE plan_id = plan;

  SELECT COALESCE(usage.messages_used, 0) INTO used
  FROM public.ai_assistant_usage usage
  WHERE usage.owner_user_id = owner_id AND usage.period_start = period;

  RETURN jsonb_build_object(
    'owner_user_id', owner_id,
    'has_access', COALESCE(public.current_store_has_ai_feature('ai.miar.use'), false)
                  AND COALESCE(public.current_user_has_erp_permission('ai.miar.chat'), false),
    'plan_id', plan,
    'plan_allows_ai', COALESCE(public.current_store_has_ai_feature('ai.miar.use'), false),
    'user_can_chat', COALESCE(public.current_user_has_erp_permission('ai.miar.chat'), false),
    'user_can_execute', COALESCE(public.current_user_has_erp_permission('ai.miar.execute'), false),
    'plan_allows_actions', COALESCE(public.current_store_has_ai_feature('ai.miar.actions'), false)
                           AND COALESCE(policy.allows_actions, false),
    'message_limit', COALESCE(policy.monthly_message_limit, 0),
    'messages_used', COALESCE(used, 0),
    'messages_remaining', GREATEST(COALESCE(policy.monthly_message_limit, 0) - COALESCE(used, 0), 0),
    'period_start', period,
    'period_end', (period + interval '1 month')::date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_miar_assistant_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_miar_assistant_access() TO authenticated;

-- Abre (ou reaproveita) a conversa, cobra uma mensagem da cota e grava a
-- pergunta. Falha antes de qualquer chamada ao provedor de IA.
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
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  IF char_length(clean_message) = 0 OR char_length(clean_message) > 4000 THEN
    RAISE EXCEPTION 'Mensagem inválida' USING ERRCODE = '22023';
  END IF;

  IF NOT public.current_store_has_ai_feature('ai.miar.use') THEN
    RAISE EXCEPTION 'A MIAR Gestora IA não está disponível no plano %', COALESCE(plan, 'atual')
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_has_erp_permission('ai.miar.chat') THEN
    RAISE EXCEPTION 'Sem permissão para usar a MIAR Gestora IA' USING ERRCODE = '42501';
  END IF;

  SELECT monthly_message_limit INTO limit_value
  FROM public.ai_assistant_quota_policies WHERE plan_id = plan;
  limit_value := COALESCE(limit_value, 0);

  -- Trava a linha do período antes de comparar, para que duas abas abertas
  -- não gastem a mesma mensagem restante.
  INSERT INTO public.ai_assistant_usage (owner_user_id, period_start, messages_used)
  VALUES (owner_id, period, 0)
  ON CONFLICT (owner_user_id, period_start) DO NOTHING;

  SELECT messages_used INTO used
  FROM public.ai_assistant_usage
  WHERE owner_user_id = owner_id AND period_start = period
  FOR UPDATE;

  IF used >= limit_value THEN
    RAISE EXCEPTION 'Cota mensal da MIAR esgotada (% de % mensagens)', used, limit_value
      USING ERRCODE = '53400';
  END IF;

  IF p_conversation_id IS NULL THEN
    INSERT INTO public.ai_assistant_conversations
      (owner_user_id, store_account_id, created_by_user_id, title)
    VALUES (
      owner_id,
      (SELECT id FROM public.store_accounts WHERE owner_user_id = owner_id ORDER BY created_at LIMIT 1),
      auth.uid(),
      left(clean_message, 80)
    )
    RETURNING * INTO conversation;
  ELSE
    SELECT * INTO conversation
    FROM public.ai_assistant_conversations
    WHERE id = p_conversation_id AND owner_user_id = owner_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conversa não encontrada' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.ai_assistant_messages
    (conversation_id, owner_user_id, author_user_id, role, content)
  VALUES (conversation.id, owner_id, auth.uid(), 'user', clean_message)
  RETURNING id INTO new_message_id;

  UPDATE public.ai_assistant_usage
  SET messages_used = messages_used + 1, updated_at = now()
  WHERE owner_user_id = owner_id AND period_start = period;

  UPDATE public.ai_assistant_conversations
  SET updated_at = now() WHERE id = conversation.id;

  RETURN jsonb_build_object(
    'conversation_id', conversation.id,
    'message_id', new_message_id,
    'messages_remaining', GREATEST(limit_value - (used + 1), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_miar_assistant_turn(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_miar_assistant_turn(text, uuid) TO authenticated;

-- Devolve a mensagem à cota quando nenhum provedor de IA respondeu.
CREATE OR REPLACE FUNCTION public.refund_miar_assistant_message()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  period date := date_trunc('month', now())::date;
BEGIN
  IF owner_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.ai_assistant_usage
  SET messages_used = GREATEST(messages_used - 1, 0), updated_at = now()
  WHERE owner_user_id = owner_id AND period_start = period;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_miar_assistant_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_miar_assistant_message() TO authenticated;

-- Grava a resposta da IA e registra as ações que ela propôs, sempre pendentes.
CREATE OR REPLACE FUNCTION public.record_miar_assistant_reply(
  p_conversation_id uuid,
  p_content text,
  p_provider text DEFAULT NULL,
  p_tool_trace jsonb DEFAULT '[]'::jsonb,
  p_actions jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  new_message_id uuid;
  action_input jsonb;
  created_actions jsonb := '[]'::jsonb;
  new_action public.ai_assistant_actions;
  can_propose_actions boolean;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_assistant_conversations
    WHERE id = p_conversation_id AND owner_user_id = owner_id
  ) THEN
    RAISE EXCEPTION 'Conversa não encontrada' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ai_assistant_messages
    (conversation_id, owner_user_id, author_user_id, role, content, tool_trace, provider)
  VALUES (
    p_conversation_id, owner_id, auth.uid(), 'assistant',
    coalesce(p_content, ''), coalesce(p_tool_trace, '[]'::jsonb), p_provider
  )
  RETURNING id INTO new_message_id;

  can_propose_actions := public.current_store_has_ai_feature('ai.miar.actions');

  IF can_propose_actions AND jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) = 'array' THEN
    FOR action_input IN SELECT * FROM jsonb_array_elements(p_actions)
    LOOP
      INSERT INTO public.ai_assistant_actions
        (conversation_id, message_id, owner_user_id, proposed_by_user_id,
         tool_name, arguments, summary)
      VALUES (
        p_conversation_id,
        new_message_id,
        owner_id,
        auth.uid(),
        action_input ->> 'tool_name',
        coalesce(action_input -> 'arguments', '{}'::jsonb),
        coalesce(action_input ->> 'summary', '')
      )
      RETURNING * INTO new_action;

      created_actions := created_actions || jsonb_build_object(
        'id', new_action.id,
        'tool_name', new_action.tool_name,
        'arguments', new_action.arguments,
        'summary', new_action.summary,
        'status', new_action.status
      );
    END LOOP;
  END IF;

  UPDATE public.ai_assistant_conversations
  SET updated_at = now() WHERE id = p_conversation_id;

  RETURN jsonb_build_object('message_id', new_message_id, 'actions', created_actions);
END;
$$;

REVOKE ALL ON FUNCTION public.record_miar_assistant_reply(uuid, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_miar_assistant_reply(uuid, text, text, jsonb, jsonb) TO authenticated;

-- Confirma ou recusa uma ação proposta. Só devolve os argumentos para execução
-- depois de confirmada: a função de borda nunca executa a partir do que o
-- cliente enviou, e sim do que ficou gravado aqui.
CREATE OR REPLACE FUNCTION public.decide_miar_assistant_action(
  p_action_id uuid,
  p_approved boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  action_row public.ai_assistant_actions;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_erp_permission('ai.miar.execute') THEN
    RAISE EXCEPTION 'Sem permissão para aplicar ações da MIAR' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO action_row
  FROM public.ai_assistant_actions
  WHERE id = p_action_id AND owner_user_id = owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação não encontrada' USING ERRCODE = '42501';
  END IF;

  IF action_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta ação já foi %', action_row.status USING ERRCODE = '55000';
  END IF;

  IF action_row.expires_at <= now() THEN
    UPDATE public.ai_assistant_actions
    SET status = 'expired', decided_at = now(), decided_by_user_id = auth.uid()
    WHERE id = action_row.id;
    RAISE EXCEPTION 'Esta sugestão expirou. Peça de novo à MIAR.' USING ERRCODE = '55000';
  END IF;

  IF NOT p_approved THEN
    UPDATE public.ai_assistant_actions
    SET status = 'rejected', decided_at = now(), decided_by_user_id = auth.uid()
    WHERE id = action_row.id;
    RETURN jsonb_build_object('status', 'rejected', 'id', action_row.id);
  END IF;

  IF NOT public.current_store_has_ai_feature('ai.miar.actions') THEN
    RAISE EXCEPTION 'O plano atual não permite que a MIAR altere dados' USING ERRCODE = '42501';
  END IF;

  UPDATE public.ai_assistant_actions
  SET status = 'confirmed', decided_at = now(), decided_by_user_id = auth.uid()
  WHERE id = action_row.id;

  RETURN jsonb_build_object(
    'status', 'confirmed',
    'id', action_row.id,
    'owner_user_id', owner_id,
    'tool_name', action_row.tool_name,
    'arguments', action_row.arguments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decide_miar_assistant_action(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_miar_assistant_action(uuid, boolean) TO authenticated;

-- Fecha o ciclo da ação com o resultado real da execução.
CREATE OR REPLACE FUNCTION public.complete_miar_assistant_action(
  p_action_id uuid,
  p_result jsonb DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  UPDATE public.ai_assistant_actions
  SET result = p_result,
      error_message = p_error,
      status = CASE WHEN p_error IS NULL THEN 'confirmed' ELSE 'failed' END
  WHERE id = p_action_id
    AND owner_user_id = owner_id
    AND status = 'confirmed';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_miar_assistant_action(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_miar_assistant_action(uuid, jsonb, text) TO authenticated;
