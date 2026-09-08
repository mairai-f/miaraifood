import { createRoot } from 'react-dom/client';
import { installApiFetchBaseUrl, setBaseUrl, setExtraHeadersGetter, getSupabaseClient } from '@workspace/api-client-react';

import App from './App';
import PreloadSplash from './components/PreloadSplash';

import './index.css';

// ─── Configuração de rede ─────────────────────────────────────────────────────
// Hierarquia de configuração do backend:
//   1. URL param ?_miar_server=... (uso em QR/onboarding)
//   2. Variável de ambiente VITE_API_URL (build do Render)
//   3. localStorage miar:local-server (modo local manual)
//   4. Sem base URL → chamadas relativas /api/... (proxy do Vite em dev)
const params = new URLSearchParams(window.location.search);
const paramServer = params.get('_miar_server');
if (paramServer) {
  localStorage.setItem('miar:local-server', paramServer);
  localStorage.setItem('miar:mode', 'local');
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('_miar_server');
  window.history.replaceState({}, '', cleanUrl.toString());
}

const mode = localStorage.getItem('miar:mode');
const localServer = localStorage.getItem('miar:local-server');
const resolvedUrl = paramServer ?? import.meta.env.VITE_API_URL ?? (mode === 'local' ? localServer : null);

if (resolvedUrl) {
  setBaseUrl(resolvedUrl);
  installApiFetchBaseUrl(resolvedUrl);
}

let accessToken: string | null = null;
try {
  const auth = getSupabaseClient().auth;
  void auth.getSession().then(({ data }) => { accessToken = data.session?.access_token ?? null; }).catch(() => {});
  auth.onAuthStateChange((_event, session) => { accessToken = session?.access_token ?? null; });
} catch { /* Supabase será configurado no ambiente publicado. */ }
setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}

// Regra de segurança (05/09/2026): botão Voltar após deslogar não pode
// reaparecer com a tela autenticada de antes — força reload real quando a
// página volta do bfcache (congelada, sem reexecutar o boot do app), pra
// reler o token do zero e cair no login se não houver sessão.
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
