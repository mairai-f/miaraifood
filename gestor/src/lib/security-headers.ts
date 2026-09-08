/**
 * Utilitário de Cabeçalhos HTTP para proteção de dados sensíveis e prevenção de cache.
 * Deve ser aplicado em respostas de APIs relativas a faturamento, logins e fichas técnicas.
 */
export const SENSITIVE_DATA_SECURITY_HEADERS: Record<string, string> = {
  // Previne armazenamento em cache por navegadores, CDNs e proxies intermediários
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store',

  // Cabeçalhos de Segurança HTTP recomendados pela OWASP
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Aplica os cabeçalhos de segurança anti-cache a um objeto Response ou Headers do Fetch API.
 */
export function applySensitiveSecurityHeaders(headers: Headers): void {
  Object.entries(SENSITIVE_DATA_SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
}
