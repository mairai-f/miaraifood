// artifacts/gestor/src/pages/onboarding-produtos.tsx
// Tela de onboarding: escolha de como cadastrar produtos/cardápio.
import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Database, PenLine, Bot, Clock, X, Pizza, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { compressDishPhoto } from '../lib/image-compression';

function completeOnboarding() {
  window.localStorage.setItem('miar-passkey-after-onboarding', '1');
}

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

// Mesmos campos usados em catalogo.tsx (POST /api/menu/items) — o produto
// cadastrado aqui no onboarding é o mesmo cardápio que aparece depois em
// catalogo.tsx e no artifacts/qrmenu (via MenuItem.imageUrl).
type NovoProdutoForm = {
  name: string;
  category: string;
  price: string;
  description: string;
  imageUrl: string;
};

const CATEGORIAS_PRODUTO = ['Hambúrgueres', 'Pizzas', 'Pratos', 'Bebidas', 'Sucos', 'Sobremesas', 'Porções', 'Geral'];

const FORM_VAZIO: NovoProdutoForm = { name: '', category: 'Hambúrgueres', price: '', description: '', imageUrl: '' };

export default function OnboardingProdutos() {
  const [, setLocation] = useLocation();
  const [aplicandoPreset, setAplicandoPreset] = useState(false);
  const [erroPreset, setErroPreset] = useState<string | null>(null);

  // Cadastro Manual (com foto) — modal aberto pela opção "Fazer manualmente".
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState<NovoProdutoForm>(FORM_VAZIO);
  const [manualPhotoError, setManualPhotoError] = useState('');
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [produtosCadastrados, setProdutosCadastrados] = useState<{ id: string; name: string; imageUrl?: string }[]>([]);

  const onPickManualPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setManualPhotoError('');
    try {
      const dataUrl = await compressDishPhoto(file);
      setManualForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch (err: unknown) {
      setManualPhotoError(err instanceof Error ? err.message : 'Não foi possível processar a imagem.');
    }
  };

  const handleCreateManualProduct = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(manualForm.price.replace(',', '.'));
    if (!manualForm.name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Preencha o nome e um preço válido.');
      return;
    }

    const payload = {
      name: manualForm.name.trim(),
      category: manualForm.category,
      price: priceNum,
      description: manualForm.description.trim(),
      imageUrl: manualForm.imageUrl || undefined,
    };

    setSalvandoProduto(true);
    try {
      const r = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      const created = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(created?.error ?? 'Não foi possível cadastrar o produto.');
      }
      setProdutosCadastrados((prev) => [
        { id: created.id ?? `local-${Date.now()}`, name: created.name ?? payload.name, imageUrl: created.imageUrl ?? payload.imageUrl },
        ...prev,
      ]);
      toast.success(`Produto "${payload.name}" cadastrado!`);
      setManualForm(FORM_VAZIO);
      setManualPhotoError('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar o produto.');
    } finally {
      setSalvandoProduto(false);
    }
  };

  const finalizarCadastroManual = () => {
    completeOnboarding();
    setIsManualModalOpen(false);
    setLocation('/estoque');
  };

  const aplicarModeloEstoque = async () => {
    setAplicandoPreset(true);
    setErroPreset(null);
    try {
      const segmentId = window.localStorage.getItem('miar-onboarding-segment-id');
      if (!segmentId) {
        setLocation('/estoque');
        return;
      }
      const response = await fetch('/api/onboarding/apply-preset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.localStorage.getItem('miar-owner-token') ?? ''}`,
        },
        body: JSON.stringify({ segmentId, replace: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível aplicar o modelo de estoque.');
      }
      window.localStorage.removeItem('miar-onboarding-segment-id');
      completeOnboarding();
      setLocation('/estoque');
    } catch (error: unknown) {
      setErroPreset(error instanceof Error ? error.message : 'Não foi possível aplicar o modelo de estoque.');
    } finally {
      setAplicandoPreset(false);
    }
  };

  const opcoes = [
    {
      id: 'estoque',
      icon: Database,
      titulo: 'Usar modelo de estoque do sistema',
      descricao:
        'Importamos os itens típicos do seu segmento como ponto de partida. Você ajusta nomes, preços e categorias depois.',
      cor: 'violet',
      acao: () => void aplicarModeloEstoque(),
    },
    {
      id: 'manual',
      icon: PenLine,
      titulo: 'Fazer manualmente',
      descricao:
        'Cadastre cada produto na hora, digitando nome, preço, categoria e foto do prato. Bom para quem já tem a lista pronta.',
      cor: 'blue',
      acao: () => setIsManualModalOpen(true),
    },
    {
      id: 'ia',
      icon: Bot,
      titulo: 'Fazer através da IA ao vivo',
      descricao:
        'A MIAR conversa com você por voz ou texto e monta o cardápio enquanto você fala. Leva menos de 5 minutos.',
      cor: 'emerald',
      acao: () => { completeOnboarding(); setLocation('/mia'); },
    },
    {
      id: 'depois',
      icon: Clock,
      titulo: 'Fazer depois',
      descricao:
        'Pule o cadastro de produtos por enquanto. Faça login para acessar sua conta.',
      cor: 'slate',
      acao: () => {
        toast.info('Cadastro pausado. Faça login para acessar sua conta.');
        setLocation('/login');
      },
    },
  ];

  const corClasses: Record<string, { borda: string; bg: string; icone: string; badge: string; }> = {
    violet: {
      borda: 'border-violet-500/40 hover:border-violet-400/70',
      bg: 'hover:bg-violet-500/[0.06]',
      icone: 'bg-violet-500/15 text-violet-400',
      badge: 'bg-violet-500/20 text-violet-300',
    },
    blue: {
      borda: 'border-blue-500/40 hover:border-blue-400/70',
      bg: 'hover:bg-blue-500/[0.06]',
      icone: 'bg-blue-500/15 text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300',
    },
    emerald: {
      borda: 'border-emerald-500/40 hover:border-emerald-400/70',
      bg: 'hover:bg-emerald-500/[0.06]',
      icone: 'bg-emerald-500/15 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300',
    },
    slate: {
      borda: 'border-slate-700 hover:border-slate-600',
      bg: 'hover:bg-slate-800/40',
      icone: 'bg-slate-700 text-slate-400',
      badge: 'bg-slate-700 text-slate-400',
    },
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={() => setLocation('/onboarding/estabelecimento')}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-violet-400">
            Passo 3
          </p>
          <h1 className="mt-2 text-3xl font-bold">Como quer cadastrar os produtos?</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Seu cardápio e estoque precisam de produtos para funcionar. Escolha o caminho que
            funciona melhor pra você agora.
          </p>
        </header>

        <div className="space-y-3">
          {opcoes.map((op) => {
            const c = corClasses[op.cor];
            const Icon = op.icon;
            return (
              <button
                key={op.id}
                type="button"
                onClick={op.acao}
                disabled={aplicandoPreset}
                aria-busy={op.id === 'estoque' && aplicandoPreset}
                className={`w-full rounded-2xl border ${c.borda} bg-slate-900/60 ${c.bg} p-5 text-left transition-all duration-150 disabled:cursor-wait disabled:opacity-60`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.icone}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-slate-100">
                      {op.id === 'estoque' && aplicandoPreset ? 'Aplicando modelo de estoque…' : op.titulo}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{op.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {erroPreset && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {erroPreset}
          </p>
        )}
      </div>

      {/* MODAL: Cadastro Manual de Produtos (com foto) — reaproveita o mesmo
          endpoint POST /api/menu/items e o mesmo helper de compressão de foto
          (compressDishPhoto) usados em catalogo.tsx, pra que o produto
          cadastrado aqui já apareça com foto no catálogo e no QR Menu. */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Cadastrar Produtos</h3>
                <p className="text-xs text-slate-400">Adicione quantos produtos quiser. Você pode ajustar tudo depois em Cardápio.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualProduct} className="flex-1 flex flex-col overflow-hidden pt-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={manualForm.name}
                    onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                    placeholder="Ex: Burger Bacon Supreme"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Categoria *</label>
                    <select
                      value={manualForm.category}
                      onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                    >
                      {CATEGORIAS_PRODUTO.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Preço (R$) *</label>
                    <input
                      type="text"
                      required
                      value={manualForm.price}
                      onChange={(e) => setManualForm({ ...manualForm, price: e.target.value })}
                      placeholder="Ex: 34.90"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                    placeholder="Descreva os ingredientes e detalhes do prato..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Foto do Prato</label>
                  <div className="flex items-center gap-3">
                    <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-700 bg-slate-950 text-slate-400 transition hover:border-violet-500">
                      {manualForm.imageUrl ? (
                        <img src={manualForm.imageUrl} alt="Foto do prato" className="h-full w-full object-cover" />
                      ) : (
                        <Pizza className="h-6 w-6" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={onPickManualPhoto} />
                    </label>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-slate-400">JPG ou PNG, até 8MB. A imagem é redimensionada automaticamente.</p>
                      {manualForm.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setManualForm({ ...manualForm, imageUrl: '' })}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300"
                        >
                          Remover foto
                        </button>
                      )}
                      {manualPhotoError && <p className="text-[10px] text-red-400">{manualPhotoError}</p>}
                    </div>
                  </div>
                </div>

                {produtosCadastrados.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Já cadastrados nesta sessão ({produtosCadastrados.length}):
                    </p>
                    <ul className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {produtosCadastrados.map((p) => (
                        <li key={p.id} className="flex items-center gap-2 text-xs text-slate-200">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="h-6 w-6 rounded object-cover border border-slate-700" />
                          ) : (
                            <Pizza className="h-4 w-4 text-slate-500" />
                          )}
                          {p.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="shrink-0 pt-4 border-t border-slate-800 flex items-center justify-between gap-3 mt-2">
                <button
                  type="button"
                  onClick={finalizarCadastroManual}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-slate-100"
                >
                  {produtosCadastrados.length > 0 ? 'Concluir cadastro' : 'Pular por enquanto'}
                </button>
                <button
                  type="submit"
                  disabled={salvandoProduto}
                  className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {salvandoProduto ? 'Salvando...' : 'Adicionar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
