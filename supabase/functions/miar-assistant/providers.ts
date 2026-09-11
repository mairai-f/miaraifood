import { apiKeys, ProviderHttpError, redactSecrets, withKeyPool } from './keyPool.ts';
import { toolDefinitions } from './tools.ts';

// Os modelos são trocáveis por variável de ambiente porque o catálogo dos
// provedores muda mais rápido que o código (a Groq tirou os Llama do ar e o
// Google aposentou o Gemini 1.5). Os padrões abaixo foram testados com ferramentas.
const GROQ_MODEL = Deno.env.get('MIAR_AI_GROQ_MODEL') || 'openai/gpt-oss-120b';
const GEMINI_MODEL = Deno.env.get('MIAR_AI_GEMINI_MODEL') || 'gemini-flash-latest';
const MISTRAL_MODEL = Deno.env.get('MIAR_AI_MISTRAL_MODEL') || 'mistral-small-latest';
const OPENROUTER_MODEL = Deno.env.get('MIAR_AI_OPENROUTER_MODEL') || 'nvidia/nemotron-3-super-120b-a12b:free';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

export interface ProviderReply {
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  provider: string;
}

/**
 * Ferramentas oferecidas ao modelo nesta chamada. Sem lista, vão todas; com
 * lista, só as permitidas (ex.: plano que só analisa recebe apenas leitura,
 * então o modelo nem tem como propor alteração).
 */
export type ToolSelection = ReadonlySet<string> | null;

const selectTools = (selection: ToolSelection) =>
  selection ? toolDefinitions.filter((tool) => selection.has(tool.name)) : toolDefinitions;

const parseArguments = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

interface OpenAiCompatibleOptions {
  keyName: string;
  endpoint: string;
  model: string;
  provider: string;
  messages: ChatMessage[];
  tools: ToolSelection;
}

async function callOpenAiCompatible(options: OpenAiCompatibleOptions): Promise<ProviderReply> {
  const { keyName, endpoint, model, provider, messages, tools } = options;
  const openAiTools = selectTools(tools).map((tool) => ({
    type: 'function' as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));

  return withKeyPool(keyName, provider, async (apiKey) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        ...(openAiTools.length ? { tools: openAiTools, tool_choice: 'auto' } : {}),
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new ProviderHttpError(response.status, `${provider} ${response.status}: ${redactSecrets(await response.text())}`);
    }
    const data = await response.json();
    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new Error(`Resposta vazia do ${provider}`);

    return {
      content: choice.content ?? '',
      provider,
      toolCalls: (choice.tool_calls ?? []).map((call: { id: string; function: { name: string; arguments: string } }) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseArguments(call.function.arguments),
      })),
    };
  });
}

const callGroq = (messages: ChatMessage[], tools: ToolSelection) => callOpenAiCompatible({
  keyName: 'GROQ_API_KEY',
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: GROQ_MODEL,
  provider: 'groq',
  messages,
  tools,
});

const callMistral = (messages: ChatMessage[], tools: ToolSelection) => callOpenAiCompatible({
  keyName: 'MISTRAL_API_KEY',
  endpoint: 'https://api.mistral.ai/v1/chat/completions',
  model: MISTRAL_MODEL,
  provider: 'mistral',
  messages,
  tools,
});

const callOpenRouter = (messages: ChatMessage[], tools: ToolSelection) => callOpenAiCompatible({
  keyName: 'OPENROUTER_API_KEY',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  model: OPENROUTER_MODEL,
  provider: 'openrouter',
  messages,
  tools,
});

async function callGemini(messages: ChatMessage[], tools: ToolSelection): Promise<ProviderReply> {
  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content || '(sem texto)' }],
    }));
  const functionDeclarations = selectTools(tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return withKeyPool('GEMINI_API_KEY', 'gemini', async (apiKey) => {
    // Chave no cabeçalho, não na URL, para não vazar em log de erro.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
      },
    );

    if (!response.ok) {
      throw new ProviderHttpError(response.status, `Gemini ${response.status}: ${redactSecrets(await response.text())}`);
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];

    const toolCalls = parts
      .filter((part: Record<string, unknown>) => part.functionCall)
      .map((part: { functionCall: { name: string; args: Record<string, unknown> } }, index: number) => ({
        id: `gemini-${index}`,
        name: part.functionCall.name,
        arguments: parseArguments(part.functionCall.args),
      }));

    const content = parts
      .filter((part: Record<string, unknown>) => typeof part.text === 'string')
      .map((part: { text: string }) => part.text)
      .join('\n');

    if (!content && !toolCalls.length) throw new Error('Resposta vazia do Gemini');
    return { content, provider: 'gemini', toolCalls };
  });
}

/** Usa provedores configurados em sequência, para que uma indisponibilidade não derrube a IA. */
export async function callModel(messages: ChatMessage[], tools: ToolSelection = null): Promise<ProviderReply> {
  const errors: string[] = [];
  const attempts: Array<[string, () => Promise<ProviderReply>]> = [
    ['Groq', () => callGroq(messages, tools)],
    ['Gemini', () => callGemini(messages, tools)],
    ['Mistral', () => callMistral(messages, tools)],
    ['OpenRouter', () => callOpenRouter(messages, tools)],
  ];

  for (const [name, attempt] of attempts) {
    try {
      return await attempt();
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Nenhum provedor de IA respondeu. ${errors.join(' | ')}`);
}

export const configuredProviders = () => ({
  groq: apiKeys('GROQ_API_KEY').length > 0,
  gemini: apiKeys('GEMINI_API_KEY').length > 0,
  mistral: apiKeys('MISTRAL_API_KEY').length > 0,
  openrouter: apiKeys('OPENROUTER_API_KEY').length > 0,
});
