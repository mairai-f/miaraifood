import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Check, Plus, Trash2, Mic,
  MousePointerClick, Eraser, Loader2, CheckCircle2,
  Rocket, Store, ShieldCheck, UserPlus, X, ChevronDown,
  Pizza, UtensilsCrossed, Beer, Fish, Coffee, Croissant,
  Beef, Apple, ShoppingBag, IceCreamCone, Package, Flame,
  Wine, CupSoda, Dog, Hotel, Bed, Bot, ChefHat,
  CreditCard, Truck, Key, Users, Layers, ClipboardList, Sandwich
} from 'lucide-react';
import { SEGMENTOS, RECURSOS_ESTAB } from './onboarding-estabelecimento';
import { FUNCOES, PERFIL_FUNCOES } from '@/lib/funcoes';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? '';
}
function authH() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

type Etapa = 'unidades' | 'segmentos' | 'modo' | 'cardapio' | 'equipe' | 'lancamento';
type ModoCardapio = 'marcar' | 'eliminar' | 'ia';

type ItemCardapio = { categoria: string; nome: string; preco: string; marcado: boolean };

type Membro = {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  pin: string;
  perfil: string;
  recursos: string[];
};

const PERFIS_PRONTOS: Record<string, { label: string; icon: any; recursos: string[] }> = {
  atendente: { label: 'Atendente', icon: UtensilsCrossed, recursos: PERFIL_FUNCOES.atendente },
  cozinha: { label: 'Cozinha', icon: ChefHat, recursos: PERFIL_FUNCOES.cozinha },
  caixa: { label: 'Caixa', icon: CreditCard, recursos: PERFIL_FUNCOES.caixa },
  entregador: { label: 'Entregador', icon: Truck, recursos: PERFIL_FUNCOES.entregador },
  gerente: { label: 'Gerente', icon: ShieldCheck, recursos: PERFIL_FUNCOES.gerente },
  total: { label: 'Sócio', icon: Key, recursos: PERFIL_FUNCOES.total },
};

function novoMembro(): Membro {
  return {
    uid: Math.random().toString(36).slice(2, 10),
    nome: '', email: '', telefone: '',
    pin: '', perfil: 'atendente',
    recursos: [...PERFIL_FUNCOES.atendente],
  };
}

const SEGMENTO_ICONS: Record<string, any> = {
  pizzaria: Pizza, churrascaria: Beef, restaurante: UtensilsCrossed, bar: Beer,
  japones: Fish, hamburgueria: Sandwich, cafeteria: Coffee, padaria: Croissant,
  aougue: Flame, hortifrut: Apple, mercearia: ShoppingBag, sorveteria: IceCreamCone,
  marmitaria: Package, pastelaria: Flame, 'casa-de-show': Bot, cantina: UtensilsCrossed,
  choperia: Beer, conveniencia: ShoppingBag, boteco: Beer, 'cachorro-quente': Flame,
  'food-truck': Truck, adega: Wine, 'drive-thru-bebidas': CupSoda, petshop: Dog, pousada: Hotel, motel: Bed, hotel: Hotel, outros: Bot,
};

const ETAPAS: { id: Etapa; label: string }[] = [
  { id: 'unidades', label: 'Unidades' },
  { id: 'segmentos', label: 'Negócio' },
  { id: 'modo', label: 'Cardápio' },
  { id: 'cardapio', label: 'Itens' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'lancamento', label: 'Lançar' },
];

