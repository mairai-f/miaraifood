import { createRoot } from 'react-dom/client';
import { installApiFetchBaseUrl, setBaseUrl, setExtraHeadersGetter } from '@workspace/api-client-react';

import App from './App';
import PreloadSplash from './components/PreloadSplash';

import './index.css';

// ─── Configuração de rede ─────────────────────────────────────────────────────
//
// Hierarquia de configuração do servidor de API:
//   1. URL param ?_miar_server=... (vem do QR code de onboarding)
//   2. Variável de ambiente VITE_API_URL (definida no build)
//   3. localStorage miar:local-server (configurado manualmente no app)
//   4. Sem base URL → chamadas relativas /api/... (proxy do Vite em dev)
//
// O modo "local" persiste entre sessões via localStorage.

// 1. URL param — usado quando o admin gera um QR code de onboarding
const params = new URLSearchParams(window.location.search);
const paramServer = params.get('_miar_server');
if (paramServer) {
  localStorage.setItem('miar:local-server', paramServer);
  localStorage.setItem('miar:mode', 'local');
  // Remove o param da URL para não aparecer no histórico
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('_miar_server');
  window.history.replaceState({}, '', cleanUrl.toString());
}

// 2–4. Resolve a URL efetiva
const mode = localStorage.getItem('miar:mode');
const localServer = localStorage.getItem('miar:local-server');
const resolvedUrl = paramServer ?? import.meta.env.VITE_API_URL ?? (mode === 'local' ? localServer : null);

if (resolvedUrl) {
  setBaseUrl(resolvedUrl);
  installApiFetchBaseUrl(resolvedUrl);
}

setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
  return headers;
});

// Regra de segurança (05/09/2026, incidente real): depois de deslogar, o
// botão Voltar do navegador não pode reaparecer com a tela autenticada de
// antes. O culpado é o bfcache — o navegador congela a página inteira
// (heap JS incluído) ao sair, e o botão Voltar restaura esse instantâneo
// congelado em vez de rodar o app do zero, então o React nunca chega a
// reler o localStorage (já limpo pelo logout) pra descobrir que não há
// mais sessão. `pageshow` com `event.persisted` é como o próprio navegador
// avisa "essa página voltou do congelamento, não foi um load novo" — a
// resposta correta é forçar um reload de verdade, que aí sim reexecuta o
// boot normal do app e cai na tela de login se não houver token válido.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <>
    <PreloadSplash />
    <App />
  </>,
);

// PWA — registra o service worker APENAS em produção pra funcionar offline/instalado.
// Em desenvolvimento (DEV), desregistra para evitar cache de HMR do Vite.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=3`).catch(() => {});
    });
  }
}
