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

    return `Você é o Consultor Especialista e Comercial oficial do HappyCash ERP. Você é um profissional com vasto conhecimento em gestão empresarial, vendas, controle financeiro, controle de estoque e atendimento ao cliente.
Seu objetivo é ajudar lojistas, comerciantes e empreendedores a melhorarem a gestão de seus negócios através do sistema HappyCash.
Responda sempre em Português do Brasil de forma empática, persuasiva, vendedora e humana. Não pareça um robô. Pareça um consultor prestativo querendo entender a dor do cliente para sugerir a melhor solução do sistema.

## Informações do HappyCash
- Nome: ${personal.name}
- Slogan: ${personal.subtitle}
- Sobre o HappyCash: Um ERP e PDV moderno e fácil de usar. O HappyCash transforma a gestão comercial, acabando com a perda de tempo e dinheiro. Com interface intuitiva e design responsivo (Mobile e Desktop), o cliente faz gestão profissional sem precisar de treinamentos complexos.
- Diferenciais Fortes: Caderneta de Fiado Digital com cobrança via WhatsApp, PDV que não trava, relatórios diretos, tecnologia ultra rápida, zero taxa de manutenção surpresa.
- Contato Suporte / WhatsApp: ${personal.phone} (Pode sugerir que o cliente chame no WhatsApp caso a conversa avance para uma demonstração).
- Email: ${personal.email}

## Módulos e Recursos Técnicos do Sistema:
${projectList}

## Instruções e Regras de Conversação (CRÍTICO):
1. **Seja Consultivo:** Não liste apenas recursos técnicos. Explique o *benefício* (ex: Em vez de falar "tem controle de estoque", fale "Com o controle de estoque, você nunca mais vai perder vendas por falta de mercadoria e saberá exatamente onde seu dinheiro está parado").
2. **Faça Perguntas:** Sempre tente engajar o usuário. Se ele perguntar sobre o PDV, explique e devolva: "Você tem muito fluxo no caixa hoje em dia?".
3. **Preços e Planos:** Diga que os planos são extremamente acessíveis e flexíveis para cada tamanho de loja. Oriente o cliente a clicar no botão "Planos" no menu ou chamar no WhatsApp (12) 98891-8792 para um orçamento personalizado.
4. **Respostas Médias:** Seja claro e conciso. Não mande "textões" imensos, divida em tópicos se necessário. Use emojis com moderação para dar tom humano.
5. **Contexto Exclusivo (REGRA DE OURO):** Você SÓ trabalha e fala sobre o HappyCash ERP, Gestão de Varejo, Vendas, Empreendedorismo, etc. Se perguntarem sobre política, código, receitas de bolo ou coisas nada a ver, negue educadamente dizendo que sua especialidade é ajudar a empresa do usuário a lucrar mais com o HappyCash. Nunca fuja desse personagem.`;
}

function getLocalHappyCashReply(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    if (query.includes("pdv") || query.includes("venda") || query.includes("caixa")) {
        return "O **PDV HappyCash** é nossa frente de caixa super ágil! Imagine registrar vendas em segundos e emitir comprovantes sem aquele sistema travando e cheio de telas confusas. Ele é intuitivo e pronto pra alto fluxo. Como está sendo sua experiência no caixa da loja hoje?";
    }
    if (query.includes("estoque") || query.includes("produto") || query.includes("cadastrar")) {
        return "Com o nosso **Controle de Estoque**, você nunca mais perde vendas por falta de mercadoria na prateleira! O sistema te avisa quando um item está acabando e desconta sozinho a cada venda. Chega de pranchetas, né? Quantos produtos em média você tem na loja?";
    }
    if (query.includes("fiado") || query.includes("caderneta") || query.includes("cobrança") || query.includes("inadimplência")) {
        return "A **Caderneta Fiado Digital** é o terror dos caloteiros! 😂 Ela automatiza a cobrança pra você: o cliente compra pendurado e você manda a cobrança direto no WhatsApp dele com um clique, já com o saldo atualizado. Muito melhor que anotar no caderninho e perder dinheiro!";
    }
    if (query.includes("nota fiscal") || query.includes("nfc-e") || query.includes("fiscal") || query.includes("sat")) {
        return "Nosso sistema foi feito para tirar a burocracia do seu caminho! A emissão de **Notas Fiscais (NFC-e/NF-e)** e integração fiscal é super simples. Apenas alguns cliques e o documento vai pro cliente. Você sofre muito com burocracia na hora de emitir nota hoje?";
    }
    if (query.includes("plano") || query.includes("preço") || query.includes("valor") || query.includes("demonstração")) {
        return "O **HappyCash** tem um custo-benefício incrível! Oferecemos planos flexíveis que crescem junto com a sua loja, sem aquelas taxas surpresas abusivas. Quer conferir? Clique em **Planos** no menu lá em cima, ou chame nosso suporte no WhatsApp (12) 98891-8792 para montar o pacote ideal pra você!";
    }
    if (query.includes("relatorio") || query.includes("financeiro") || query.includes("dre") || query.includes("lucro")) {
        return "Saber exatamente onde seu dinheiro está! Nosso **Financeiro** gera relatórios inteligentes, DRE e gráficos que mostram os produtos que dão mais lucro, de forma fácil de ler (nada daquelas planilhas feias!). Que indicador você acha mais difícil acompanhar hoje?";
    }
    if (query.includes("suporte") || query.includes("ajuda") || query.includes("dúvida")) {
        return "Nosso **Suporte** é de outro mundo! 🚀 Nada de robôs te enrolando. Nossa equipe fica no WhatsApp (12) 98891-8792 para te ajudar a configurar e tirar dúvidas. Você pode ir na seção **Central de Ajuda** também!";
    }
    return "O **HappyCash ERP** é a solução completa que a sua gestão precisava: PDV rápido, Estoque perfeito, Financeiro que dá gosto de ver e Cobrança automatizada de Fiados. Como posso te ajudar a acabar com as dores de cabeça na administração da sua empresa?";
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

// ─── Groq API call ───────────────────────────────────────────────────────────
async function callGroq(messages: Message[], systemPrompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
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
        throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from Groq');
    return content;
}

// ─── Gemini API call ─────────────────────────────────────────────────────────
async function callGemini(messages: Message[], systemPrompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    // Convert messages to Gemini format
    const geminiContents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error('Empty response from Gemini');
    return content;
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

        let reply: string;
        let provider: string;

        // Try Groq first, then fallback to Gemini, and finally to local HappyCash fallback
        try {
            reply = await callGroq(messages, systemPrompt);
            provider = 'groq';
        } catch (groqError) {
            console.warn('[Chat] Groq failed, falling back to Gemini:', groqError);
            try {
                reply = await callGemini(messages, systemPrompt);
                provider = 'gemini';
            } catch (geminiError) {
                console.warn('[Chat] Gemini also failed, using local HappyCash fallback');
                const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
                reply = getLocalHappyCashReply(lastUserMessage);
                provider = 'local-fallback';
            }
        }

        return NextResponse.json({ reply, provider });
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
    const hasGroq = !!process.env.GROQ_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;
    return NextResponse.json({
        status: 'ok',
        providers: { groq: hasGroq, gemini: hasGemini },
    });
}
