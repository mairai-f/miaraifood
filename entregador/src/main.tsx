import { createRoot } from 'react-dom/client';
import { installApiFetchBaseUrl, setBaseUrl, setExtraHeadersGetter, getSupabaseClient } from '@workspace/api-client-react';

import App from './App';
import PreloadSplash from './components/PreloadSplash';

import './index.css';

// Aponta as chamadas de API para o endereço do backend (api-server).
// Em desenvolvimento, se VITE_API_URL não estiver definido, as chamadas
// relativas (/api/...) são encaminhadas pelo proxy do Vite (ver vite.config.ts).
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
  installApiFetchBaseUrl(apiUrl);
}

// Perímetro de segurança física: reserva de GPS caso o Wi-Fi do restaurante
// não seja suficiente. Se o navegador negar a permissão, nenhum header é
// enviado e o servidor cai de volta só na verificação de rede Wi-Fi.
let _posicaoAtual: string | null = null;
if (typeof navigator !== 'undefined' && navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => { _posicaoAtual = `${pos.coords.latitude},${pos.coords.longitude}`; },
    () => { /* sem permissão — continua só com o Wi-Fi */ },
    { enableHighAccuracy: false, maximumAge: 60_000 },
  );
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
  if (_posicaoAtual) headers['X-Miar-Geo'] = _posicaoAtual;
  // Multi-loja (14/08/2026): identifica qual loja este dispositivo opera.
  const lojaId = window.localStorage.getItem('miar-loja-ativa-id');
  if (lojaId) headers['x-loja-id'] = lojaId;
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
