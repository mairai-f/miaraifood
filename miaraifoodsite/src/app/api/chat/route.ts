import { NextRequest, NextResponse } from 'next/server';
import { portfolioData } from '@/data/portfolio';

// ─── Build system prompt from portfolio data ─────────────────────────────────
function buildSystemPrompt(locale: string = 'pt'): string {
    const { personal, projects } = portfolioData as any;

    const projectList = (projects ?? [])
        .map((p: any) =>
            `- Módulo ${p.title}: ${p.description}. Recursos principais: ${(p.techStack ?? []).join(', ')}.`
        )
        .join('\n');

    return `Você é o Consultor Especialista e Comercial oficial do MIAR AI/FOOD. Você é um profissional com vasto conhecimento em gestão de restaurantes, bares, lanchonetes, food service, atendimento ao cliente, caixa, cozinha KDS, estoque e IA.
Seu objetivo é ajudar donos e gestores de estabelecimentos gastronômicos a integrarem toda a operação (da mesa à entrega) com o ecossistema MIAR AI/FOOD.
Responda sempre em Português do Brasil de forma empática, persuasiva, vendedora e humana. Não pareça um robô. Pareça um consultor prestativo querendo entender a dor do cliente para sugerir a melhor solução do sistema.

## Informações do MIAR AI/FOOD
- Slogan: Da mesa à entrega, toda a operação conectada.
- Sobre o MIAR AI/FOOD: Um ecossistema completo para restaurantes e food service. O MIAR AI/FOOD conecta PDV de caixa, comanda em mesa/garçom, cardápio QR Code, cozinha KDS, estoque, delivery, financeiro e Inteligência Artificial.
- Diferenciais Fortes: Integração total da mesa até a cozinha, KDS em tempo real, autoatendimento QR Code, controle de estoque com ficha técnica/CMV, inteligência artificial integrada e alta velocidade.
- Contato Suporte / WhatsApp: (12) 98891-8792 (Pode sugerir que o cliente chame no WhatsApp caso a conversa avance para uma demonstração).

## Módulos e Recursos Técnicos do Sistema:
${projectList}

## Instruções e Regras de Conversação (CRÍTICO):
1. **Seja Consultivo:** Não liste apenas recursos técnicos. Explique o *benefício* (ex: Em vez de falar "tem KDS na cozinha", fale "Com o KDS na cozinha, os pedidos caem direto na tela do cozinheiro sem papelada, zerando atrasos e erros de prato").
2. **Faça Perguntas:** Sempre tente engajar o usuário. Se ele perguntar sobre o PDV ou mesas, explique e devolva: "Como funciona a entrada de pedidos no seu restaurante hoje?".
3. **Preços e Planos:** Diga que os planos são extremamente acessíveis e flexíveis. Oriente o cliente a clicar no botão "Planos" no menu ou chamar no WhatsApp (12) 98891-8792 para um orçamento personalizado.
4. **Respostas Médias:** Seja claro e conciso. Não mande "textões" imensos, divida em tópicos se necessário. Use emojis com moderação para dar tom humano.
5. **Contexto Exclusivo (REGRA DE OURO):** Você SÓ trabalha e fala sobre o MIAR AI/FOOD, Gastronomia, Restaurantes, Food Service, Vendas, etc. Se perguntarem sobre política, código, receitas de bolo ou coisas nada a ver, negue educadamente dizendo que sua especialidade é ajudar o restaurante do usuário a lucrar mais com o MIAR AI/FOOD. Nunca fuja desse personagem.`;
}

