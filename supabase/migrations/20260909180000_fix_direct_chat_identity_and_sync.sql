-- O trigger de 20260909141000 inseria o dono da assinatura como membro de
-- TODA conversa, inclusive das conversas diretas entre dois colaboradores.
-- Como a conversa direta é identificada por "os dois são membros", o canal
-- privado de duas pessoas passava a casar também para o administrador: ele
-- reaproveitava a conversa alheia, o rótulo do contato saía trocado para os
-- três participantes e as mensagens caíam em linhas diferentes das que o
-- destinatário estava lendo.
--
-- Uma conversa direta passa a ter exatamente dois membros. Grupos continuam
-- com o dono como membro automático: a supervisão de grupo depende disso e as
-- funções de grupo não inserem o dono explicitamente.

CREATE OR REPLACE FUNCTION public.internal_chat_add_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind <> 'group' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner')
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END;
$$;

-- A migration 20260909174000 arquiva duplicatas sem mover as mensagens, o que
-- deixaria histórico órfão. Restaura o que ela escondeu antes de unificar de
-- verdade: exclusão feita pelo dono grava auditoria 'conversation:SOFT_DELETE',
-- então uma conversa direta arquivada sem esse registro não foi excluída por
-- ninguém -- só pelo arquivamento automático.
UPDATE public.internal_chat_conversations conversation
SET deleted_at = NULL
WHERE conversation.kind = 'direct'
  AND conversation.deleted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.internal_chat_audit audit
    WHERE audit.conversation_id = conversation.id
      AND audit.action = 'conversation:SOFT_DELETE'
  );

-- Remove a participação automática do dono nas conversas diretas alheias. Uma
-- conversa direta com mais de dois membros só pode ter sido inflada pelo
-- trigger; quando o próprio dono abriu a conversa ele permanece participante.
DELETE FROM public.internal_chat_members member
USING public.internal_chat_conversations conversation
WHERE member.conversation_id = conversation.id
  AND conversation.kind = 'direct'
  AND member.user_id = conversation.owner_user_id
  AND conversation.created_by_user_id IS DISTINCT FROM conversation.owner_user_id
  AND (
    SELECT count(*) FROM public.internal_chat_members counted
    WHERE counted.conversation_id = conversation.id
  ) > 2;

-- A função de abertura regravava direct_recipient_user_id a cada visita, então
-- o campo hoje pode apontar para quem apenas abriu a conversa. Recalcula a
-- partir dos membros reais.
UPDATE public.internal_chat_conversations conversation
SET direct_recipient_user_id = (
  SELECT member.user_id
  FROM public.internal_chat_members member
  WHERE member.conversation_id = conversation.id
    AND member.user_id <> conversation.created_by_user_id
  ORDER BY member.joined_at
  LIMIT 1
)
WHERE conversation.kind = 'direct'
  AND conversation.created_by_user_id IS NOT NULL
  AND (
    SELECT count(*) FROM public.internal_chat_members counted
    WHERE counted.conversation_id = conversation.id
  ) = 2;

-- Reúne num único canal as conversas diretas duplicadas do mesmo par. As
-- mensagens e a auditoria são preservadas: passam para o canal mais antigo do
-- par, que é o que os dois participantes continuam vendo.
DROP TABLE IF EXISTS pg_temp.direct_chat_merge;
CREATE TEMP TABLE direct_chat_merge AS
WITH direct_pairs AS (
  SELECT conversation.id,
    conversation.store_account_id,
    conversation.created_at,
    array_agg(member.user_id ORDER BY member.user_id) AS pair
  FROM public.internal_chat_conversations conversation
  JOIN public.internal_chat_members member ON member.conversation_id = conversation.id
  WHERE conversation.kind = 'direct' AND conversation.deleted_at IS NULL
  GROUP BY conversation.id, conversation.store_account_id, conversation.created_at
  HAVING count(*) = 2
)
SELECT id AS duplicate_id,
  first_value(id) OVER (
    PARTITION BY store_account_id, pair ORDER BY created_at, id
  ) AS canonical_id
