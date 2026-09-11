import { apiKeys, ProviderHttpError, redactSecrets, withKeyPool } from './keyPool.ts';

// Geração de foto ilustrativa de produto.
//
// Modelo de imagem não tem cota gratuita no Gemini (as chaves gratuitas
// respondem 429 "exceeded your current quota"), então cada provedor só entra
// se estiver explicitamente configurado:
// - Cloudflare Workers AI (flux-1-schnell), com cota diária gratuita:
//   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_API_TOKEN;
// - Gemini com faturamento ativo: MIAR_AI_GEMINI_IMAGE_MODEL (usa as GEMINI_API_KEY_*).
// Cloudflare vem primeiro porque devolve JPEG de ~150 KB; o Gemini devolve PNG
// bem maior, o que pesa no upload e no tráfego de quem abre o cardápio.
const CLOUDFLARE_IMAGE_MODEL = Deno.env.get('MIAR_AI_CLOUDFLARE_IMAGE_MODEL') || '@cf/black-forest-labs/flux-1-schnell';
const GEMINI_IMAGE_MODEL = Deno.env.get('MIAR_AI_GEMINI_IMAGE_MODEL') || '';
// Mesmo teto do bucket food-menu-images.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface GeneratedImage {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  provider: string;
}

const cloudflareConfig = () => {
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')?.trim();
  const token = Deno.env.get('CLOUDFLARE_AI_API_TOKEN')?.trim();
  return accountId && token ? { accountId, token } : null;
};

export const imageProvidersConfigured = () =>
  Boolean(cloudflareConfig()) || Boolean(GEMINI_IMAGE_MODEL && apiKeys('GEMINI_API_KEY').length);

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const extensionFor = (contentType: string) =>
  contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

export function buildProductPhotoPrompt(productName: string, visualHint?: unknown, category?: unknown): string {
  const hint = typeof visualHint === 'string' && visualHint.trim() ? ` ${visualHint.trim().slice(0, 300)}.` : '';
  const group = typeof category === 'string' && category.trim() ? ` Categoria: ${category.trim().slice(0, 60)}.` : '';
  return `Professional appetizing menu photo of "${productName.slice(0, 120)}", as served in a restaurant.${group}${hint} ` +
    'Neutral clean background, soft natural light, 3/4 angle, sharp focus, realistic. No text, no letters, no logos, no watermark, no hands.';
}

async function generateWithCloudflare(prompt: string): Promise<GeneratedImage> {
  const config = cloudflareConfig();
  if (!config) throw new Error('Cloudflare Workers AI não configurado');

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 4 }),
    },
  );
  if (!response.ok) throw new Error(`cloudflare ${response.status}: ${redactSecrets(await response.text())}`);

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.startsWith('image/')) {
    return { bytes: new Uint8Array(await response.arrayBuffer()), contentType, extension: extensionFor(contentType), provider: 'cloudflare' };
  }

  const data = await response.json();
  const base64 = data?.result?.image;
  if (typeof base64 !== 'string' || !base64) throw new Error('cloudflare: resposta sem imagem');
  return { bytes: decodeBase64(base64), contentType: 'image/jpeg', extension: 'jpg', provider: 'cloudflare' };
}

async function generateWithGemini(prompt: string): Promise<GeneratedImage> {
  if (!GEMINI_IMAGE_MODEL) throw new Error('MIAR_AI_GEMINI_IMAGE_MODEL não configurado');

  return withKeyPool('GEMINI_API_KEY', 'gemini-imagem', async (apiKey) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
    if (!response.ok) {
      throw new ProviderHttpError(response.status, `Gemini imagem ${response.status}: ${redactSecrets(await response.text())}`);
    }

    const data = await response.json();
    const parts: Array<{ inlineData?: { data: string; mimeType: string } }> = data?.candidates?.[0]?.content?.parts ?? [];
    const image = parts.find((part) => part.inlineData?.data)?.inlineData;
    if (!image) throw new Error('Gemini: resposta sem imagem');
    return { bytes: decodeBase64(image.data), contentType: image.mimeType, extension: extensionFor(image.mimeType), provider: 'gemini' };
  });
}

export async function generateProductImage(prompt: string): Promise<GeneratedImage> {
  const errors: string[] = [];
  const attempts: Array<[string, () => Promise<GeneratedImage>]> = [];
  if (cloudflareConfig()) attempts.push(['Cloudflare', () => generateWithCloudflare(prompt)]);
  if (GEMINI_IMAGE_MODEL) attempts.push(['Gemini', () => generateWithGemini(prompt)]);

  for (const [name, attempt] of attempts) {
    try {
      const image = await attempt();
      if (image.bytes.length > MAX_IMAGE_BYTES) throw new Error(`imagem com ${image.bytes.length} bytes, acima do limite`);
      return image;
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.error('[miar-assistant] geração de imagem falhou:', errors.join(' | '));
  throw new Error('Não consegui gerar a foto agora. Tente de novo em alguns minutos.');
}