function getLocalMiarFoodReply(userQuery: string): string {
    const query = userQuery.toLowerCase();

    if (query.includes("pdv") || query.includes("venda") || query.includes("caixa")) {
        return "O **PDV MIAR AI/FOOD** é nossa frente de caixa ultra ágil! Registre vendas, feche mesas, divida contas e emita notas fiscais em segundos. Como é a operação do seu caixa hoje?";
    }
    if (query.includes("mesa") || query.includes("garçom") || query.includes("comanda") || query.includes("qr")) {
        return "Com as **Comandas & QR Menu**, os pedidos feitos na mesa pelo garçom ou pelo smartphone do cliente vão direto para a cozinha e para o caixa sem nenhum ruído!";
    }
    if (query.includes("cozinha") || query.includes("kds") || query.includes("preparo")) {
        return "O **KDS de Cozinha** substitui papeis rasgados por monitores digitais organizados por estação de preparo. O cozinheiro sabe exatamente o tempo de cada prato!";
    }
    if (query.includes("estoque") || query.includes("cmv") || query.includes("ingrediente")) {
        return "Com nosso **Estoque & Ficha Técnica**, cada prato vendido dá baixa exata nos ingredientes, calculando seu CMV e prevenindo desperdícios!";
    }
    if (query.includes("plano") || query.includes("preço") || query.includes("valor") || query.includes("demonstração")) {
        return "O **MIAR AI/FOOD** possui o melhor custo-benefício para restaurantes! Clique em **Planos** no menu acima ou fale no WhatsApp (12) 98891-8792 para agendar uma demonstração personalizada!";
    }
    return "O **MIAR AI/FOOD** é o ecossistema completo para o seu restaurante: PDV, Mesas, QR Menu, KDS de Cozinha, Estoque/CMV e IA. Como posso te ajudar a transformar sua gestão hoje?";
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatRequest {
    messages: Message[];
    locale?: string;
}

// ─── Models ──────────────────────────────────────────────────────────────────
// Overridable by env because provider catalogs change faster than this code
// (Groq retired the Llama models, Google retired Gemini 1.5).
const GROQ_MODEL = process.env.MIAR_AI_GROQ_MODEL || 'openai/gpt-oss-20b';
const GEMINI_MODEL = process.env.MIAR_AI_GEMINI_MODEL || 'gemini-flash-latest';
const MISTRAL_MODEL = process.env.MIAR_AI_MISTRAL_MODEL || 'mistral-small-latest';
const OPENROUTER_MODEL = process.env.MIAR_AI_OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';

// ─── API key pool ────────────────────────────────────────────────────────────
// Each provider accepts numbered keys (GROQ_API_KEY_1, GROQ_API_KEY_2, ...) used
// in rotation; the unnumbered name still works and is tried last.
const MAX_KEYS_PER_PROVIDER = 50;
// Caps attempts per provider so a batch of exhausted keys doesn't stall the reply.
const MAX_KEY_ATTEMPTS = 4;
// Invalid, blocked or rate-limited key: another key of the same provider may work.
const RETRY_WITH_NEXT_KEY = new Set([401, 402, 403, 429]);

class ProviderHttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

function apiKeys(keyName: string): string[] {
    const names = [...Array.from({ length: MAX_KEYS_PER_PROVIDER }, (_, i) => `${keyName}_${i + 1}`), keyName];
    const values = names
        .map((name) => process.env[name]?.trim())
        .filter((value): value is string => Boolean(value));
    return [...new Set(values)];
}

const nextKeyIndex = new Map<string, number>();

async function withKeyPool<T>(keyName: string, run: (apiKey: string) => Promise<T>): Promise<T> {
    const keys = apiKeys(keyName);
    if (!keys.length) throw new Error(`${keyName} not configured`);

    const start = (nextKeyIndex.get(keyName) ?? 0) % keys.length;
    nextKeyIndex.set(keyName, (start + 1) % keys.length);

    let lastError: unknown;
    for (let offset = 0; offset < Math.min(keys.length, MAX_KEY_ATTEMPTS); offset++) {
        const slot = (start + offset) % keys.length;
        try {
            return await run(keys[slot]);
        } catch (error) {
            lastError = error;
            if (!(error instanceof ProviderHttpError) || !RETRY_WITH_NEXT_KEY.has(error.status)) throw error;
            console.warn(`[Chat] ${keyName} #${slot + 1} rejected (${error.status}), trying another key`);
        }
    }
    throw lastError;
}

// ─── OpenAI-compatible call (Groq, Mistral, OpenRouter) ──────────────────────
async function callOpenAiCompatible(
    keyName: string,
    endpoint: string,
    model: string,
    messages: Message[],
    systemPrompt: string
): Promise<string> {
    return withKeyPool(keyName, async (apiKey) => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                max_tokens: 1024,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new ProviderHttpError(response.status, `${keyName} API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error(`Empty response for ${keyName}`);
        return content;
    });
}

// ─── Gemini API call ─────────────────────────────────────────────────────────
async function callGemini(messages: Message[], systemPrompt: string): Promise<string> {
    // Convert messages to Gemini format
    const geminiContents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    return withKeyPool('GEMINI_API_KEY', async (apiKey) => {
        // Key goes in a header, not the URL, so it never lands in error logs.
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: geminiContents,
                    generationConfig: {
                        maxOutputTokens: 1024,
                        temperature: 0.7,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            throw new ProviderHttpError(response.status, `Gemini API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const content = (data?.candidates?.[0]?.content?.parts ?? [])
            .map((part: { text?: string }) => part.text ?? '')
            .join('');
        if (!content) throw new Error('Empty response from Gemini');
        return content;
    });
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body: ChatRequest = await req.json();

        if (!body?.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return NextResponse.json(
                { error: 'Invalid request: messages array is required.' },
                { status: 400 }
            );
        }

        // Validate each message
        for (const msg of body.messages) {
            if (!msg.role || !msg.content || typeof msg.content !== 'string') {
                return NextResponse.json(
                    { error: 'Invalid message format.' },
                    { status: 400 }
                );
            }
            if (!['user', 'assistant'].includes(msg.role)) {
                return NextResponse.json(
                    { error: 'Invalid message role.' },
                    { status: 400 }
                );
            }
        }

        // Limit to last 20 messages to avoid token overflow
        const messages = body.messages.slice(-20);
        const systemPrompt = buildSystemPrompt(body.locale);

        // Groq → Gemini → Mistral → OpenRouter, and finally the local MIAR AI/FOOD fallback
        const providers: Array<[string, () => Promise<string>]> = [
            ['groq', () => callOpenAiCompatible('GROQ_API_KEY', 'https://api.groq.com/openai/v1/chat/completions', GROQ_MODEL, messages, systemPrompt)],
            ['gemini', () => callGemini(messages, systemPrompt)],
            ['mistral', () => callOpenAiCompatible('MISTRAL_API_KEY', 'https://api.mistral.ai/v1/chat/completions', MISTRAL_MODEL, messages, systemPrompt)],
            ['openrouter', () => callOpenAiCompatible('OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1/chat/completions', OPENROUTER_MODEL, messages, systemPrompt)],
        ];

        for (const [provider, call] of providers) {
            try {
                const reply = await call();
                return NextResponse.json({ reply, provider });
            } catch (error) {
                console.warn(`[Chat] ${provider} failed:`, error instanceof Error ? error.message : error);
            }
        }

        console.warn('[Chat] All providers failed, using local MIAR AI/FOOD fallback');
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
        return NextResponse.json({ reply: getLocalMiarFoodReply(lastUserMessage), provider: 'local-fallback' });
    } catch (error) {
        console.error('[Chat] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Internal server error.' },
            { status: 500 }
        );
    }
}

// ─── GET health check ─────────────────────────────────────────────────────────
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        providers: {
            groq: apiKeys('GROQ_API_KEY').length > 0,
            gemini: apiKeys('GEMINI_API_KEY').length > 0,
            mistral: apiKeys('MISTRAL_API_KEY').length > 0,
            openrouter: apiKeys('OPENROUTER_API_KEY').length > 0,
        },
    });
}
