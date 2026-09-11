// Várias chaves por provedor: GROQ_API_KEY_1, GROQ_API_KEY_2, ... e, por
// compatibilidade, GROQ_API_KEY sem número (usada por último). Módulo próprio
// porque a conversa (providers.ts) e a geração de imagem (images.ts) usam o
// mesmo revezamento.

const MAX_KEYS_PER_PROVIDER = 50;
// Limita quantas chaves um provedor tenta por chamada, para não segurar a
// resposta quando várias estão sem cota; aí o próximo provedor assume.
const MAX_KEY_ATTEMPTS = 4;
// Chave inválida, bloqueada ou sem cota: vale tentar outra do mesmo provedor.
// Os demais erros (ex.: 400 por pedido malformado) se repetiriam em qualquer chave.
const RETRY_WITH_NEXT_KEY = new Set([401, 402, 403, 429]);

// Alguns provedores repetem a chave na mensagem de erro (o Google faz isso em
// chave suspensa). O texto do erro vai para o log, então a chave sai mascarada.
const SECRET_PATTERN = /(gsk_[A-Za-z0-9]{20,}|sk-or-v1-[A-Za-z0-9]{20,}|AQ\.[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{20,})/g;
export const redactSecrets = (text: string) => text.replace(SECRET_PATTERN, '[chave oculta]');

export class ProviderHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function apiKeys(keyName: string): string[] {
  const names = [...Array.from({ length: MAX_KEYS_PER_PROVIDER }, (_, index) => `${keyName}_${index + 1}`), keyName];
  const values = names
    .map((name) => Deno.env.get(name)?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

// Revezamento por instância: cada chamada começa na chave seguinte, espalhando o uso.
const nextKeyIndex = new Map<string, number>();

export async function withKeyPool<T>(keyName: string, provider: string, run: (apiKey: string) => Promise<T>): Promise<T> {
  const keys = apiKeys(keyName);
  if (!keys.length) throw new Error(`${keyName} não configurada`);

  const start = (nextKeyIndex.get(keyName) ?? 0) % keys.length;
  nextKeyIndex.set(keyName, (start + 1) % keys.length);

  let lastError: unknown;
  for (let offset = 0; offset < Math.min(keys.length, MAX_KEY_ATTEMPTS); offset += 1) {
    const slot = (start + offset) % keys.length;
    try {
      return await run(keys[slot]);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ProviderHttpError) || !RETRY_WITH_NEXT_KEY.has(error.status)) throw error;
      console.warn(`[miar-assistant] ${provider}: chave #${slot + 1} recusada (${error.status}), tentando outra`);
    }
  }
  throw lastError;
}
