import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';
import { imageProvidersConfigured } from './images.ts';
import { buildStoreSnapshot, invalidateStoreSnapshot } from './storeContext.ts';
import { callModel, configuredProviders, type ChatMessage } from './providers.ts';
import { describeAction, mutatingToolNames, readOnlyToolNames, runConfirmedAction, runReadTool } from './tools.ts';

const MAX_TOOL_ROUNDS = 3;
const HISTORY_LIMIT = 20;

const SYSTEM_PROMPT = `Você é a MIAR Gestora IA, a assistente de gestão exclusiva DESTE estabelecimento dentro do ERP MIAR AI/FOOD.

Você fala com o dono ou gestor sobre a operação real da loja dele: faturamento, custos, margem, estoque, compras, perdas, demanda, equipe, promoções e marketing.

O QUE VOCÊ PODE FAZER, sempre como sugestão que uma pessoa confirma na tela:
- cadastrar produto (criar_produto) e mudar preço (alterar_preco);
- lançar entrada, saída ou perda de estoque (ajustar_estoque);
- abrir pedido de compra para fornecedor (criar_pedido_compra);
- registrar venda de balcão já paga em dinheiro, Pix, crédito ou débito (registrar_venda): baixa o estoque e entra no caixa aberto de quem confirmar;
- criar promoção (criar_promocao): promoções ativas aparecem nas TVs do salão (Configurações > TV), mas o preço do PDV não muda sozinho;
- gerar foto ilustrativa de produto (gerar_foto_produto).

O QUE VOCÊ NÃO FAZ: fechar mesa ou comanda, vender fiado, cancelar venda, emitir nota fiscal, lançar no financeiro, mexer em usuários ou permissões. Nesses casos, explique onde fazer no sistema.

REGRAS:
1. Responda SEMPRE em Português do Brasil, direto e prático, como um consultor de restaurante que olhou os números.
2. Use os dados do "RETRATO DA OPERAÇÃO" abaixo. Cite números concretos (valores em reais, quantidades, percentuais). Nunca invente número: se o dado não estiver no retrato nem vier de uma ferramenta, diga que não há registro suficiente.
3. Toda recomendação vem com o motivo e, quando fizer sentido, com o valor esperado. Prefira "suba a Coca 2L de R$ 10 para R$ 11,50 porque a margem está em 12%, abaixo dos 30% do resto da bebida" a conselhos genéricos.
4. Para ALTERAR qualquer coisa você DEVE chamar a ferramenta correspondente. A alteração não acontece na hora: ela vira uma sugestão que a pessoa confirma na tela. Explique o que vai mudar e peça a confirmação.
5. Antes de propor cadastrar produto, registrar venda, criar promoção ou gerar foto, use buscar_produto para usar o nome exato do cadastro e não duplicar.
6. Para registrar venda, a forma de pagamento é obrigatória: se não foi dita, pergunte antes de propor.
7. Você enxerga apenas este estabelecimento. Nunca compare com outras empresas nem cite dados que não sejam desta loja.
8. Seja conciso. Use tópicos curtos. Nada de textão.`;

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
    namespace: 'miar-assistant',
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
      return jsonResponse(
        { ...data, providers: { ...configuredProviders(), images: imageProvidersConfigured() } },
        200,
        headers,
      );
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
          supabase, decided.owner_user_id, userData.user.id, decided.tool_name, decided.arguments,
        );
        await supabase.rpc('complete_miar_assistant_action', { p_action_id: actionId, p_result: result });
        // Os dados mudaram: a próxima pergunta precisa de um retrato novo.
        await invalidateStoreSnapshot(userData.user.id);
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
        buildStoreSnapshot(supabase, userData.user.id),
        supabase.from('ai_assistant_messages')
          .select('role,content')
          .eq('conversation_id', activeConversationId)
          .order('created_at', { ascending: false })
          .limit(HISTORY_LIMIT),
        supabase.rpc('get_miar_assistant_access'),
      ]);

      const access = (accessResult.data ?? {}) as { plan_allows_actions?: boolean; user_can_execute?: boolean };
      const canPropose = Boolean(access.plan_allows_actions && access.user_can_execute);
      // Sem direito a aplicar, o modelo recebe só as ferramentas de leitura:
      // assim ele não oferece uma alteração que ninguém vai conseguir confirmar.
      const toolSelection = canPropose ? null : readOnlyToolNames;
      const history = ((historyResult.data ?? []) as Array<{ role: string; content: string }>)
        .filter((row) => row.role === 'user' || row.role === 'assistant')
        .reverse();

      const capabilityNotes = [
        canPropose
          ? 'Este usuário pode confirmar alterações. Use as ferramentas quando o gestor pedir uma mudança.'
          : !access.plan_allows_actions
            ? 'O plano atual NÃO permite que você altere dados. Se pedirem uma alteração, explique como fazer manualmente no sistema e que a execução pela MIAR é liberada nos planos Intermediário e Premium.'
            : 'Este usuário NÃO tem permissão para confirmar alterações da MIAR. Se pedirem uma alteração, explique como fazer manualmente e que um administrador pode liberar a permissão.',
        imageProvidersConfigured()
          ? ''
          : 'A geração de fotos (gerar_foto_produto) ainda NÃO está ativada neste sistema: não proponha; diga que o administrador precisa ativar e que dá para enviar uma foto do produto manualmente.',
      ].filter(Boolean).join('\n');

      const conversation: ChatMessage[] = [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\n${capabilityNotes}\n\n=== RETRATO DA OPERAÇÃO (gerado em ${snapshot.generatedAt}) ===\n${snapshot.text}`,
        },
        ...history.map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content })),
      ];

      const toolTrace: Array<Record<string, unknown>> = [];
      const proposedActions: Array<{ tool_name: string; arguments: Record<string, unknown>; summary: string }> = [];
      let reply = await callModel(conversation, toolSelection);

      // Ferramentas de leitura resolvem na hora e realimentam o modelo.
      // Ferramentas de escrita saem do loop e viram proposta pendente.
      for (let round = 0; round < MAX_TOOL_ROUNDS && reply.toolCalls.length > 0; round += 1) {
        const readCalls = reply.toolCalls.filter((call) => readOnlyToolNames.has(call.name));
        const writeCalls = canPropose ? reply.toolCalls.filter((call) => mutatingToolNames.has(call.name)) : [];

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

        reply = await callModel(conversation, toolSelection);
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