function ProgressoBar({ etapa }: { etapa: Etapa }) {
  const idx = ETAPAS.findIndex((e) => e.id === etapa);
  return (
    <div className="shrink-0 mb-4">
      <div className="flex items-center gap-1.5">
        {ETAPAS.map((e, i) => (
          <div key={e.id} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-all duration-500 ${
              i < idx ? 'bg-[#008000]' : i === idx ? 'bg-[#38B000]' : 'bg-[#16301F]'
            }`} />
            <span className={`hidden text-[10px] font-bold uppercase tracking-wider sm:block transition-colors ${
              i <= idx ? 'text-[#38B000]' : 'text-[#7A8F7E]'
            }`}>{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Titulo({ supra, titulo, sub }: { supra: string; titulo: string; sub?: string }) {
  return (
    <header className="shrink-0 mb-4">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#38B000]">{supra}</p>
      <h1 className="mt-1 text-2xl font-manrope font-black text-[#F2F7F3]">{titulo}</h1>
      {sub && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#8FA396]">{sub}</p>}
    </header>
  );
}

function BtnPrimario({ onClick, loading, disabled, children, full }: {
  onClick?: () => void; loading?: boolean; disabled?: boolean; children: React.ReactNode; full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center justify-center gap-2 rounded-xl bg-[#008000] px-6 py-2.5 text-xs font-bold text-[#F2F7F3] transition hover:bg-[#38B000] active:scale-95 disabled:opacity-40 shadow-[0_2px_12px_rgba(255,195,0,0.3)] ${full ? 'w-full' : ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function BtnSecundario({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#06100A] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] transition hover:border-[#008000]"
    >
      {children}
    </button>
  );
}

function Rodape({ onVoltar, onAvancar, loading, disabled, avancarLabel = 'Continuar' }: {
  onVoltar?: () => void; onAvancar?: () => void; loading?: boolean; disabled?: boolean; avancarLabel?: string;
}) {
  return (
    <div className="shrink-0 pt-4 border-t border-[#16301F] bg-[#0B1A10] flex items-center justify-between gap-4 mt-auto">
      {onVoltar
        ? <BtnSecundario onClick={onVoltar}><ArrowLeft className="h-4 w-4" /> Voltar</BtnSecundario>
        : <div />
      }
      {onAvancar && (
        <BtnPrimario onClick={onAvancar} loading={loading} disabled={disabled}>
          {avancarLabel} <ArrowRight className="h-4 w-4" />
        </BtnPrimario>
      )}
    </div>
  );
}

// ─── Etapa 1: Quantas unidades ──────────────────────────────────────────────────

function EtapaUnidades({ onNext }: { onNext: (n: number) => void }) {
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const opcoes = [
    { n: 1, label: '1 unidade', sub: 'Só uma casa' },
    { n: 2, label: '2 unidades', sub: 'Dois endereços' },
    { n: 3, label: '3 unidades', sub: 'Três locais' },
    { n: 4, label: '4 ou mais', sub: 'Rede / franquia' },
  ];
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo supra="Etapa 1 de 6" titulo="Quantas unidades você tem?" sub="Cada unidade vai ter seu próprio painel, cardápio e equipe. Você sempre pode adicionar mais depois." />
      
      <div className="flex-1 overflow-y-auto pr-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 align-content-start">
        {opcoes.map(({ n, label, sub }) => (
          <button
            key={n}
            type="button"
            onClick={() => setSelecionado(n)}
            className={`group flex flex-col items-center rounded-2xl border p-6 text-center transition-all ${
              selecionado === n
                ? 'border-[#008000] bg-[#008000]/10 shadow-[0_0_15px_rgba(255,195,0,0.2)]'
                : 'border-[#16301F] bg-[#06100A] hover:border-[#008000]/50'
            }`}
          >
            <span className="mb-2 text-3xl font-black font-manrope text-[#38B000]">{n === 4 ? '4+' : n}</span>
            <span className="text-xs font-bold text-[#F2F7F3]">{label}</span>
            <span className="mt-1 text-[11px] text-[#8FA396]">{sub}</span>
            {selecionado === n && <Check className="mt-2 h-4 w-4 text-[#008000]" />}
          </button>
        ))}
      </div>

      <Rodape onAvancar={() => selecionado && onNext(selecionado)} disabled={!selecionado} />
    </div>
  );
}

// ─── Etapa 2: Segmentos (multi-select) ─────────────────────────────────────────

function EtapaSegmentos({ onNext, onBack }: { onNext: (ids: string[]) => void; onBack: () => void }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelecionados((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo
        supra="Etapa 2 de 6"
        titulo="Qual é o segmento do seu negócio?"
        sub="Selecione um ou mais segmentos. O sistema irá injetar automaticamente o cardápio e fluxos operacionais para seu nicho."
      />

      <div className="flex-1 overflow-y-auto pr-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 align-content-start">
        {SEGMENTOS.map((seg) => {
          const ativo = selecionados.has(seg.id);
          const IconComp = SEGMENTO_ICONS[seg.id] || UtensilsCrossed;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => toggle(seg.id)}
              className={`group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                ativo
                  ? 'border-[#008000] bg-[#008000]/10 shadow-[0_0_12px_rgba(255,195,0,0.15)]'
                  : 'border-[#16301F] bg-[#06100A] hover:border-[#008000]/50'
              }`}
            >
              <div className={`p-2.5 rounded-xl border ${ativo ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]' : 'bg-[#0B1A10] text-[#38B000] border-[#16301F]'}`}>
                <IconComp className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#F2F7F3]">{seg.nome}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#8FA396]">{seg.descricao}</p>
              </div>
              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-all ${
                ativo ? 'border-[#008000] bg-[#008000] text-[#F2F7F3]' : 'border-[#16301F] bg-[#06100A]'
              }`}>
                {ativo && <Check className="h-3 w-3 font-bold" />}
              </div>
            </button>
          );
        })}
      </div>

      {selecionados.size > 0 && (
        <p className="py-2 text-xs font-bold text-[#38B000]">
          {selecionados.size} segmento{selecionados.size > 1 ? 's' : ''} selecionado{selecionados.size > 1 ? 's' : ''}
        </p>
      )}

      <Rodape onVoltar={onBack} onAvancar={() => selecionados.size > 0 && onNext([...selecionados])} disabled={selecionados.size === 0} />
    </div>
  );
}

// ─── Etapa 3: Modo de cardápio ──────────────────────────────────────────────────

function EtapaModo({ onNext, onBack }: { onNext: (m: ModoCardapio) => void; onBack: () => void }) {
  const [selecionado, setSelecionado] = useState<ModoCardapio | null>(null);
  const opcoes: Array<{ id: ModoCardapio; icon: any; titulo: string; descricao: string; destaque?: boolean }> = [
    {
      id: 'ia',
      icon: Mic,
      titulo: 'Contar para a IA Ária',
      descricao: 'Descreva seu cardápio em texto livre — como se estivesse falando. A IA analisa e gera a lista automaticamente.',
      destaque: true,
    },
    {
      id: 'marcar',
      icon: CheckCircle2,
      titulo: 'Marcar o que tenho',
      descricao: 'Veja a lista pronta do seu segmento e marque apenas os itens que você comercializa.',
    },
    {
      id: 'eliminar',
      icon: Trash2,
      titulo: 'Eliminar o que não tenho',
      descricao: 'Começa com a lista completa do segmento marcada. Você apenas desmarca o que não comercializa.',
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo supra="Etapa 3 de 6" titulo="Como quer montar seu cardápio?" sub="Escolha o método mais rápido para o seu estabelecimento." />

      <div className="flex-1 overflow-y-auto pr-1 grid gap-4 sm:grid-cols-3 align-content-start">
        {opcoes.map((op) => {
          const IconComp = op.icon;
          const isSelected = selecionado === op.id;
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => setSelecionado(op.id)}
              className={`group flex flex-col items-start rounded-2xl border p-5 text-left transition-all ${
                isSelected
                  ? 'border-[#008000] bg-[#008000]/10 shadow-[0_0_15px_rgba(255,195,0,0.15)]'
                  : 'border-[#16301F] bg-[#06100A] hover:border-[#008000]/50'
              }`}
            >
              <div className="mb-3 flex items-center justify-between w-full">
                <div className={`p-2.5 rounded-xl border ${isSelected ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]' : 'bg-[#0B1A10] text-[#38B000] border-[#16301F]'}`}>
                  <IconComp className="h-6 w-6" />
                </div>
                {op.destaque && <span className="rounded-full bg-[#008000]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#38B000] border border-[#008000]/40 uppercase tracking-wider">Recomendado</span>}
              </div>
              <p className="text-sm font-bold text-[#F2F7F3]">{op.titulo}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[#8FA396]">{op.descricao}</p>
              {isSelected && (
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#38B000]">
                  <Check className="h-4 w-4" /> Selecionado
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Rodape onVoltar={onBack} onAvancar={() => selecionado && onNext(selecionado)} disabled={!selecionado} />
    </div>
  );
}

// ─── Etapa 4a: Cardápio por IA ──────────────────────────────────────────────────

function CardapioIA({ segmentoIds, onConfirm, onBack }: {
  segmentoIds: string[]; onConfirm: (itens: ItemCardapio[]) => void; onBack: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [processando, setProcessando] = useState(false);
  const [itens, setItens] = useState<ItemCardapio[] | null>(null);
  const [erro, setErro] = useState('');
  const [phase, setPhase] = useState<'input' | 'processing' | 'review'>('input');
  const nomeSegmentos = segmentoIds.map((id) => SEGMENTOS.find((s) => s.id === id)?.nome).filter(Boolean).join(', ');

  const processar = async () => {
    if (!texto.trim()) return;
    setProcessando(true);
    setErro('');
    setPhase('processing');
    try {
      const prompt = `Você é o assistente MIAR. Analise a descrição abaixo de um(a) ${nomeSegmentos} e extraia todos os itens do cardápio. Retorne SOMENTE JSON: [{"categoria":"Nome da Categoria","nome":"Nome do Item"}]. Sem texto extra.\n\nDescrição: ${texto}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Erro no processamento da IA.');

      const reply = data.message ?? '';
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('A IA não retornou o formato esperado. Tente novamente.');

      const parsed: Array<{ categoria: string; nome: string }> = JSON.parse(jsonMatch[0]);
      setItens(parsed.map((p) => ({ categoria: p.categoria, nome: p.nome, preco: '', marcado: true })));
      setPhase('review');
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Falha ao processar.');
      setPhase('input');
    } finally {
      setProcessando(false);
    }
  };

  const toggleItem = (i: number) => {
    setItens((prev) => prev?.map((item, idx) => idx === i ? { ...item, marcado: !item.marcado } : item) ?? null);
  };

  const setPreco = (i: number, v: string) => {
    setItens((prev) => prev?.map((item, idx) => idx === i ? { ...item, preco: v.replace(/[^\d.,]/g, '') } : item) ?? null);
  };

  if (phase === 'processing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Bot className="h-10 w-10 text-[#38B000] animate-spin" />
        <div>
          <p className="text-base font-bold text-[#F2F7F3]">A IA Ária está estruturando seu cardápio...</p>
          <p className="mt-1 text-xs text-[#8FA396]">Analisando itens, categorias e sugestões de preços.</p>
        </div>
      </div>
    );
  }

  if (phase === 'review' && itens) {
    const marcados = itens.filter((i) => i.marcado);
    const categorias = [...new Set(itens.map((i) => i.categoria))];

    const toggleCategoria = (catNome: string, marcar: boolean) => {
      setItens((prev) => prev ? prev.map((it) => it.categoria === catNome ? { ...it, marcado: marcar } : it) : null);
    };

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#008000]/40 bg-[#008000]/10 p-3 text-xs text-[#F2F7F3]">
          <div>
            <p className="font-bold text-[#38B000]">A IA identificou {itens.length} itens no cardápio.</p>
            <p className="text-[11px] text-[#8FA396] mt-0.5">Ajuste os valores ou desmarque itens antes de confirmar.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setItens((p) => p ? p.map((it) => ({ ...it, marcado: true })) : null)}
              className="rounded-lg border border-[#008000]/60 bg-[#008000]/20 px-2.5 py-1 text-xs font-bold text-[#38B000] hover:bg-[#008000]/30 transition"
            >
              ✓ Marcar tudo
            </button>
            <button
              type="button"
              onClick={() => setItens((p) => p ? p.map((it) => ({ ...it, marcado: false })) : null)}
              className="rounded-lg border border-[#16301F] bg-[#06100A] px-2.5 py-1 text-xs font-bold text-[#8FA396] hover:text-white transition"
            >
              Desmarcar tudo
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {categorias.map((cat) => {
            const listCat = itens.filter((it) => it.categoria === cat);
            const todosMarcados = listCat.length > 0 && listCat.every((it) => it.marcado);
            return (
              <div key={cat} className="rounded-2xl border border-[#16301F] bg-[#06100A]/60 p-3">
                <div className="mb-2 flex items-center justify-between border-b border-[#16301F]/60 pb-2">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-[#38B000]">{cat}</p>
                  <button
                    type="button"
                    onClick={() => toggleCategoria(cat, !todosMarcados)}
                    className="rounded-lg border border-[#16301F] bg-[#0B1A10] px-2 py-0.5 text-[11px] font-semibold text-[#008000] hover:bg-[#008000]/10 transition"
                  >
                    {todosMarcados ? 'Desmarcar esta categoria' : '✓ Marcar todos desta categoria'}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {itens.map((item, i) => item.categoria !== cat ? null : (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${item.marcado ? 'border-[#16301F] bg-[#06100A]' : 'border-[#16301F]/40 opacity-40'}`}>
                      <button
                        type="button"
                        onClick={() => toggleItem(i)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${item.marcado ? 'border-[#008000] bg-[#008000] text-[#F2F7F3]' : 'border-[#16301F]'}`}
                      >
                        {item.marcado && <Check className="h-3 w-3 font-bold" />}
                      </button>
                      <span className="flex-1 text-xs text-[#F2F7F3] font-medium">{item.nome}</span>
                      <div className="flex items-center gap-1 text-xs text-[#8FA396]">
                        <span>R$</span>
                        <input
                          value={item.preco}
                          onChange={(e) => setPreco(i, e.target.value)}
                          placeholder="0,00"
                          className="w-20 rounded-lg border border-[#16301F] bg-[#0B1A10] px-2 py-1 text-right text-xs text-[#F2F7F3] focus:border-[#008000] outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <Rodape
          onVoltar={() => setPhase('input')}
          onAvancar={() => onConfirm(marcados)}
          avancarLabel={`Confirmar ${marcados.length} itens`}
          disabled={marcados.length === 0}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo supra="Etapa 4 de 6 · IA Ária" titulo="Descreva seu cardápio em texto livre" sub={`Exemplo: Pratos principais, bebidas, porções e sobremesas da sua casa (${nomeSegmentos}).`} />
      
      <div className="flex-1 flex flex-col min-h-0">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={`Exemplo:\n"Servimos Picanha na Chapa R$ 89,90, X-Tudo Especial R$ 34,90, Porção de Batata Frita Supreme R$ 38,00. Bebidas: Suco de Laranja R$ 12,00, Refrigerante Lata R$ 7,50, Cerveja Heineken R$ 14,90. Sobremesa: Pudim de Leite R$ 14,00."`}
          className="w-full flex-1 resize-none rounded-2xl border border-[#16301F] bg-[#06100A] p-4 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] outline-none focus:border-[#008000]"
        />
        <p className="mt-1 text-right text-[10px] text-[#8FA396]">{texto.length} caracteres</p>
      </div>

      {erro && <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300">{erro}</p>}

      <Rodape onVoltar={onBack} onAvancar={() => void processar()} loading={processando} disabled={texto.trim().length < 10} avancarLabel="Processar com IA Ária" />
    </div>
  );
}

// ─── Etapa 4b: Cardápio manual (marcar / eliminar) ─────────────────────────────

function CardapioManual({ segmentoIds, modo, onConfirm, onBack }: {
  segmentoIds: string[]; modo: 'marcar' | 'eliminar';
  onConfirm: (itens: ItemCardapio[]) => void; onBack: () => void;
}) {
  const todosItens = (): ItemCardapio[] => {
    const base: ItemCardapio[] = [];
    segmentoIds.forEach((sid) => {
      const seg = SEGMENTOS.find((s) => s.id === sid);
      if (!seg) return;
      seg.categorias.forEach((cat) => {
        cat.itens.forEach((nome) => {
          if (!base.find((b) => b.categoria === cat.nome && b.nome === nome)) {
            base.push({ categoria: cat.nome, nome, preco: '', marcado: modo === 'eliminar' });
          }
        });
      });
    });
    return base;
  };

  const [itens, setItens] = useState<ItemCardapio[]>(() => todosItens());
  const [busca, setBusca] = useState('');
  const [novoItemNome, setNovoItemNome] = useState<Record<string, string>>({});

  const toggle = (i: number) => setItens((p) => p.map((it, idx) => idx === i ? { ...it, marcado: !it.marcado } : it));
  const setPreco = (i: number, v: string) => setItens((p) => p.map((it, idx) => idx === i ? { ...it, preco: v.replace(/[^\d.,]/g, '') } : it));

  const toggleCategoria = (catNome: string, marcar: boolean) => {
    setItens((prev) => prev.map((it) => it.categoria === catNome ? { ...it, marcado: marcar } : it));
  };

  const adicionarItemCustomizado = (catNome: string) => {
    const nome = (novoItemNome[catNome] || '').trim();
    if (!nome) return;
    setItens((prev) => [...prev, { categoria: catNome, nome, preco: '', marcado: true }]);
    setNovoItemNome((prev) => ({ ...prev, [catNome]: '' }));
  };

  const categorias = [...new Set(itens.map((i) => i.categoria))];
  const termo = busca.toLowerCase();
  const filtrado = termo ? itens.map((it, i) => ({ it, i })).filter(({ it }) => it.nome.toLowerCase().includes(termo) || it.categoria.toLowerCase().includes(termo)) : null;
  const marcados = itens.filter((i) => i.marcado);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo
        supra={`Etapa 4 de 6 · ${modo === 'marcar' ? 'Marcar o que tenho' : 'Eliminar o que não tenho'}`}
        titulo={modo === 'marcar' ? 'Marque os produtos que você comercializa' : 'Desmarque os itens que não possui'}
        sub="Utilize os botões globais ou por categoria para marcar. Se algum produto não estiver na lista, adicione-o no campo 'Incluir item'."
      />

      <div className="shrink-0 mb-3 flex flex-wrap gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar item no catálogo..."
          className="flex-1 rounded-xl border border-[#16301F] bg-[#06100A] px-3 py-2 text-xs text-[#F2F7F3] outline-none focus:border-[#008000]"
        />
        <button
          type="button"
          onClick={() => setItens((p) => p.map((it) => ({ ...it, marcado: true })))}
          className="rounded-xl border border-[#008000]/60 bg-[#008000]/10 px-3 py-2 text-xs font-bold text-[#38B000] hover:bg-[#008000]/20 transition"
        >
          ✓ Marcar todos os produtos
        </button>
        <button
          type="button"
          onClick={() => setItens((p) => p.map((it) => ({ ...it, marcado: false })))}
          className="rounded-xl border border-[#16301F] bg-[#06100A] px-3 py-2 text-xs font-bold text-[#8FA396] hover:text-[#F2F7F3] transition"
        >
          Desmarcar todos
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {(filtrado
          ? [{ cat: 'Resultados', list: filtrado }]
          : categorias.map((cat) => ({ cat, list: itens.map((it, i) => ({ it, i })).filter(({ it }) => it.categoria === cat) }))
        ).map(({ cat, list }) => {
          const todosMarcadosNaCat = list.length > 0 && list.every(({ it }) => it.marcado);
          return (
            <div key={cat} className="rounded-2xl border border-[#16301F] bg-[#06100A]/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#16301F]/60 pb-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#38B000]">{cat}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleCategoria(cat, !todosMarcadosNaCat)}
                    className="rounded-lg border border-[#16301F] bg-[#0B1A10] px-2.5 py-1 text-[11px] font-semibold text-[#008000] hover:bg-[#008000]/10 transition"
                  >
                    {todosMarcadosNaCat ? 'Desmarcar esta categoria' : '✓ Marcar todos desta categoria'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {list.map(({ it, i }) => (
                  <div key={i} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${it.marcado ? 'border-[#16301F] bg-[#06100A]' : 'border-[#16301F]/40 opacity-40'}`}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${it.marcado ? 'border-[#008000] bg-[#008000] text-[#F2F7F3]' : 'border-[#16301F]'}`}
                    >
                      {it.marcado && <Check className="h-3 w-3 font-bold" />}
                    </button>
                    <span className="flex-1 text-xs text-[#F2F7F3] font-medium">{it.nome}</span>
                    <div className="flex items-center gap-1 text-xs text-[#8FA396]">
                      <span>R$</span>
                      <input
                        value={it.preco}
                        onChange={(e) => setPreco(i, e.target.value)}
                        placeholder="0,00"
                        className="w-20 rounded-lg border border-[#16301F] bg-[#0B1A10] px-2 py-1 text-right text-xs text-[#F2F7F3] focus:border-[#008000] outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Incluir produto extra na categoria se não estiver na lista */}
              {cat !== 'Resultados' && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    value={novoItemNome[cat] || ''}
                    onChange={(e) => setNovoItemNome({ ...novoItemNome, [cat]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') adicionarItemCustomizado(cat);
                    }}
                    placeholder={`Adicionar produto que não está na lista de ${cat}...`}
                    className="flex-1 rounded-xl border border-dashed border-[#16301F] bg-[#0B1A10] px-3 py-1.5 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] outline-none focus:border-[#008000]"
                  />
                  <button
                    type="button"
                    onClick={() => adicionarItemCustomizado(cat)}
                    className="flex items-center gap-1 rounded-xl border border-[#16301F] bg-[#06100A] px-3 py-1.5 text-xs font-bold text-[#38B000] hover:bg-[#008000]/10 transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Incluir
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Rodape onVoltar={onBack} onAvancar={() => onConfirm(marcados)} disabled={marcados.length === 0} avancarLabel={`Confirmar ${marcados.length} itens`} />
    </div>
  );
}

// ─── Etapa 5: Equipe ────────────────────────────────────────────────────────────

function EtapaEquipe({ onNext, onBack }: { onNext: (membros: Membro[]) => void; onBack: () => void }) {
  const [membros, setMembros] = useState<Membro[]>([novoMembro()]);
  const [ativo, setAtivo] = useState(0);

  const atual = membros[ativo];
  const patch = (campos: Partial<Membro>) =>
    setMembros((lista) => lista.map((m, i) => i === ativo ? { ...m, ...campos } : m));
  const aplicarPerfil = (perfilId: string) =>
    patch({ perfil: perfilId, recursos: [...(PERFIS_PRONTOS[perfilId]?.recursos ?? [])] });

  const adicionar = () => { setMembros((l) => [...l, novoMembro()]); setAtivo(membros.length); };
  const remover = (i: number) => { if (membros.length === 1) return; setMembros((l) => l.filter((_, idx) => idx !== i)); setAtivo((a) => (a >= i && a > 0 ? a - 1 : a)); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Titulo supra="Etapa 5 de 6" titulo="Cadastrar Equipe & Colaboradores" sub="Adicione os colaboradores iniciais e selecione seus respectivos cargos." />

      <div className="flex-1 overflow-y-auto pr-1 grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#8FA396]">Equipe ({membros.length})</p>
            <div className="space-y-1.5">
              {membros.map((m, i) => {
                const perf = PERFIS_PRONTOS[m.perfil] || PERFIS_PRONTOS.atendente;
                const IconComp = perf.icon;
                return (
                  <div key={m.uid} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${i === ativo ? 'border-[#008000] bg-[#008000]/10' : 'border-[#16301F] bg-[#0B1A10]'}`}>
                    <button type="button" onClick={() => setAtivo(i)} className="flex-1 text-left">
                      <p className="truncate text-xs font-bold text-[#F2F7F3]">{m.nome || 'Novo Colaborador'}</p>
                      <span className="flex items-center gap-1 text-[10px] text-[#38B000]">
                        <IconComp className="h-3 w-3" /> {perf.label}
                      </span>
                    </button>
                    {membros.length > 1 && (
                      <button type="button" onClick={() => remover(i)} className="text-[#8FA396] hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={adicionar}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#16301F] py-2 text-xs font-bold text-[#38B000] hover:border-[#008000]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Membro
            </button>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#F2F7F3] flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#38B000]" /> Dados do Colaborador
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-[#8FA396] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={atual?.nome || ''}
                  onChange={(e) => patch({ nome: e.target.value })}
                  placeholder="Ex: João da Silva"
                  className="w-full rounded-xl border border-[#16301F] bg-[#0B1A10] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#8FA396] mb-1">PIN Numérico de Acesso *</label>
                <input
                  type="text"
                  maxLength={6}
                  value={atual?.pin || ''}
                  onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="Ex: 1111"
                  className="w-full rounded-xl border border-[#16301F] bg-[#0B1A10] p-2.5 text-xs font-mono text-[#F2F7F3] focus:border-[#008000] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#16301F] bg-[#06100A] p-4 space-y-3">
            <h4 className="text-xs font-bold text-[#F2F7F3] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#38B000]" /> Cargo / Perfil Operacional
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PERFIS_PRONTOS).map(([id, perfil]) => {
                const IconComp = perfil.icon;
                const isSelected = atual?.perfil === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => aplicarPerfil(id)}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      isSelected ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]' : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F]'
                    }`}
                  >
                    <IconComp className="h-3.5 w-3.5" /> {perfil.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Rodape onVoltar={onBack} onAvancar={() => onNext(membros)} avancarLabel="Confirmar equipe" />
    </div>
  );
}

// ─── Etapa 6: Lançamento ────────────────────────────────────────────────────────

function EtapaLancamento({ unidades, segmentoIds, itens, membros, salvando }: {
  unidades: number; segmentoIds: string[]; itens: ItemCardapio[]; membros: Membro[]; salvando: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 h-full">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#008000]/15 text-[#38B000] border border-[#008000]/40"
      >
        <Rocket className="h-10 w-10 text-[#38B000]" />
      </motion.div>
      <h1 className="text-2xl font-manrope font-black text-[#F2F7F3]">
        Seu MIAR AI / FOOD está pronto!
      </h1>
      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#8FA396]">
        Configurações salvas. Você pode ajustar qualquer detalhe a qualquer momento no Painel de Controle.
      </p>

      <div className="mt-6 grid w-full max-w-sm gap-2.5 text-left">
        {[
          { icon: Store, label: `${unidades} unidade${unidades !== 1 ? 's' : ''}` },
          { icon: UtensilsCrossed, label: `${segmentoIds.length} segmento(s) configurado(s)` },
          { icon: ClipboardList, label: `${itens.length} item(ns) no cardápio` },
          { icon: Users, label: `${membros.length} colaborador(es) na equipe` },
        ].map(({ icon: IconComp, label }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2.5">
            <IconComp className="h-4 w-4 text-[#38B000]" />
            <span className="text-xs text-[#F2F7F3] font-medium">{label}</span>
            <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />
          </div>
        ))}
      </div>

      {salvando && (
        <div className="mt-6 flex items-center gap-2 text-xs text-[#38B000]">
          <Loader2 className="h-4 w-4 animate-spin" /> Finalizando sincronização do sistema...
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ───────────────────────────────────────────────────────

export default function JornadaConfiguracao() {
  const [, setLocation] = useLocation();
  const [etapa, setEtapa] = useState<Etapa>('unidades');

  const [unidades, setUnidades] = useState<number>(1);
  const [segmentoIds, setSegmentoIds] = useState<string[]>([]);
  const [modo, setModo] = useState<ModoCardapio>('ia');
  const [itensCardapio, setItensCardapio] = useState<ItemCardapio[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [salvando, setSalvando] = useState(false);

  const ir = (prox: Etapa) => { setEtapa(prox); };

  const salvarTudo = async (membrosFinais: Membro[], itensFinais: ItemCardapio[]) => {
    setSalvando(true);
    ir('lancamento');
    try {
      if (itensFinais.length > 0) {
        const catalogFormatted = itensFinais.map((it, idx) => ({
          id: `cat-${idx}-${Date.now()}`,
          name: it.nome,
          description: `Item cadastrado para ${segmentoIds[0] || 'o estabelecimento'}`,
          price: it.preco ? Number(it.preco.replace(',', '.')) : 0,
          category: it.categoria,
          available: true,
          prepTime: 15,
        }));
        window.localStorage.setItem('miar-catalog-products', JSON.stringify(catalogFormatted));

        await fetch('/api/onboarding/estabelecimento', {
          method: 'POST',
          headers: authH(),
          body: JSON.stringify({
            segmentId: segmentoIds[0] ?? 'outros',
            features: [],
            items: itensFinais.map((it) => ({
              category: it.categoria,
              name: it.nome,
              price: it.preco ? Number(it.preco.replace(',', '.')) : null,
            })),
          }),
        });
      }

      const validos = membrosFinais.filter((m) => m.nome.trim() && m.pin.trim());
      if (validos.length > 0) {
        const employeesFormatted = validos.map((m, idx) => ({
          id: `emp-${idx}-${Date.now()}`,
          name: m.nome,
          role: m.perfil,
          username: m.email || m.nome.toLowerCase().replace(/\s+/g, '.'),
          pin: m.pin,
          active: true,
        }));
        window.localStorage.setItem('miar-cached-employees', JSON.stringify(employeesFormatted));

        await fetch('/api/employees/bulk', {
          method: 'POST',
          headers: authH(),
          body: JSON.stringify({
            employees: validos.map((m) => ({
              name: m.nome, email: m.email || null,
              phone: m.telefone || null, pin: m.pin,
              role: m.perfil, permissions: m.recursos,
            })),
          }),
        });
      }
    } catch { }
    finally {
      window.localStorage.setItem('miar-onboarding-completed', 'true');
      window.localStorage.removeItem('miar-first-access');
      setSalvando(false);
    }
    setTimeout(() => setLocation('/app/mesas'), 1800);
  };

  const handlePular = () => {
    toast.info('Configuração pausada. Faça login para acessar sua conta.');
    setLocation('/login');
  };

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col justify-between overflow-hidden bg-[#0B1A10] p-4 sm:p-6 rounded-3xl border border-[#16301F] text-[#F2F7F3] font-inter">
      {/* Header bar & Progress bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-[#16301F] pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-manrope text-[10px] font-extrabold uppercase tracking-widest text-[#38B000]">
            ONBOARDING INTELIGENTE
          </span>
          <span className="rounded-full bg-[#06100A] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#008000] border border-[#16301F]">
            Passo {ETAPAS.findIndex((e) => e.id === etapa) + 1} de {ETAPAS.length}
          </span>
        </div>
        <button
          onClick={handlePular}
          className="rounded-xl border border-[#16301F] bg-[#06100A] px-3.5 py-1.5 text-xs font-bold text-[#8FA396] hover:text-[#F2F7F3] transition"
        >
          Pular para o app →
        </button>
      </div>

      <ProgressoBar etapa={etapa} />

      {/* Main Content Box with strictly internal scrolling */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {etapa === 'unidades' && (
          <EtapaUnidades onNext={(n) => { setUnidades(n); ir('segmentos'); }} />
        )}
        {etapa === 'segmentos' && (
          <EtapaSegmentos onNext={(ids) => { setSegmentoIds(ids); ir('modo'); }} onBack={() => ir('unidades')} />
        )}
        {etapa === 'modo' && (
          <EtapaModo onNext={(m) => { setModo(m); ir('cardapio'); }} onBack={() => ir('segmentos')} />
        )}
        {etapa === 'cardapio' && modo === 'ia' && (
          <CardapioIA
            segmentoIds={segmentoIds}
            onConfirm={(itens) => { setItensCardapio(itens); ir('equipe'); }}
            onBack={() => ir('modo')}
          />
        )}
        {etapa === 'cardapio' && modo !== 'ia' && (
          <CardapioManual
            segmentoIds={segmentoIds}
            modo={modo}
            onConfirm={(itens) => { setItensCardapio(itens); ir('equipe'); }}
            onBack={() => ir('modo')}
          />
        )}
        {etapa === 'equipe' && (
          <EtapaEquipe
            onNext={(m) => { setMembros(m); void salvarTudo(m, itensCardapio); }}
            onBack={() => ir('cardapio')}
          />
        )}
        {etapa === 'lancamento' && (
          <EtapaLancamento
            unidades={unidades}
            segmentoIds={segmentoIds}
            itens={itensCardapio}
            membros={membros}
            salvando={salvando}
          />
        )}
      </div>
    </div>
  );
}
