import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import { useTranslation } from './IdiomaContext';
import { SeletorIdioma } from './SeletorIdioma';
import { MiarEditaMenu } from '@workspace/api-client-react';

/** Liga/desliga o chat flutuante da MIA — reflete e controla a mesma chave
 * ('miar-chat-dismissed') usada pelo botão de X no avatar dela. */
function ToggleAssistenteMia() {
  const [escondida, setEscondida] = useState(() => localStorage.getItem('miar-chat-dismissed') === '1');
  const alternar = () => {
    if (escondida) {
      localStorage.removeItem('miar-chat-dismissed');
    } else {
      localStorage.setItem('miar-chat-dismissed', '1');
    }
    setEscondida(!escondida);
    window.dispatchEvent(new Event('miar-chat-visibility-changed'));
  };
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--miar-line, #16301F)' }}>
      <p style={{ fontSize: 12, color: 'var(--miar-muted, #8FA396)', marginBottom: 6, fontWeight: 600 }}>Assistente MIA</p>
      <button
        type="button"
        onClick={alternar}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: '1px solid var(--miar-line, #16301F)',
          background: escondida ? 'transparent' : 'rgba(0,168,107,0.12)',
          color: escondida ? 'var(--miar-muted, #8FA396)' : '#38B000',
        }}
      >
        {escondida ? 'Mostrar a MIA' : 'MIA visível'}
      </button>
      <p style={{ fontSize: 10, color: 'var(--miar-muted, #8FA396)', marginTop: 6 }}>
        Ela só tira dúvidas sobre o app e o negócio — para suporte humano, WhatsApp (67) 99308-9698.
      </p>
    </div>
  );
}

/**
 * Botão fixo de Configurações — hoje só tem idioma dentro, mas é o lugar
 * certo pra crescer (fica no canto, não atrapalha o app operacional).
 * Cada pessoa logada neste app escolhe o próprio idioma aqui, independente
 * de quem usa outro app do ecossistema.
 */
export function ConfigFlutuante() {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={t('config.titulo')}
        style={{
          position: 'fixed', bottom: 16, left: 16, zIndex: 40,
          width: 44, height: 44, borderRadius: 999,
          background: 'var(--miar-surface, #17222C)',
          border: '1px solid rgba(0,230,242,0.35)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          color: '#F2F7F3',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Settings size={17} />
      </button>

      {aberto && (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setAberto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('config.titulo')}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 380, margin: '0 auto 16px', marginLeft: 16,
              borderRadius: 16, padding: 16,
              background: 'var(--miar-surface, #0B1A10)',
              border: '1px solid var(--miar-line, #16301F)',
              color: 'var(--miar-text, #F2F7F3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong style={{ fontSize: 14 }}>{t('config.titulo')}</strong>
              <button type="button" onClick={() => setAberto(false)} style={{ color: 'var(--miar-muted, #8FA396)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--miar-muted, #8FA396)', marginBottom: 6, fontWeight: 600 }}>{t('config.idioma_titulo')}</p>
            <p style={{ fontSize: 11, color: 'var(--miar-muted, #8FA396)', marginBottom: 10 }}>{t('config.idioma_texto')}</p>
            <SeletorIdioma />
            <MiarEditaMenu />
            <ToggleAssistenteMia />
          </div>
        </div>
      )}
    </>
  );
}
