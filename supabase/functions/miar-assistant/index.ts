import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';
import { buildStoreSnapshot } from './storeContext.ts';
import { callModel, configuredProviders, type ChatMessage } from './providers.ts';
import { describeAction, mutatingToolNames, readOnlyToolNames, runConfirmedAction, runReadTool } from './tools.ts';

const MAX_TOOL_ROUNDS = 3;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `Você é a MIAR Gestora IA, a assistente de gestão exclusiva DESTE estabelecimento dentro do ERP MIAR AI/FOOD.

Você fala com o dono ou gestor sobre a operação real da loja dele: faturamento, custos, margem, estoque, compras, perdas, demanda, equipe e marketing.

REGRAS:
1. Responda SEMPRE em Português do Brasil, direto e prático, como um consultor de restaurante que olhou os números.
2. Use os dados do "RETRATO DA OPERAÇÃO" abaixo. Cite números concretos (valores em reais, quantidades, percentuais). Nunca invente número: se o dado não estiver no retrato nem vier de uma ferramenta, diga que não há registro suficiente.
3. Toda recomendação vem com o motivo e, quando fizer sentido, com o valor esperado. Prefira "suba a Coca 2L de R$ 10 para R$ 11,50 porque a margem está em 12%, abaixo dos 30% do resto da bebida" a conselhos genéricos.
4. Para ALTERAR qualquer coisa (criar produto, mudar preço, mexer no estoque, abrir pedido de compra) você DEVE chamar a ferramenta correspondente. A alteração não acontece na hora: ela vira uma sugestão que a pessoa confirma na tela. Explique o que vai mudar e peça a confirmação.
5. Antes de propor cadastrar um produto, use buscar_produto para não duplicar.
6. Você enxerga apenas este estabelecimento. Nunca compare com outras empresas nem cite dados que não sejam desta loja.
7. Seja conciso. Use tópicos curtos. Nada de textão.`;

