import { createRoot } from 'react-dom/client';
import App from './App';
import PreloadSplash from './components/PreloadSplash';

import './index.css';

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
