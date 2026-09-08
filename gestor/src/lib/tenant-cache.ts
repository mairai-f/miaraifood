// Cache de dados do NEGÓCIO da empresa logada (05/09/2026, achado real: em
// localStorage — que é por ORIGEM (mesmo domínio pra todos os apps), não por
// empresa — um segundo dono/empresa que loga no MESMO navegador/dispositivo
// (tablet compartilhado, suporte testando outra conta) herdava cardápio,
// funcionários e estado de onboarding da empresa ANTERIOR até o primeiro
// fetch real sobrescrever). Preferências de dispositivo/UI (idioma, tema,
// layout, device-id) não são dado de negócio e não entram nesta lista.
const TENANT_SCOPED_CACHE_KEYS = [
  'miar-cached-employees',
  'miar-catalog-products',
  'miar-company-logo',
  'miar-company-watermark',
  'miar-loja-ativa-id',
  'miar-kitchen-orders',
  'miar-mesas-state',
  'miar-onboarding-completed',
  'miar-onboarding-pending',
  'miar-onboarding-segment',
  'miar-onboarding-segment-id',
  'miar-passkey-after-onboarding',
  'miar-passkey-pending-token',
  'miar-waiter-alerts',
  'miar-first-access',
];

// Chamado tanto no logout quanto no instante de um NOVO login bem-sucedido —
// cobre tanto quem saiu direito quanto quem simplesmente teve o token
// expirado e logou de novo (com outra conta) sem passar pelo botão "Sair".
export function clearTenantScopedCache(): void {
  for (const key of TENANT_SCOPED_CACHE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage bloqueado (modo privado) — segue sem limpar */
    }
  }
}