const jsonResponse = (body: unknown, status: number, headers: Headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: new Headers([...headers.entries(), ['Content-Type', 'application/json']]),
  });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleCorsPreflight(request);

  const { headers, allowed } = buildCorsHeaders(request);
  if (!allowed) return jsonResponse({ error: 'Origem não permitida.' }, 403, headers);
  if (request.method !== 'POST') return jsonResponse({ error: 'Método não permitido.' }, 405, headers);

  const authHeader = request.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Autenticação necessária.' }, 401, headers);
  }

  // Cliente com o JWT do usuário: o RLS do ERP continua sendo a barreira de
  // isolamento entre estabelecimentos. Nenhuma chave de service role aqui.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Sessão inválida.' }, 401, headers);
  }

  const rateLimit = await checkRedisRateLimit(request, {
    identifier: `miar-assistant:${userData.user.id}`,
    limit: readRateLimitEnv('MIAR_ASSISTANT_RATE_LIMIT_PER_MINUTE', 20),
    windowSeconds: 60,
  });
  if (!rateLimit.allowed) {
    return jsonResponse({ error: 'Muitas mensagens seguidas. Aguarde alguns segundos.' }, 429, headers);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Corpo inválido.' }, 400, headers);
  }

  const action = String(body.action ?? 'chat');

  try {
    // ── Situação de acesso, cota e permissões ────────────────────────────────
    if (action === 'access') {
      const { data, error } = await supabase.rpc('get_miar_assistant_access');
      if (error) throw new Error(error.message);
      return jsonResponse({ ...data, providers: configuredProviders() }, 200, headers);
    }

    // ── Histórico ────────────────────────────────────────────────────────────
    if (action === 'history') {
      const conversationId = body.conversation_id ? String(body.conversation_id) : null;
      if (!conversationId) {
        const { data, error } = await supabase
          .from('ai_assistant_conversations')
          .select('id,title,created_at,updated_at')
          .is('archived_at', null)
          .order('updated_at', { ascending: false })
          .limit(30);
        if (error) throw new Error(error.message);
        return jsonResponse({ conversations: data ?? [] }, 200, headers);
      }

      const [messages, actions] = await Promise.all([
        supabase.from('ai_assistant_messages')
          .select('id,role,content,provider,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase.from('ai_assistant_actions')
          .select('id,message_id,tool_name,arguments,summary,status,error_message,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }),
      ]);
      return jsonResponse(
        { messages: messages.data ?? [], actions: actions.data ?? [] },
        200,
        headers,
      );
    }

    // ── Confirmar ou recusar uma ação proposta ───────────────────────────────
    if (action === 'decide') {
      const actionId = String(body.action_id ?? '');
      const approved = body.approved === true;
      if (!actionId) return jsonResponse({ error: 'Ação não informada.' }, 400, headers);

      // O banco valida permissão, plano, status e expiração, e só então
      // devolve os argumentos gravados. Nada vem do cliente.
      const { data: decision, error: decideError } = await supabase
        .rpc('decide_miar_assistant_action', { p_action_id: actionId, p_approved: approved });
      if (decideError) return jsonResponse({ error: decideError.message }, 403, headers);
      if (!approved) return jsonResponse({ status: 'rejected' }, 200, headers);

      const decided = decision as {
        owner_user_id: string; tool_name: string; arguments: Record<string, unknown>;
      };

      try {
        const result = await runConfirmedAction(
          supabase, decided.owner_user_id, decided.tool_name, decided.arguments,
        );
        await supabase.rpc('complete_miar_assistant_action', { p_action_id: actionId, p_result: result });
        return jsonResponse({ status: 'confirmed', result }, 200, headers);
      } catch (executionError) {
        const message = executionError instanceof Error ? executionError.message : 'Falha ao executar.';
        await supabase.rpc('complete_miar_assistant_action', { p_action_id: actionId, p_error: message });
        return jsonResponse({ status: 'failed', error: message }, 200, headers);
      }
    }

    // ── Conversa ─────────────────────────────────────────────────────────────
    if (action !== 'chat') return jsonResponse({ error: 'Ação desconhecida.' }, 400, headers);

    const message = String(body.message ?? '').trim();
    const conversationId = body.conversation_id ? String(body.conversation_id) : null;

    // Cobra a cota e grava a pergunta ANTES de gastar chamada de IA. Se o plano
    // não tem direito, ou a cota acabou, para aqui.
    const { data: turn, error: turnError } = await supabase.rpc('start_miar_assistant_turn', {
      p_message: message,
      p_conversation_id: conversationId,
    });
    if (turnError) {
      const quotaExhausted = /Cota mensal/i.test(turnError.message);
      return jsonResponse(
        { error: turnError.message, code: quotaExhausted ? 'quota_exhausted' : 'forbidden' },
        quotaExhausted ? 429 : 403,
        headers,
      );
    }

    const activeConversationId = (turn as { conversation_id: string }).conversation_id;

    try {
      const [snapshot, historyResult, accessResult] = await Promise.all([
        buildStoreSnapshot(supabase),
        supabase.from('ai_assistant_messages')
          .select('role,content')
          .eq('conversation_id', activeConversationId)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
        supabase.rpc('get_miar_assistant_access'),
      ]);

      const canPropose = Boolean((accessResult.data as { plan_allows_actions?: boolean })?.plan_allows_actions);
      const history = ((historyResult.data ?? []) as Array<{ role: string; content: string }>)
        .filter((row) => row.role === 'user' || row.role === 'assistant')
        .reverse();

      const conversation: ChatMessage[] = [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n${
            canPropose
              ? 'Este plano permite propor alterações. Use as ferramentas quando o gestor pedir uma mudança.'
              : 'Este plano NÃO permite que você altere dados. Se pedirem uma alteração, explique o que fazer manualmente e que a execução automática exige o plano Intermediário ou Premium.'
          }\n\n=== RETRATO DA OPERAÇÃO (gerado em ${snapshot.generatedAt}) ===\n${snapshot.text}`,
        },
        ...history.map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content })),
      ];

      const toolTrace: Array<Record<string, unknown>> = [];
      const proposedActions: Array<{ tool_name: string; arguments: Record<string, unknown>; summary: string }> = [];
      let reply = await callModel(conversation, true);

      // Ferramentas de leitura resolvem na hora e realimentam o modelo.
      // Ferramentas de escrita saem do loop e viram proposta pendente.
      for (let round = 0; round < MAX_TOOL_ROUNDS && reply.toolCalls.length > 0; round += 1) {
        const readCalls = reply.toolCalls.filter((call) => readOnlyToolNames.has(call.name));
        const writeCalls = reply.toolCalls.filter((call) => mutatingToolNames.has(call.name));

        for (const call of writeCalls) {
          proposedActions.push({
            tool_name: call.name,
            arguments: call.arguments,
            summary: describeAction(call.name, call.arguments),
          });
        }

        if (!readCalls.length) break;

        conversation.push({
          role: 'assistant',
          content: reply.content,
          tool_calls: readCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        });

        for (const call of readCalls) {
          const output = await runReadTool(supabase, call.name, call.arguments);
          toolTrace.push({ tool: call.name, arguments: call.arguments, output });
          conversation.push({ role: 'tool', tool_call_id: call.id, content: output });
        }

        reply = await callModel(conversation, true);
      }

      let content = reply.content?.trim() ?? '';
      if (!content && proposedActions.length) {
        content = `Preparei ${proposedActions.length === 1 ? 'esta alteração' : 'estas alterações'} para você confirmar:`;
      }
      if (!content) {
        content = 'Não consegui formular uma resposta com os dados atuais. Pode reformular a pergunta?';
      }

      const { data: recorded, error: recordError } = await supabase.rpc('record_miar_assistant_reply', {
        p_conversation_id: activeConversationId,
        p_content: content,
        p_provider: reply.provider,
        p_tool_trace: toolTrace,
        p_actions: proposedActions,
      });
      if (recordError) throw new Error(recordError.message);

      return jsonResponse(
        {
          conversation_id: activeConversationId,
          reply: content,
          provider: reply.provider,
          actions: (recorded as { actions?: unknown[] })?.actions ?? [],
          messages_remaining: (turn as { messages_remaining: number }).messages_remaining,
        },
        200,
        headers,
      );
    } catch (modelError) {
      // Nenhum provedor respondeu: devolve a mensagem à cota para o usuário
      // não pagar por uma falha nossa.
      await supabase.rpc('refund_miar_assistant_message');
      console.error('[miar-assistant] falha nos provedores:', modelError);
      return jsonResponse(
        { error: 'A MIAR está indisponível no momento. Tente de novo em instantes.', code: 'provider_unavailable' },
        503,
        headers,
      );
    }
  } catch (error) {
    console.error('[miar-assistant] erro inesperado:', error);
    return jsonResponse({ error: 'Erro interno.' }, 500, headers);
  }
});
