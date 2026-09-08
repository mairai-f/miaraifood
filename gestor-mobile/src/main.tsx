import { createRoot } from 'react-dom/client';
import { installApiFetchBaseUrl, setBaseUrl, setExtraHeadersGetter, setAuthTokenGetter } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// Aponta as chamadas de API para o endereço do backend (api-server).
// Em desenvolvimento, se VITE_API_URL não estiver definido, as chamadas
// relativas (/api/...) são encaminhadas pelo proxy do Vite (ver vite.config.ts).
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
  installApiFetchBaseUrl(apiUrl);
}

// CORRIGIDO (02/09/2026, achado em auditoria) — sem isso, o cliente HTTP
// compartilhado (custom-fetch.ts) caía no fallback que só lê a chave
// "miar_token" do localStorage, que este app nunca escreve (aqui o token
// é salvo como "gestor_token", em localStorage OU sessionStorage conforme
// "manter conectado" — ver login.tsx). Resultado: toda chamada autenticada
// saía sem Authorization e o usuário caía de volta pro login. Mesmo padrão
// já usado em artifacts/gestor/src/App.tsx.
setAuthTokenGetter(() =>
  window.localStorage.getItem('gestor_token') ?? window.sessionStorage.getItem('gestor_token'),
);

// CORRIGIDO (20/08/2026, achado em auditoria) — mesmo padrão já usado em
// Cozinha, Atendente e Entregador: sem isso, o Gestor Mobile nunca informava
// qual loja está ativa em contas multi-loja, então toda operação caía na
// loja padrão mesmo que o gestor tivesse trocado de loja no seletor.
setExtraHeadersGetter(() => {
  const headers: Record<string, string> = {};
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
  return headers;
});

createRoot(document.getElementById('root')!).render(<App />);

// PWA — registra o service worker pra funcionar offline/instalado.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {});
  });
}
