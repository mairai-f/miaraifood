// artifacts/gestor/src/pages/onboarding-usuarios.tsx
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Trash2, UserPlus, ShieldCheck, Save } from 'lucide-react';
import { FUNCOES, TODAS_FUNCOES, PERFIL_FUNCOES } from '@/lib/funcoes';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}

// Lista mestra de funções (fonte única). Adapta os nomes para esta tela.

type Recurso = { id: string; nome: string; detalhe: string };
type GrupoRecurso = { id: string; grupo: string; recursos: Recurso[] };

export const RECURSOS: GrupoRecurso[] = FUNCOES.map((g) => ({
  id: g.id,
  grupo: g.grupo,
  recursos: g.funcoes.map((f) => ({ id: f.id, nome: f.nome, detalhe: f.detalhe })),
}));

const TODOS_IDS = TODAS_FUNCOES;

// ─────────────────────────────────────────────────────────────────────────────
// Perfis prontos, espelhando os artifacts do monorepo
// ─────────────────────────────────────────────────────────────────────────────
const PERFIS: Record<string, { nome: string; recursos: string[] }> = {
  atendente: {
    nome: 'Atendente',
    recursos: PERFIL_FUNCOES.atendente,
  },
  cozinha: {
    nome: 'Cozinha',
    recursos: PERFIL_FUNCOES.cozinha,
  },
  caixa: {
    nome: 'Caixa',
    recursos: PERFIL_FUNCOES.caixa,
  },
  entregador: {
    nome: 'Entregador',
    recursos: PERFIL_FUNCOES.entregador,
  },
  gerente: {
    nome: 'Gerente',
    recursos: PERFIL_FUNCOES.gerente,
  },
  total: {
    nome: 'Sócio',
    recursos: PERFIL_FUNCOES.total,
  },
};

type Usuario = {
  uid: string;
  nome: string;
  cargoPersonalizado?: string;
  email: string;
  telefone: string;
  pin: string;
  perfil: string;
  recursos: string[];
};

function novoUsuario(): Usuario {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    nome: '',
    cargoPersonalizado: '',
    email: '',
    telefone: '',
    pin: '',
    perfil: 'atendente',
    recursos: [...PERFIS.atendente.recursos],
  };
}

