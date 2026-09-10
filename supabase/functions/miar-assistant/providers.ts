import { toolDefinitions } from './tools.ts';

// Mesmos nomes de segredo já usados pelo chat do site, para você configurar a
// chave uma vez só. Os modelos são trocáveis por variável de ambiente porque
// catálogo de modelo muda mais rápido que o código.
const GROQ_MODEL = Deno.env.get('MIAR_AI_GROQ_MODEL') || 'llama-3.3-70b-versatile';
const GEMINI_MODEL = Deno.env.get('MIAR_AI_GEMINI_MODEL') || 'gemini-1.5-flash';

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

const parseArguments = (raw: unknown): Record<string, unknown> => {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const openAiTools = toolDefinitions.map((tool) => ({
  type: 'function' as const,
  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
}));

async function callGroq(messages: ChatMessage[], allowTools: boolean): Promise<ProviderReply> {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      ...(allowTools ? { tools: openAiTools, tool_choice: 'auto' } : {}),
      max_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const choice = data?.choices?.[0]?.message;
  if (!choice) throw new Error('Resposta vazia do Groq');

  return {
    content: choice.content ?? '',
    provider: 'groq',
    toolCalls: (choice.tool_calls ?? []).map((call: { id: string; function: { name: string; arguments: string } }) => ({
      id: call.id,
      name: call.function.name,
      arguments: parseArguments(call.function.arguments),
    })),
  };
}

async function callGemini(messages: ChatMessage[], allowTools: boolean): Promise<ProviderReply> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content || '(sem texto)' }],
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(allowTools
          ? {
              tools: [{
                functionDeclarations: toolDefinitions.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                })),
              }],
            }
          : {}),
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
    },
  );

  if (!response.ok) throw new Error(`Gemini ${response.status}: ${await response.text()}`);
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
}

/** Groq primeiro, Gemini como reserva — mesma ordem do chat do site. */
export async function callModel(messages: ChatMessage[], allowTools: boolean): Promise<ProviderReply> {
  try {
    return await callGroq(messages, allowTools);
  } catch (groqError) {
    console.warn('[miar-assistant] Groq falhou, tentando Gemini:', groqError);
    return await callGemini(messages, allowTools);
  }
}

export const configuredProviders = () => ({
  groq: Boolean(Deno.env.get('GROQ_API_KEY')),
  gemini: Boolean(Deno.env.get('GEMINI_API_KEY')),
});
