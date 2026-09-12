// Endereco publico do app, para links e QR Codes.
//
// No navegador vale a origem atual. No app desktop a interface roda em file://,
// entao window.location.origin viraria "file://" e o QR Code da mesa ficaria
// inutil: nesse caso usamos o endereco publico do sistema.
const FALLBACK_PUBLIC_ORIGIN = 'https://app.miaraifood.com.br';

export const publicAppOrigin = () => {
  if (typeof window === 'undefined') return FALLBACK_PUBLIC_ORIGIN;
  return window.location.protocol.startsWith('http') ? window.location.origin : FALLBACK_PUBLIC_ORIGIN;
};

export const publicAppUrl = (path: string) =>
  `${publicAppOrigin()}/${path.replace(/^\/+/, '')}`;