FROM direct_pairs;

DELETE FROM direct_chat_merge WHERE duplicate_id = canonical_id;

UPDATE public.internal_chat_messages message
SET conversation_id = merge.canonical_id
FROM direct_chat_merge merge
WHERE message.conversation_id = merge.duplicate_id;

UPDATE public.internal_chat_audit audit
SET conversation_id = merge.canonical_id
FROM direct_chat_merge merge
WHERE audit.conversation_id = merge.duplicate_id;

-- Nenhuma mensagem migrada pode ser marcada como lida por engano: basta um
-- canal sem leitura registrada para o marcador voltar a ficar em aberto.
UPDATE public.internal_chat_members target
SET last_read_at = merged.last_read_at
FROM (
  SELECT merge.canonical_id, member.user_id,
    CASE WHEN count(*) FILTER (WHERE member.last_read_at IS NULL) > 0
      THEN NULL ELSE min(member.last_read_at) END AS last_read_at
  FROM direct_chat_merge merge
  JOIN public.internal_chat_members member
    ON member.conversation_id IN (merge.duplicate_id, merge.canonical_id)
  GROUP BY merge.canonical_id, member.user_id
) AS merged
WHERE target.conversation_id = merged.canonical_id
  AND target.user_id = merged.user_id
  AND target.last_read_at IS DISTINCT FROM merged.last_read_at;

UPDATE public.internal_chat_conversations conversation
SET deleted_at = now(), archived_at = COALESCE(conversation.archived_at, now())
FROM direct_chat_merge merge
WHERE conversation.id = merge.duplicate_id AND conversation.deleted_at IS NULL;

UPDATE public.internal_chat_conversations conversation
SET updated_at = GREATEST(conversation.updated_at, COALESCE((
  SELECT max(message.created_at) FROM public.internal_chat_messages message
  WHERE message.conversation_id = conversation.id
), conversation.updated_at))
WHERE conversation.id IN (SELECT canonical_id FROM direct_chat_merge);

DROP TABLE direct_chat_merge;

-- A conversa direta é o canal cujos membros são exatamente as duas pessoas.
-- "Contém os dois" não serve: qualquer terceiro presente fazia o canal alheio
-- ser reaproveitado. O lock por par impede que dois cliques simultâneos criem
-- duas linhas para a mesma dupla, e direct_recipient_user_id passa a ser
-- gravado apenas na criação, nunca reescrito por quem abre a conversa.
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
  IF NOT public.erp_user_has_permission(p_target_user_id, 'chat.view') THEN RAISE EXCEPTION 'target_not_authorized_for_chat'; END IF;
  SELECT COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), 'Colaborador') INTO v_name
  FROM public.profiles profile LEFT JOIN public.hr_employees employee ON employee.profile_user_id = profile.user_id
  WHERE profile.user_id = p_target_user_id AND profile.owner_user_id = v_owner_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'target_not_in_company'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_store_id::text
    || ':' || least(auth.uid()::text, p_target_user_id::text)
    || ':' || greatest(auth.uid()::text, p_target_user_id::text), 0));

  SELECT conversation.id INTO v_conversation_id
  FROM public.internal_chat_conversations conversation
  WHERE conversation.store_account_id = v_store_id
    AND conversation.kind = 'direct'
    AND conversation.deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.internal_chat_members member WHERE member.conversation_id = conversation.id AND member.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.internal_chat_members member WHERE member.conversation_id = conversation.id AND member.user_id = p_target_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.internal_chat_members member
      WHERE member.conversation_id = conversation.id
        AND member.user_id <> auth.uid()
        AND member.user_id <> p_target_user_id)
  ORDER BY conversation.created_at, conversation.id LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.internal_chat_conversations(store_account_id,owner_user_id,name,kind,created_by_user_id,direct_recipient_user_id)
    VALUES (v_store_id,v_owner_id,v_name,'direct',auth.uid(),p_target_user_id)
    RETURNING id INTO v_conversation_id;
    INSERT INTO public.internal_chat_members(conversation_id,user_id,role)
    VALUES (v_conversation_id,auth.uid(),CASE WHEN auth.uid() = v_owner_id THEN 'owner' ELSE 'member' END),
           (v_conversation_id,p_target_user_id,CASE WHEN p_target_user_id = v_owner_id THEN 'owner' ELSE 'member' END)
    ON CONFLICT (conversation_id,user_id) DO NOTHING;
  ELSE
    UPDATE public.internal_chat_conversations SET updated_at = now() WHERE id = v_conversation_id;
  END IF;
  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_internal_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_internal_direct_conversation(uuid) TO authenticated;

