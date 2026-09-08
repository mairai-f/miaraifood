const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const miaifoodQrRequest = async <T>(body: Record<string, unknown>): Promise<T> => {
  if (!url || !key) throw new Error('QR Menu sem configuração Supabase.');
  const response = await fetch(url.replace(/\/$/, '') + '/functions/v1/food-qrmenu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || 'Não foi possível abrir o QR Menu.');
  return payload as T;
};
