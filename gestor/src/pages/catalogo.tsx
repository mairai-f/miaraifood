import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Grid3X3,
  List,
  Volume2,
  CheckCircle2,
  Clock,
  Tag,
  X,
  PlusCircle,
  UtensilsCrossed,
  Pizza,
  Beer,
  CupSoda,
  Beef,
  Fish,
  Coffee,
  Package,
  IceCreamCone,
  Pencil,
  Trash2,
  Save,
  AlertTriangle,
  ScanBarcode,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/IdiomaContext";
import { compressDishPhoto } from "../lib/image-compression";

type Adicional = { id: string; label: string; priceCents?: number };

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  prepTime: number;
  imageUrl?: string;
  barcode?: string;
  adicionais?: Adicional[];
};

const DEFAULT_CATEGORIES = ['Todos', 'Hambúrgueres', 'Pizzas', 'Pratos', 'Bebidas', 'Sucos', 'Sobremesas', 'Porções'];

// Adicionais/extras opcionais do prato — aparecem como checkbox pro cliente
// no QR Menu e no app Cliente, na hora de adicionar ao carrinho.
function AdicionaisEditor({ items, onChange }: { items: Adicional[]; onChange: (next: Adicional[]) => void }) {
  const [label, setLabel] = useState('');
  const [price, setPrice] = useState('');

  const add = () => {
    if (!label.trim()) return;
    const priceNum = parseFloat(price.replace(',', '.'));
    onChange([
      ...items,
      { id: `ad-${Date.now()}`, label: label.trim(), priceCents: Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) : undefined },
    ]);
    setLabel('');
    setPrice('');
  };

  const remove = (id: string) => onChange(items.filter((a) => a.id !== id));

  return (
    <div>
      <label className="block text-xs font-bold text-[#8FA396] mb-1">Adicionais (opcional)</label>
      <p className="text-[10px] text-[#7A8F7E] mb-2">
        Aparecem como checkbox pro cliente no cardápio digital (ex: "Bacon extra", "Queijo a mais").
      </p>
      {items.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {items.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-[#16301F] bg-[#06100A] px-2.5 py-1.5">
              <span className="text-xs text-[#F2F7F3]">
                {a.label} {a.priceCents ? <span className="text-[#38B000]">+ R$ {(a.priceCents / 100).toFixed(2)}</span> : null}
              </span>
              <button type="button" onClick={() => remove(a.id)} className="text-[10px] font-bold text-rose-400 hover:underline">
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome do adicional"
          className="flex-1 rounded-xl border border-[#16301F] bg-[#06100A] p-2 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="R$ (opcional)"
          className="w-24 rounded-xl border border-[#16301F] bg-[#06100A] p-2 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
        />
        <button type="button" onClick={add} className="rounded-xl bg-[#16301F] px-3 text-xs font-bold text-[#38B000] hover:bg-[#004b8f]">
          + Add
        </button>
      </div>
    </div>
  );
}

export default function Catalogo() {
  const { t } = useTranslation();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // New Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    category: 'Hambúrgueres',
    price: '',
    prepTime: '15',
    description: '',
    imageUrl: '',
    barcode: '',
  });
  const [newPhotoError, setNewPhotoError] = useState('');
  const [newAdicionais, setNewAdicionais] = useState<Adicional[]>([]);

  // Edit Product Modal State
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'Hambúrgueres',
    price: '',
    prepTime: '15',
    description: '',
    imageUrl: '',
    barcode: '',
  });
  const [editPhotoError, setEditPhotoError] = useState('');
  const [editAdicionais, setEditAdicionais] = useState<Adicional[]>([]);

  // Sensitive Operation Confirmation Modal State (Exclusão)
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<CatalogItem | null>(null);

  // Lock body overflow when any modal is open
  useEffect(() => {
    if (isAddModalOpen || editingItem || deleteConfirmItem) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAddModalOpen, editingItem, deleteConfirmItem]);

  // Save items state & update categories
  const saveItems = (newItems: CatalogItem[]) => {
    setItems(newItems);
    const uniqueCats = ['Todos', ...new Set(newItems.map((i) => i.category))];
    setCategories(uniqueCats);
  };

  const loadMenuRealtime = () => {
    fetch('/api/menu/items', {
      headers: { Authorization: `Bearer ${window.localStorage.getItem('miar-owner-token') ?? ''}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped: CatalogItem[] = data.map((d: any, idx: number) => ({
            id: d.id || `m-api-${idx}`,
            name: d.name,
            description: d.description || '',
            price: Number(d.price) || 0,
            category: d.category || 'Geral',
            available: d.available ?? true,
            prepTime: d.prepTime ?? 15,
            imageUrl: d.imageUrl || undefined,
            adicionais: d.adicionais || undefined,
          }));
          saveItems(mapped);
        }
      })
      .catch(() => {});
  };

  // Load catalog items in realtime from database (2s polling)
  useEffect(() => {
    loadMenuRealtime();
    const interval = setInterval(loadMenuRealtime, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check user permissions for editing/deleting products
  const userRole = (window.localStorage.getItem('miar-current-user-role') || 'owner').toLowerCase();
  const token = window.localStorage.getItem('miar-owner-token') ?? '';
  const userPermissionsRaw = window.localStorage.getItem('miar-current-user-permissions');

  const isAuthorizedToEdit = useMemo(() => {
    if (!token || token.startsWith('admin-') || token === 'dev-bypass') return true;
    if (['owner', 'admin', 'manager', 'gestor', 'socio'].includes(userRole)) return true;
    if (userPermissionsRaw) {
      try {
        const perms = JSON.parse(userPermissionsRaw);
        return Array.isArray(perms) && (perms.includes('cardapio') || perms.includes('configuracoes'));
      } catch {
        return false;
      }
    }
    return true;
  }, [token, userRole, userPermissionsRaw]);

  // Voice Synthesis with Ária IA
  const speakItemWithIA = (item: CatalogItem) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(item.id);
      const text = `${item.name}. ${item.description || ''}. Preço: R$ ${item.price.toFixed(2)}. Tempo de preparo: ${item.prepTime} minutos.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      toast.info(`IA Ária apresentando: "${item.name}"`);
    } else {
      toast.error("Síntese de voz não suportada pelo seu navegador.");
    }
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !query || `${item.name} ${item.description}`.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "Todos" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, items, search]);

  // Paginação — nota importante: hoje é só client-side, porque GET
  // /menu/items ainda devolve a lista inteira num único request (não tem
  // LIMIT/OFFSET real no backend). Isso já evita renderizar centenas de
  // cards de uma vez na tela, mas pra "nunca puxar tudo do banco" de
  // verdade, precisa de paginação no backend também — não é esse o escopo
  // desta mudança, fica registrado como próximo passo real.
  const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
  const [pageSize, setPageSize] = useState<number | 'todos'>(10);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, categoryFilter, pageSize]);
  const totalPages = pageSize === 'todos' ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = useMemo(() => {
    if (pageSize === 'todos') return filteredItems;
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedToEdit) {
      toast.error('🔒 Ação Restrita: Você não possui permissão de acesso para cadastrar produtos.');
      return;
    }
    const priceNum = parseFloat(newForm.price.replace(',', '.'));
    if (!newForm.name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Preencha o nome e um preço válido.');
      return;
    }

    const payload = {
      name: newForm.name.trim(),
      category: newForm.category,
      price: priceNum,
      prepTime: Number.isFinite(parseInt(newForm.prepTime, 10)) ? parseInt(newForm.prepTime, 10) : 15, // "0" digitado = pronto na hora, não deve virar 15
      description: newForm.description.trim(),
      imageUrl: newForm.imageUrl || undefined,
      barcode: newForm.barcode.trim() || undefined,
      adicionais: newAdicionais.length > 0 ? newAdicionais : undefined,
    };

    let newItem: CatalogItem = { id: `item-${Date.now()}`, ...payload, available: true };
    try {
      const r = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const created = await r.json();
        newItem = {
          id: created.id ?? newItem.id,
          name: created.name ?? newItem.name,
          category: created.category ?? newItem.category,
          price: Number(created.price ?? newItem.price),
          prepTime: created.prepTime ?? newItem.prepTime,
          description: created.description ?? newItem.description,
          available: created.available ?? true,
          imageUrl: created.imageUrl || undefined,
          adicionais: created.adicionais ?? payload.adicionais,
        };
      }
    } catch {
      // Sem conexão com a API: o produto ainda fica salvo localmente abaixo.
    }

    saveItems([newItem, ...items]);
    toast.success(`Produto "${newItem.name}" cadastrado com sucesso!`);
    setIsAddModalOpen(false);
    setNewForm({ name: '', category: 'Hambúrgueres', price: '', prepTime: '15', description: '', imageUrl: '', barcode: '' });
    setNewAdicionais([]);
    setNewPhotoError('');
  };

  const onPickNewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNewPhotoError('');
    try {
      const dataUrl = await compressDishPhoto(file);
      setNewForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch (err: any) {
      setNewPhotoError(err?.message || 'Não foi possível processar a imagem.');
    }
  };

  const onPickEditPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEditPhotoError('');
    try {
      const dataUrl = await compressDishPhoto(file);
      setEditForm((f) => ({ ...f, imageUrl: dataUrl }));
    } catch (err: any) {
      setEditPhotoError(err?.message || 'Não foi possível processar a imagem.');
    }
  };

  // Open Edit Modal with exact values of selected item
  const handleOpenEditModal = (item: CatalogItem) => {
    if (!isAuthorizedToEdit) {
      toast.error('🔒 Ação Restrita: Sem permissão para editar produtos.');
      return;
    }
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category || 'Hambúrgueres',
      price: item.price.toString(),
      prepTime: (item.prepTime ?? 15).toString(),
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      barcode: item.barcode || '',
    });
    setEditAdicionais(item.adicionais ?? []);
    setEditPhotoError('');
  };

  // Save Edit Product Changes
  const handleSaveEditProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!isAuthorizedToEdit) {
      toast.error('🔒 Ação Restrita: Sem permissão para editar produtos.');
      return;
    }

    const priceNum = parseFloat(editForm.price.replace(',', '.'));
    if (!editForm.name.trim() || isNaN(priceNum) || priceNum <= 0) {
      toast.error('Preencha o nome e um preço válido.');
      return;
    }

    const patch = {
      name: editForm.name.trim(),
      category: editForm.category,
      price: priceNum,
      prepTime: Number.isFinite(parseInt(editForm.prepTime, 10)) ? parseInt(editForm.prepTime, 10) : 15, // "0" digitado = pronto na hora, não deve virar 15
      description: editForm.description.trim(),
      imageUrl: editForm.imageUrl || null,
      barcode: editForm.barcode.trim() || null,
      adicionais: editAdicionais,
    };

    try {
      await fetch(`/api/menu/items/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
    } catch {
      // Sem conexão com a API: a alteração ainda fica salva localmente abaixo.
    }

    const updatedItems = items.map((i) =>
      i.id === editingItem.id ? { ...i, ...patch, imageUrl: patch.imageUrl || undefined, barcode: patch.barcode || undefined } : i
    );

    saveItems(updatedItems);
    toast.success(`Produto "${editForm.name}" atualizado com sucesso!`);
    setEditingItem(null);
  };

  // Trigger System Modal for Sensitive Operation (Delete)
  const requestDeleteProduct = (item: CatalogItem) => {
    if (!isAuthorizedToEdit) {
      toast.error('🔒 Ação Restrita: Sem permissão para excluir produtos.');
      return;
    }
    setDeleteConfirmItem(item);
  };

  // Confirm Delete Product execution
  const confirmDeleteProduct = async () => {
    if (!deleteConfirmItem) return;
    try {
      await fetch(`/api/menu/items/${deleteConfirmItem.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    const updatedItems = items.filter((i) => i.id !== deleteConfirmItem.id);
    saveItems(updatedItems);
    toast.success(`Produto "${deleteConfirmItem.name}" excluído com sucesso.`);
    setDeleteConfirmItem(null);
  };

  return (
    <div className="space-y-6 select-none font-inter text-[#F2F7F3]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#008000]/10 text-[#38B000] border border-[#008000]/30 font-manrope">
              <BookOpen className="h-3 w-3 text-[#38B000]" /> {t('catalogo.titulo')} & Apresentação com IA
            </span>
          </div>
          <h1 className="text-2xl font-manrope font-black text-[#F2F7F3] mt-1 flex items-center gap-2">
            {t('catalogo.titulo')}
          </h1>
          <p className="text-xs text-[#8FA396]">
            {t('catalogo.subtitulo')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAuthorizedToEdit && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)]"
            >
              <Plus className="h-4 w-4" />
              {t('catalogo.novo_produto')}
            </button>
          )}
        </div>
      </div>

      {/* Filter & View Controls */}
      <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-3.5 space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8FA396]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                // Leitor de código de barras (USB/Bluetooth) "digita" o
                // código nesse mesmo campo de busca e manda Enter sozinho —
                // se bater exato com o barcode de um produto, abre editar
                // na hora em vez de só filtrar a lista.
                if (e.key !== 'Enter') return;
                const scanned = search.trim();
                if (!scanned) return;
                const match = items.find((i) => i.barcode && i.barcode === scanned);
                if (match) {
                  e.preventDefault();
                  handleOpenEditModal(match);
                  setSearch('');
                } else if (/^\d{6,}$/.test(scanned) && isAuthorizedToEdit) {
                  // Parece um código de barras (só dígitos, 6+), mas nenhum
                  // produto tem esse código ainda — oferece cadastrar novo já
                  // com o código preenchido, em vez de só mostrar "0 resultados".
                  e.preventDefault();
                  setNewForm({ name: '', category: 'Hambúrgueres', price: '', prepTime: '15', description: '', imageUrl: '', barcode: scanned });
                  setIsAddModalOpen(true);
                  setSearch('');
                  toast.info(`Código ${scanned} não encontrado — cadastre o novo produto.`);
                }
              }}
              placeholder={`${t('catalogo.buscar_placeholder')} ou escaneie o código de barras`}
              className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2 pl-9 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-[#16301F] bg-[#06100A] p-1">
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`rounded-lg p-2 transition ${view === "grid" ? "bg-[#008000] text-[#F2F7F3]" : "text-[#8FA396] hover:text-[#F2F7F3]"}`}
                title={t('catalogo.grade')}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-lg p-2 transition ${view === "list" ? "bg-[#008000] text-[#F2F7F3]" : "text-[#8FA396] hover:text-[#F2F7F3]"}`}
                title={t('catalogo.lista')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                categoryFilter === cat
                  ? "bg-[#008000] text-[#F2F7F3] border-[#008000] shadow-md"
                  : "bg-[#06100A] border-[#16301F] text-[#8FA396] hover:border-[#008000]/50 hover:text-[#F2F7F3]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State when no products exist */}
      {filteredItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#16301F] bg-[#0B1A10]/50 p-12 text-center flex flex-col items-center justify-center space-y-3">
          <UtensilsCrossed className="h-10 w-10 text-[#8FA396]" />
          <h3 className="font-manrope font-bold text-[#F2F7F3]">Nenhum produto cadastrado</h3>
          <p className="text-xs text-[#8FA396] max-w-sm">
            Seu cardápio está limpo. Clique no botão "Novo Produto" acima para cadastrar seu primeiro item real.
          </p>
          {isAuthorizedToEdit && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] transition-all mt-2"
            >
              <Plus className="h-4 w-4" />
              Cadastrar Produto Real
            </button>
          )}
        </div>
      )}

      {/* Product Items Display */}
      <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
        {pagedItems.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-5 flex flex-col justify-between hover:border-[#008000]/50 transition-all shadow-xl group"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover border border-[#16301F]"
                  />
                )}
                <div className="min-w-0">
                  <span className="inline-block text-[9px] font-extrabold text-[#38B000] uppercase tracking-widest bg-[#06100A] px-2 py-1 rounded-md border border-[#16301F]">
                    {item.category}
                  </span>
                  <h3 className="text-base font-manrope font-bold text-[#F2F7F3] mt-2 leading-snug group-hover:text-[#38B000] transition-colors">
                    {item.name}
                  </h3>
                </div>
              </div>

              <p className="mt-3 text-xs text-[#8FA396] leading-relaxed line-clamp-3">
                {item.description || t('catalogo.sem_descricao')}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-[#16301F] flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] text-[#8FA396] block mb-0.5">{t('catalogo.preco_venda')}</span>
                <span className="text-lg font-manrope font-black text-[#38B000] leading-none">
                  R$ {item.price.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8FA396] bg-[#06100A] px-2.5 py-1.5 rounded-lg border border-[#16301F] shrink-0">
                <Clock className="h-3 w-3 text-[#38B000]" />
                {item.prepTime > 0 ? `${item.prepTime} min` : 'Pronto na hora'}
              </div>
            </div>

            {/* Botões de ação — abaixo de preço/tempo, não mais disputando espaço com nome/categoria lá em cima */}
            <div className="pt-3 mt-3 border-t border-[#16301F]/60 flex items-center gap-2">
              <button
                type="button"
                onClick={() => speakItemWithIA(item)}
                title={t('catalogo.apresentacao_ia')}
                className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl border text-[11px] font-semibold transition-all ${
                  speakingId === item.id
                    ? "bg-[#008000] text-[#F2F7F3] border-[#008000] animate-bounce"
                    : "bg-[#06100A] text-[#38B000] border-[#16301F] hover:border-[#008000]"
                }`}
              >
                <Volume2 className="h-4 w-4" />
              </button>

              {/* Action Buttons for Authorized Users */}
              {isAuthorizedToEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    title="Editar Nome, Preço e Detalhes do Produto"
                    className="flex-1 flex items-center justify-center p-2 rounded-xl border border-[#16301F] bg-[#06100A] text-[#38B000] hover:bg-[#008000] hover:text-[#F2F7F3] transition-all"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => requestDeleteProduct(item)}
                    title="Excluir Produto (Operação Sensível)"
                    className="flex-1 flex items-center justify-center p-2 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-600 hover:text-white transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Paginação — client-side por enquanto (ver nota em pagedItems acima) */}
      {filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-[#8FA396]">
            <span>Exibir:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
              className="rounded-lg border border-[#16301F] bg-[#06100A] px-2 py-1.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} em {n}</option>
              ))}
              <option value="todos">Todos</option>
            </select>
            <span>
              {pageSize === 'todos'
                ? `${filteredItems.length} produto${filteredItems.length === 1 ? '' : 's'}`
                : `${Math.min((page - 1) * pageSize + 1, filteredItems.length)}–${Math.min(page * pageSize, filteredItems.length)} de ${filteredItems.length}`}
            </span>
          </div>

          {pageSize !== 'todos' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-[#16301F] bg-[#06100A] px-3 py-1.5 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3] disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span className="text-xs text-[#8FA396] px-2">Página {page} de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-[#16301F] bg-[#06100A] px-3 py-1.5 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3] disabled:opacity-30"
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Cadastrar Novo Produto */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3 shrink-0">
              <div>
                <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3]">{t('catalogo.modal_novo_titulo')}</h3>
                <p className="text-xs text-[#8FA396]">{t('catalogo.modal_novo_subtitulo')}</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateProduct} className="flex-1 flex flex-col overflow-hidden pt-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">{t('catalogo.nome_produto')} *</label>
                  <input
                    type="text"
                    required
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Ex: Burger Bacon Supreme"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Código de barras (opcional)</label>
                  <div className="relative">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#38B000]" />
                    <input
                      type="text"
                      value={newForm.barcode}
                      onChange={(e) => setNewForm({ ...newForm, barcode: e.target.value })}
                      placeholder="Aponte o leitor aqui ou digite o código"
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-9 pr-3 text-xs text-[#F2F7F3] font-mono focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">{t('catalogo.categoria')} *</label>
                    <select
                      value={newForm.category}
                      onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    >
                      <option value="Hambúrgueres">Hambúrgueres</option>
                      <option value="Pizzas">Pizzas</option>
                      <option value="Pratos">Pratos</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Sucos">Sucos</option>
                      <option value="Sobremesas">Sobremesas</option>
                      <option value="Porções">Porções</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">{t('catalogo.preco')} *</label>
                    <input
                      type="text"
                      required
                      value={newForm.price}
                      onChange={(e) => setNewForm({ ...newForm, price: e.target.value })}
                      placeholder="Ex: 34.90"
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">{t('catalogo.tempo_preparo')}</label>
                  <input
                    type="number"
                    value={newForm.prepTime}
                    onChange={(e) => setNewForm({ ...newForm, prepTime: e.target.value })}
                    placeholder="15"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">{t('catalogo.descricao')}</label>
                  <textarea
                    rows={3}
                    value={newForm.description}
                    onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                    placeholder="Descreva os ingredientes e detalhes do prato..."
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                  />
                </div>

                <AdicionaisEditor items={newAdicionais} onChange={setNewAdicionais} />

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Foto do Prato</label>
                  <div className="flex items-center gap-3">
                    <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#16301F] bg-[#06100A] text-[#8FA396] transition hover:border-[#008000]">
                      {newForm.imageUrl ? (
                        <img src={newForm.imageUrl} alt="Foto do prato" className="h-full w-full object-cover" />
                      ) : (
                        <Pizza className="h-6 w-6" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={onPickNewPhoto} />
                    </label>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-[#8FA396]">JPG ou PNG, até 8MB. A imagem é redimensionada automaticamente.</p>
                      {newForm.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setNewForm({ ...newForm, imageUrl: '' })}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300"
                        >
                          Remover foto
                        </button>
                      )}
                      {newPhotoError && <p className="text-[10px] text-red-400">{newPhotoError}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 pt-4 border-t border-[#16301F] flex items-center justify-end gap-3 bg-[#0B1A10] mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
                >
                  {t('btn.cancelar')}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" /> {t('catalogo.salvar_produto')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Produto Existente (Carrega Nome e Dados que Já Estão na Tela) */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3 shrink-0">
              <div>
                <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3]">Editar Produto</h3>
                <p className="text-xs text-[#8FA396]">
                  Alterando dados de: <strong className="text-[#38B000]">{editingItem.name}</strong>
                </p>
              </div>
              <button onClick={() => setEditingItem(null)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEditProduct} className="flex-1 flex flex-col overflow-hidden pt-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Código de barras (opcional)</label>
                  <div className="relative">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#38B000]" />
                    <input
                      type="text"
                      value={editForm.barcode}
                      onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                      placeholder="Aponte o leitor aqui ou digite o código"
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-9 pr-3 text-xs text-[#F2F7F3] font-mono focus:border-[#008000] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">Categoria *</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    >
                      <option value="Hambúrgueres">Hambúrgueres</option>
                      <option value="Pizzas">Pizzas</option>
                      <option value="Pratos">Pratos</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Sucos">Sucos</option>
                      <option value="Sobremesas">Sobremesas</option>
                      <option value="Porções">Porções</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">Preço de Venda (R$) *</label>
                    <input
                      type="text"
                      required
                      value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none font-bold text-[#38B000]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Tempo de Preparo (min)</label>
                  <input
                    type="number"
                    value={editForm.prepTime}
                    onChange={(e) => setEditForm({ ...editForm, prepTime: e.target.value })}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Descrição</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                  />
                </div>

                <AdicionaisEditor items={editAdicionais} onChange={setEditAdicionais} />

                <div>
                  <label className="block text-xs font-bold text-[#8FA396] mb-1">Foto do Prato</label>
                  <div className="flex items-center gap-3">
                    <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#16301F] bg-[#06100A] text-[#8FA396] transition hover:border-[#008000]">
                      {editForm.imageUrl ? (
                        <img src={editForm.imageUrl} alt="Foto do prato" className="h-full w-full object-cover" />
                      ) : (
                        <Pizza className="h-6 w-6" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={onPickEditPhoto} />
                    </label>
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-[#8FA396]">JPG ou PNG, até 8MB. A imagem é redimensionada automaticamente.</p>
                      {editForm.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, imageUrl: '' })}
                          className="text-[10px] font-bold text-red-400 hover:text-red-300"
                        >
                          Remover foto
                        </button>
                      )}
                      {editPhotoError && <p className="text-[10px] text-red-400">{editPhotoError}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="shrink-0 pt-4 border-t border-[#16301F] flex items-center justify-end gap-3 bg-[#0B1A10] mt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
                >
                  <Save className="h-4 w-4" /> Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRÓPRIO DO SISTEMA: Confirmação de Operação Sensível (Exclusão) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-500/40 bg-[#0B1A10] p-6 shadow-[0_10px_40px_rgba(220,38,38,0.25)] flex flex-col space-y-4">
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-3">
              <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/40">
                  Operação Sensível
                </span>
                <h3 className="font-manrope font-extrabold text-base text-[#F2F7F3] mt-0.5">
                  Confirmar Exclusão de Produto
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#8FA396] leading-relaxed">
              Você tem certeza que deseja executar a ação{" "}
              <strong className="text-red-400 font-bold">"Excluir o produto {deleteConfirmItem.name}"</strong>?
              Esta operação irá remover o item do seu cardápio permanentemente.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#16301F]">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2.5 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-95 shadow-[0_2px_12px_rgba(220,38,38,0.4)] transition-all"
              >
                <Trash2 className="h-4 w-4" /> Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