-- O contato exibido depende de quem está olhando: é o outro membro da
-- conversa, nunca quem a criou. E a lista de conversas passa a ser a lista de
-- conversas de quem está logado; o administrador continua vendo todos os
-- grupos da empresa, mas conversa privada alheia não entra na caixa dele --
-- a supervisão de conteúdo permanece nas funções de auditoria.
DROP FUNCTION IF EXISTS public.list_my_internal_chat_conversations();

CREATE FUNCTION public.list_my_internal_chat_conversations()
RETURNS TABLE(
  id uuid,
  name text,
  kind text,
  updated_at timestamptz,
  peer_user_id uuid,
  peer_name text,
  peer_role_label text,
  peer_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_owner_id uuid := public.get_current_store_owner_id();
  v_store_id uuid := public.get_current_store_account_id_for_context('happycash');
  v_is_admin boolean := public.current_user_is_admin();
BEGIN
  IF auth.uid() IS NULL OR v_owner_id IS NULL OR v_store_id IS NULL
    OR NOT (v_is_admin OR public.current_user_has_erp_permission('chat.view')) THEN RETURN; END IF;

  RETURN QUERY
  WITH visible_conversations AS (
    SELECT conversation.*,
      CASE WHEN conversation.kind = 'direct' THEN COALESCE(
        (SELECT member.user_id FROM public.internal_chat_members AS member
          WHERE member.conversation_id = conversation.id AND member.user_id <> auth.uid()
          ORDER BY member.joined_at LIMIT 1),
        NULLIF(conversation.direct_recipient_user_id, auth.uid()),
        NULLIF(conversation.created_by_user_id, auth.uid())
      ) END AS resolved_peer_user_id
    FROM public.internal_chat_conversations AS conversation
    WHERE conversation.store_account_id = v_store_id
      AND conversation.deleted_at IS NULL
      AND (
        EXISTS (SELECT 1 FROM public.internal_chat_members AS member
          WHERE member.conversation_id = conversation.id AND member.user_id = auth.uid())
        OR (v_is_admin AND conversation.kind = 'group')
      )
  )
  SELECT conversation.id, conversation.name, conversation.kind, conversation.updated_at,
    conversation.resolved_peer_user_id,
    CASE WHEN conversation.kind <> 'direct' THEN NULL
      WHEN conversation.resolved_peer_user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), 'Colaborador') END,
    CASE WHEN conversation.kind <> 'direct' THEN NULL
      WHEN conversation.resolved_peer_user_id = v_owner_id THEN 'Administrador'
      ELSE COALESCE(NULLIF(employee.position, ''), NULLIF(profile.job_title, ''), CASE profile.role WHEN 'waiter' THEN 'Garçom' WHEN 'hr' THEN 'RH' ELSE 'Colaborador' END) END,
    CASE WHEN conversation.kind = 'direct' THEN COALESCE(employee.photo_url, profile.avatar_url) END
  FROM visible_conversations AS conversation
  LEFT JOIN public.profiles AS profile ON profile.user_id = conversation.resolved_peer_user_id
  LEFT JOIN public.hr_employees AS employee ON employee.profile_user_id = profile.user_id
  ORDER BY conversation.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_internal_chat_conversations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_internal_chat_conversations() TO authenticated;
