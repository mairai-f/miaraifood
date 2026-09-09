import { createRoot } from 'react-dom/client';

import App from './App';
import PreloadSplash from './components/PreloadSplash';

import './index.css';

// Regra de segurança (05/09/2026, incidente real): depois de deslogar, o
// botão Voltar do navegador não pode reaparecer com a tela autenticada de
// antes — aqui é ainda mais crítico, é a conta de admin da plataforma
// inteira. `pageshow` com `event.persisted` detecta quando a página voltou
// do bfcache (congelada, sem reexecutar o boot do app) e força um reload
// de verdade, que relê o token do zero e cai no login se não houver sessão.
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

// PWA — registra o service worker pra funcionar offline/instalado.
// Lembrete: base pra evoluir pra APK depois, sem mudar essa peça.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=4`).catch(() => {});
  });
}