export default function OnboardingUsuarios() {
  const [, setLocation] = useLocation();
  const [usuarios, setUsuarios] = useState<Usuario[]>([novoUsuario()]);
  const [ativo, setAtivo] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const atual = usuarios[ativo];

  const totalMarcado = useMemo(() => atual?.recursos.length ?? 0, [atual]);

  const patch = (campos: Partial<Usuario>) => {
    setUsuarios((lista) =>
      lista.map((u, i) => (i === ativo ? { ...u, ...campos } : u)),
    );
  };

  const aplicarPerfil = (perfilId: string) => {
    patch({ perfil: perfilId, recursos: [...(PERFIS[perfilId]?.recursos ?? [])] });
  };

  const alternarRecurso = (recursoId: string) => {
    if (!atual) return;
    const marcado = atual.recursos.includes(recursoId);
    const proximos = marcado
      ? atual.recursos.filter((r) => r !== recursoId)
      : [...atual.recursos, recursoId];
    patch({ recursos: proximos, perfil: 'personalizado' });
  };

  const alternarGrupo = (grupo: GrupoRecurso) => {
    if (!atual) return;
    const ids = grupo.recursos.map((r) => r.id);
    const todosMarcados = ids.every((id) => atual.recursos.includes(id));
    const proximos = todosMarcados
      ? atual.recursos.filter((r) => !ids.includes(r))
      : Array.from(new Set([...atual.recursos, ...ids]));
    patch({ recursos: proximos, perfil: 'personalizado' });
  };

  const adicionar = () => {
    setUsuarios((lista) => [...lista, novoUsuario()]);
    setAtivo(usuarios.length);
    setOkMsg(null);
  };

  const remover = (indice: number) => {
    if (usuarios.length === 1) return;
    setUsuarios((lista) => lista.filter((_, i) => i !== indice));
    setAtivo((a) => (a >= indice && a > 0 ? a - 1 : a));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setOkMsg(null);

    try {
      const empregadosFormatados = usuarios.map((u) => ({
        id: u.uid,
        name: u.nome || 'Novo Colaborador',
        email: u.email || '',
        phone: u.telefone || '',
        pin: u.pin || '1234',
        role: u.perfil,
        permissions: u.recursos,
      }));
      localStorage.setItem('miar-cached-employees', JSON.stringify(empregadosFormatados));
    } catch (e) {
      console.warn('Erro ao salvar localmente:', e);
    }

    try {
      const token = getToken();
      if (token) {
        await fetch('/api/employees/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            employees: usuarios.map((u) => ({
              name: u.nome,
              email: u.email || null,
              phone: u.telefone || null,
              pin: u.pin,
              role: u.perfil,
              permissions: u.recursos,
            })),
          }),
        }).catch(() => null);
      }
      setOkMsg(`${usuarios.length} usuário(s) cadastrados com sucesso.`);
      setTimeout(() => setLocation('/onboarding/estabelecimento'), 400);
    } catch (e: unknown) {
      setLocation('/onboarding/estabelecimento');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#06100A] p-3 md:p-6 overflow-hidden flex flex-col text-slate-100">
      <div className="mx-auto w-full max-w-6xl h-full flex flex-col overflow-hidden">
        <header className="shrink-0 mb-4 border-b border-[#16301F] pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#38B000]">
                Passo 1 de 3
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-[#F2F7F3]">Cadastrar usuários e equipe</h1>
              <p className="mt-0.5 text-xs text-[#8FA396]">
                Escolha um perfil pronto e ajuste as permissões. Quem não tiver permissão não visualiza as telas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocation('/onboarding/segmento')}
              className="flex items-center gap-1.5 rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-1.5 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
              data-testid="button-voltar-usuarios"
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-2 grid gap-5 lg:grid-cols-[280px_1fr] min-h-0">
          <aside className="space-y-3">
            <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-3">
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-[#8FA396]">
                Equipe ({usuarios.length})
              </p>
              <div className="space-y-1.5">
                {usuarios.map((u, i) => (
                  <div
                    key={u.uid}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                      i === ativo
                        ? 'border-[#008000] bg-[#008000]/10'
                        : 'border-[#16301F] bg-[#0B1A10] hover:border-[#16301F]/80'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setAtivo(i)}
                      className="flex-1 text-left"
                      data-testid={`button-usuario-${i}`}
                    >
                      <p className="truncate text-xs font-bold text-[#F2F7F3]">
                        {u.nome || 'Novo usuário'}
                      </p>
                      <p className="truncate text-[11px] text-[#8FA396]">
                        {PERFIS[u.perfil]?.nome ?? 'Personalizado'} · {u.recursos.length} recursos
                      </p>
                    </button>
                    {usuarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remover(i)}
                        aria-label="Remover usuário"
                        className="text-[#8FA396] hover:text-rose-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={adicionar}
                data-testid="button-adicionar-usuario"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#16301F] py-2 text-xs font-bold text-[#38B000] hover:bg-[#008000]/10 transition"
              >
                <Plus size={14} />
                Adicionar usuário
              </button>
            </div>
          </aside>

          <section className="space-y-5">
            <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#F2F7F3]">
                <UserPlus size={16} className="text-[#008000]" />
                Dados da pessoa
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-[#8FA396]">
                    Nome completo
                  </label>
                  <input
                    value={atual?.nome ?? ''}
                    onChange={(e) => patch({ nome: e.target.value })}
                    placeholder="Ex: João da Silva"
                    data-testid="input-nome-usuario"
                    className="mt-1 w-full rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8FA396]">
                    PIN de acesso (4 dígitos)
                  </label>
                  <input
                    value={atual?.pin ?? ''}
                    onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="Ex: 1234"
                    maxLength={4}
                    data-testid="input-pin-usuario"
                    className="mt-1 w-full rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8FA396]">
                    Função / Cargo Personalizado (Opcional)
                  </label>
                  <input
                    value={atual?.cargoPersonalizado ?? ''}
                    onChange={(e) => patch({ cargoPersonalizado: e.target.value })}
                    placeholder="Ex: Pizzaiolo, Sub-Gerente..."
                    data-testid="input-cargo-usuario"
                    className="mt-1 w-full rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8FA396]">E-mail</label>
                  <input
                    value={atual?.email ?? ''}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="joao@empresa.com"
                    data-testid="input-email-usuario"
                    className="mt-1 w-full rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#8FA396]">Telefone</label>
                  <input
                    value={atual?.telefone ?? ''}
                    onChange={(e) => patch({ telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    data-testid="input-telefone-usuario"
                    className="mt-1 w-full rounded-xl border border-[#16301F] bg-[#0B1A10] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#F2F7F3]">
                  <ShieldCheck size={16} className="text-[#008000]" />
                  Permissões de Acesso
                </h2>
                <span className="text-xs text-[#8FA396]">
                  {totalMarcado} de {TODOS_IDS.length} recursos autorizados
                </span>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {Object.entries(PERFIS).map(([id, perf]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => aplicarPerfil(id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                      atual?.perfil === id
                        ? 'border-[#008000] bg-[#008000]/20 text-[#38B000]'
                        : 'border-[#16301F] bg-[#0B1A10] text-[#8FA396] hover:text-[#F2F7F3]'
                    }`}
                  >
                    {perf.nome}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {RECURSOS.map((grupo) => {
                  const ids = grupo.recursos.map((r) => r.id);
                  const marcadosNoGrupo = ids.filter((id) => atual?.recursos.includes(id)).length;
                  return (
                    <div key={grupo.id} className="rounded-xl border border-[#16301F]/60 bg-[#0B1A10]/40 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-[#38B000]">
                          {grupo.grupo}
                        </p>
                        <button
                          type="button"
                          onClick={() => alternarGrupo(grupo)}
                          className="text-xs text-[#008000] hover:underline"
                        >
                          {marcadosNoGrupo === ids.length ? 'Desmarcar tudo' : 'Marcar tudo'}
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {grupo.recursos.map((recurso) => {
                          const marcado = atual?.recursos.includes(recurso.id) ?? false;
                          return (
                            <label
                              key={recurso.id}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                                marcado
                                  ? 'border-[#008000]/60 bg-[#008000]/10'
                                  : 'border-[#16301F]/40 hover:border-[#16301F]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => alternarRecurso(recurso.id)}
                                data-testid={`checkbox-recurso-${recurso.id}`}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[#008000]"
                              />
                              <span>
                                <span className="block text-xs font-bold text-[#F2F7F3]">{recurso.nome}</span>
                                <span className="block text-[11px] leading-snug text-[#8FA396]">
                                  {recurso.detalhe}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Sticky Footer Bar with Primary CTA (No Skip Button) */}
        <footer className="shrink-0 pt-3 mt-3 border-t border-[#16301F] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#06100A]">
          <div className="text-xs text-[#8FA396]">
            {usuarios.length} colaborador(es) configurado(s). Avance para concluir o cadastro do estabelecimento.
          </div>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            data-testid="button-salvar-usuarios"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#008000] px-6 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-[0.98] transition shadow-[0_2px_12px_rgba(255,195,0,0.3)] disabled:opacity-50"
          >
            <Save size={16} />
            <span>{salvando ? 'Salvando...' : 'Salvar & Avançar para Estabelecimento →'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
