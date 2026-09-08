import { useEffect, useState, useCallback } from 'react';
import { Keyboard, RotateCcw, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

interface AtalhoAcao {
  action: string;
  label: string;
}

interface Atalho {
  id: string;
  action: string;
  key: string;
  tipo: 'teclado';
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const r = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers ?? {}),
    },
  });
  return r;
}

// Combinação de teclado, ex.: "ctrl+shift+p"
function keyComboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  const k = e.key.toLowerCase();
  if (!['control', 'alt', 'shift', 'meta'].includes(k)) parts.push(k);
  return parts.join('+');
}

export default function AtalhosPage() {
  const [acoesDisponiveis, setAcoesDisponiveis] = useState<AtalhoAcao[]>([]);
  const [atalhosSalvos, setAtalhosSalvos] = useState<Atalho[]>([]);
  const [gravando, setGravando] = useState<string | null>(null);
  const [novaAcao, setNovaAcao] = useState('');
  const [loading, setLoading] = useState(true);
  const [conflito, setConflito] = useState<{
    action: string; key: string; comQuem: Atalho;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch('/atalhos');
      if (r.ok) {
        const data = await r.json();
        setAtalhosSalvos(data.atalhos ?? []);
        setAcoesDisponiveis(data.acoesDisponiveis ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const salvar = useCallback(async (action: string, key: string, forcar = false) => {
    const r = await apiFetch('/atalhos', {
      method: 'POST',
      body: JSON.stringify({ action, key, tipo: 'teclado', forcar }),
    });
    if (r.status === 409) {
      const data = await r.json();
      setConflito({ action, key, comQuem: data.conflito });
      return;
    }
    if (!r.ok) {
      toast.error('Não foi possível gravar o atalho.');
      return;
    }
    toast.success('Atalho gravado!');
    void carregar();
  }, [carregar]);

  // Gravação por teclado — único jeito de configurar atalho aqui (05/09/2026,
  // pedido explícito: "atalho é só teclado"). Ouve em capture:true na window
  // pra pegar a tecla antes de qualquer outro handler global (ex.: o próprio
  // AppLayout, que também escuta atalhos de navegação).
  useEffect(() => {
    if (!gravando) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const combo = keyComboFromEvent(e);
      if (!combo || ['ctrl', 'alt', 'shift', 'meta'].includes(combo)) return;
      if (combo === 'escape') { setGravando(null); return; }
      const action = gravando;
      setGravando(null);
      void salvar(action, combo);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [gravando, salvar]);

  const limpar = useCallback(async (action: string) => {
    const r = await apiFetch(`/atalhos/${action}`, { method: 'DELETE' });
    if (r.ok) void carregar();
  }, [carregar]);

  const restaurarPadrao = useCallback(async () => {
    const r = await apiFetch('/atalhos/restaurar-padrao', { method: 'POST' });
    if (r.ok) {
      toast.success('Atalhos restaurados para o padrão.');
      void carregar();
    }
  }, [carregar]);

  const acoesJaConfiguradas = new Set(atalhosSalvos.map((a) => a.action));
  const acoesSemAtalho = acoesDisponiveis.filter((a) => !acoesJaConfiguradas.has(a.action));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 font-inter">
      <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-lg space-y-4">
        <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-[#38B000]" /> Atalhos Inteligentes
        </h2>
        <p className="text-xs text-[#8FA396]">
          Clique num atalho e pressione a combinação de teclado desejada. Cada usuário tem seus próprios atalhos.
        </p>

        <div className="space-y-2">
          {loading && <p className="text-xs text-[#8FA396]">Carregando...</p>}
          {!loading && atalhosSalvos.length === 0 && (
            <p className="text-xs text-[#8FA396]">Nenhum atalho configurado ainda.</p>
          )}
          {atalhosSalvos.map((a) => {
            const acao = acoesDisponiveis.find((x) => x.action === a.action);
            const estaGravando = gravando === a.action;
            return (
              <div key={a.action} className="flex items-center gap-3">
                <span className="text-xs font-medium text-[#F2F7F3] flex-1 min-w-0">
                  {acao?.label ?? a.action}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGravando(a.action)}
                    className={`min-w-[140px] px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all text-left flex items-center gap-1.5 ${
                      estaGravando
                        ? 'border-[#008000] bg-[#008000]/15 text-[#38B000] animate-pulse'
                        : 'border-[#16301F] bg-[#06100A] text-[#F2F7F3] hover:border-[#008000]/50'
                    }`}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    {estaGravando ? 'Pressione a tecla...' : a.key.toUpperCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => void limpar(a.action)}
                    className="rounded-lg p-1.5 text-[#8FA396] hover:text-rose-400 transition-colors"
                    title="Remover atalho"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {acoesSemAtalho.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-[#16301F]">
            <select
              value={novaAcao}
              onChange={(e) => setNovaAcao(e.target.value)}
              className="flex-1 rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-[#06100A]">Adicionar atalho para...</option>
              {acoesSemAtalho.map((a) => (
                <option key={a.action} value={a.action} className="bg-[#06100A]">{a.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!novaAcao}
              onClick={() => {
                if (!novaAcao) return;
                setGravando(novaAcao);
                setNovaAcao('');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#008000]/40 bg-[#008000]/10 px-3.5 py-2.5 text-xs font-bold text-[#38B000] hover:bg-[#008000]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Gravar
            </button>
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => void restaurarPadrao()}
            className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#06100A] px-3.5 py-2 text-xs font-bold text-[#8FA396] hover:text-[#F2F7F3] hover:border-[#008000]/50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
          </button>
        </div>
      </div>

      {/* Modal de conflito de combinação */}
      {conflito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4">
            <h3 className="font-manrope font-bold text-base text-[#F2F7F3]">Combinação já em uso</h3>
            <p className="text-xs text-[#8FA396]">
              A combinação já está atribuída a{' '}
              <strong className="text-[#38B000]">
                {acoesDisponiveis.find((a) => a.action === conflito.comQuem.action)?.label ?? conflito.comQuem.action}
              </strong>. Quer substituir?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConflito(null)}
                className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-bold text-[#8FA396] hover:text-[#F2F7F3]"
              >
                Escolher outra
              </button>
              <button
                type="button"
                onClick={() => {
                  void salvar(conflito.action, conflito.key, true);
                  setConflito(null);
                }}
                className="rounded-xl bg-[#008000] px-4 py-2 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000]"
              >
                Substituir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
