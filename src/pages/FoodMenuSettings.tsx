import { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  Save,
  Search,
  Star,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  QrCode,
  Sparkles,
  Layers,
  CheckCircle2,
  Eye,
  Settings2,
  Sliders,
  ExternalLink,
  Copy,
  Smartphone,
  Edit3,
  Bell,
  Clock,
  Award,
  Check,
  ShoppingBag,
  Receipt,
  UtensilsCrossed,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FoodMenuAddonsDialog } from '@/components/FoodMenuAddonsDialog';

const db = supabase as any;

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
};

type Entry = {
  id: string;
  product_id: string;
  description: string;
  image_url: string;
  active: boolean;
  featured: boolean;
  sort_order: number;
};

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80';
const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80';

export default function FoodMenuSettings() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Selected item being edited in live editor
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Category Manager Modal
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<Record<string, string>>({});
  const [newCatInput, setNewCatInput] = useState('');

  // Addons modal state
  const [addonsProduct, setAddonsProduct] = useState<{ id: string; name: string; menuProductId: string } | null>(null);

  // New product modal state
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Lanches');
  const [newPrice, setNewPrice] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);

  // General store branding settings
  const [storeName, setStoreName] = useState(() => localStorage.getItem('qrmenu_store_name') || 'Miaifood Bistro');
  const [storeTagline, setStoreTagline] = useState(() => localStorage.getItem('qrmenu_store_tagline') || 'Gastronomia • Atendimento na mesa');
  const [coverUrl, setCoverUrl] = useState(() => localStorage.getItem('qrmenu_cover_url') || DEFAULT_COVER);
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('qrmenu_logo_url') || DEFAULT_LOGO);
  const [waiterCallEnabled, setWaiterCallEnabled] = useState(() => localStorage.getItem('qrmenu_waiter_call') !== 'false');

  // Theme & Appearance Customization
  const [themeBg, setThemeBg] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).bg || '#050b14' : '#050b14';
    } catch { return '#050b14'; }
  });
  const [themeCardBg, setThemeCardBg] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).cardBg || '#0d1726' : '#0d1726';
    } catch { return '#0d1726'; }
  });
  const [themeCardText, setThemeCardText] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).cardText || '#f8fafc' : '#f8fafc';
    } catch { return '#f8fafc'; }
  });
  const [themeModalBg, setThemeModalBg] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).modalBg || '#0f172a' : '#0f172a';
    } catch { return '#0f172a'; }
  });
  const [themeModalText, setThemeModalText] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).modalText || '#f8fafc' : '#f8fafc';
    } catch { return '#f8fafc'; }
  });
  const [themePrimary, setThemePrimary] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).primary || '#007200' : '#007200';
    } catch { return '#007200'; }
  });
  const [themeFontFamily, setThemeFontFamily] = useState(() => {
    try {
      const stored = localStorage.getItem('qrmenu_theme');
      return stored ? JSON.parse(stored).fontFamily || 'Inter' : 'Inter';
    } catch { return 'Inter'; }
  });

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const saveThemeSettings = (newTheme: Partial<{
    bg: string;
    cardBg: string;
    cardText: string;
    modalBg: string;
    modalText: string;
    primary: string;
    fontFamily: string;
  }>) => {
    const updated = {
      bg: newTheme.bg ?? themeBg,
      cardBg: newTheme.cardBg ?? themeCardBg,
      cardText: newTheme.cardText ?? themeCardText,
      modalBg: newTheme.modalBg ?? themeModalBg,
      modalText: newTheme.modalText ?? themeModalText,
      primary: newTheme.primary ?? themePrimary,
      fontFamily: newTheme.fontFamily ?? themeFontFamily,
      text: newTheme.cardText ?? themeCardText,
    };
    if (newTheme.bg !== undefined) setThemeBg(newTheme.bg);
    if (newTheme.cardBg !== undefined) setThemeCardBg(newTheme.cardBg);
    if (newTheme.cardText !== undefined) setThemeCardText(newTheme.cardText);
    if (newTheme.modalBg !== undefined) setThemeModalBg(newTheme.modalBg);
    if (newTheme.modalText !== undefined) setThemeModalText(newTheme.modalText);
    if (newTheme.primary !== undefined) setThemePrimary(newTheme.primary);
    if (newTheme.fontFamily !== undefined) setThemeFontFamily(newTheme.fontFamily);

    localStorage.setItem('qrmenu_theme', JSON.stringify(updated));
    toast.success('Aparência e cores do QR Menu salvas com sucesso!');
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, menuRes] = await Promise.all([
        db.from('products').select('id,name,category,price').eq('deleted', false).order('name'),
        db.from('food_menu_products').select('*').order('sort_order'),
      ]);

      if (prodRes.error || menuRes.error) {
        toast.error('Não foi possível carregar o cardápio QR Menu.');
      }

      setProducts(prodRes.data ?? []);
      setEntries(menuRes.data ?? []);

      if (prodRes.data && prodRes.data.length > 0 && !selectedProduct) {
        setSelectedProduct(prodRes.data[0]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados do cardápio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const byProduct = useMemo(() => new Map((entries || []).map((e) => [e.product_id, e])), [entries]);

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('qrmenu_custom_categories');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (customCategories || []).forEach((c) => {
      if (c && c.trim()) set.add(c.trim());
    });
    (products || []).forEach((p) => {
      if (p && p.category) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products, customCategories]);

  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (products || []).forEach((p) => {
      if (!p) return;
      const cat = p.category?.trim() || 'Geral';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [products]);

  const saveEntry = async (product: Product, changes: Partial<Entry>) => {
    const entry = byProduct.get(product.id);
    setSaving(product.id);

    const payload = {
      product_id: product.id,
      description: entry?.description ?? '',
      image_url: entry?.image_url ?? '',
      active: entry?.active ?? true,
      featured: entry?.featured ?? false,
      sort_order: entry?.sort_order ?? 0,
      ...changes,
    };

    const result = entry
      ? await db.from('food_menu_products').update(payload).eq('id', entry.id)
      : await db.from('food_menu_products').insert(payload);

    setSaving(null);
    if (result.error) {
      toast.error('Não foi possível salvar as alterações.');
      return;
    }

    toast.success(`'${product.name}' atualizado no QR Menu.`);
    await loadData();
  };

  const saveProductDetails = async (product: Product, changes: { name?: string; category?: string; price?: number }) => {
    setSaving(product.id);
    const { error } = await db.from('products').update(changes).eq('id', product.id);
    setSaving(null);
    if (error) {
      toast.error('Não foi possível atualizar o produto.');
      return;
    }
    toast.success(`'${changes.name || product.name}' atualizado!`);
    await loadData();
  };

  const handleRenameCategory = async (oldCat: string, newCat: string) => {
    if (!newCat.trim() || oldCat === newCat.trim()) return;
    setLoading(true);
    try {
      const { error } = await db.from('products').update({ category: newCat.trim() }).eq('category', oldCat);
      if (error) throw error;
      toast.success(`Categoria '${oldCat}' renomeada para '${newCat.trim()}'.`);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível renomear a categoria.');
    } finally {
      setLoading(false);
    }
  };

  const uploadProductImage = async (product: Product, file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/i) || file.size > 5 * 1024 * 1024) {
      toast.error('Envie uma imagem JPG, PNG ou WebP de até 5 MB.');
      return;
    }

    if (!user) return;
    setSaving(product.id);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${product.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('food-menu-images')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadErr) {
      setSaving(null);
      toast.error('Não foi possível enviar a foto. Tente novamente.');
      return;
    }

    const { data } = supabase.storage.from('food-menu-images').getPublicUrl(path);
    setSaving(null);
    await saveEntry(product, { image_url: data.publicUrl, active: true });
  };

  const uploadBrandingImage = async (type: 'cover' | 'logo', file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/i) || file.size > 5 * 1024 * 1024) {
      toast.error('Envie uma imagem válida de até 5 MB.');
      return;
    }
    if (!user) return;

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/branding-${type}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('food-menu-images')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadErr) {
      toast.error(`Não foi possível enviar ${type === 'cover' ? 'o banner' : 'a logo'}.`);
      return;
    }

    const { data } = supabase.storage.from('food-menu-images').getPublicUrl(path);
    if (type === 'cover') {
      setCoverUrl(data.publicUrl);
      localStorage.setItem('qrmenu_cover_url', data.publicUrl);
      toast.success('Capa do banner atualizada!');
    } else {
      setLogoUrl(data.publicUrl);
      localStorage.setItem('qrmenu_logo_url', data.publicUrl);
      toast.success('Logo do estabelecimento atualizado!');
    }
  };

  const saveGeneralSettings = () => {
    localStorage.setItem('qrmenu_store_name', storeName);
    localStorage.setItem('qrmenu_store_tagline', storeTagline);
    toast.success('Nome e subtítulo do estabelecimento salvos!');
  };

  const removeProductImage = async (product: Product) => {
    if (!product) return;
    await saveEntry(product, { image_url: '' });
  };

  const handleCreateNewProduct = async () => {
    if (!newName.trim()) {
      toast.error('Informe o nome do produto.');
      return;
    }
    const parsedPrice = parseFloat(newPrice.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error('Informe um preço válido.');
      return;
    }

    setCreatingProduct(true);
    try {
      const { data: prodData, error: prodErr } = await db
        .from('products')
        .insert({
          name: newName.trim(),
          category: newCategory.trim() || 'Lanches',
          price: parsedPrice,
        })
        .select()
        .single();

      if (prodErr || !prodData) {
        throw prodErr || new Error('Falha ao criar produto');
      }

      let imageUrl = '';
      if (newImageFile && user) {
        const ext = newImageFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/${prodData.id}-${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from('food-menu-images')
          .upload(path, newImageFile, { contentType: newImageFile.type, upsert: true });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('food-menu-images').getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }

      await db.from('food_menu_products').insert({
        product_id: prodData.id,
        description: newDescription.trim(),
        image_url: imageUrl,
        active: true,
        featured: false,
        sort_order: (entries?.length || 0) + 1,
      });

      toast.success(`Produto '${prodData.name}' criado com sucesso!`);

      setNewName('');
      setNewCategory('Lanches');
      setNewPrice('');
      setNewDescription('');
      setNewImageFile(null);
      setNewProductOpen(false);

      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar o produto. Tente novamente.');
    } finally {
      setCreatingProduct(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let list = selectedCategory === 'all'
      ? (products || [])
      : (products || []).filter((p) => p && (p.category?.trim() || 'Geral') === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => p && p.name && p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCategory, search]);

  const selectedEntry = selectedProduct ? byProduct.get(selectedProduct.id) : null;

  if (loading && products.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <main className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 font-semibold text-xs tracking-wider uppercase">
            <Smartphone className="h-4 w-4" /> Editor Visual Interativo (WYSIWYG)
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-0.5">Cardápio Digital da Mesa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Veja em tempo real na tela do celular todas as alterações de produtos, fotos, preços, cores, modais e fontes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setManageCategoriesOpen(true)}>
            <Tag className="mr-2 h-4 w-4 text-emerald-500" /> Gerenciar Categorias
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a href="/qrmenu/demo" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4 text-emerald-500" /> Abrir no Celular
            </a>
          </Button>

          <Dialog open={newProductOpen} onOpenChange={setNewProductOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                <Plus className="mr-1.5 h-4 w-4" /> Cadastrar Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-emerald-500" /> Cadastrar Produto no Cardápio
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Nome do Produto *</label>
                  <Input placeholder="Ex: Café 500g, Hambúrguer Smash..." value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Categoria</label>
                    <Input placeholder="Ex: Mercearia, Bebidas, Lanches..." value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Preço (R$) *</label>
                    <Input placeholder="18.50" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Descrição</label>
                  <Textarea placeholder="Descreva os detalhes deste item para o cliente..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Foto do Produto</label>
                  <Input type="file" accept="image/*" onChange={(e) => setNewImageFile(e.target.files?.[0] || null)} />
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold" disabled={creatingProduct} onClick={handleCreateNewProduct}>
                  {creatingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Produto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* TWO-COLUMN LAYOUT: PERSISTENT PHONE SIMULATOR ON LEFT, TABS CONTROLS ON RIGHT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* PERSISTENT REAL-TIME SMARTPHONE SIMULATOR (ALWAYS VISIBLE NEXT TO EVERY TAB) */}
        <div className="lg:col-span-5 flex flex-col items-center lg:sticky lg:top-4 z-10">
          <div className="text-center mb-3 flex items-center justify-between gap-2 w-full max-w-[390px]">
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5 shadow-sm">
              <Smartphone className="h-3.5 w-3.5" /> Celular em Tempo Real
            </span>
            <button
              type="button"
              onClick={() => setPreviewModalOpen(!previewModalOpen)}
              className={`text-xs font-extrabold px-3 py-1 rounded-full border transition flex items-center gap-1.5 ${
                previewModalOpen
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                  : 'bg-muted/80 text-muted-foreground hover:text-foreground border-white/10'
              }`}
            >
              <Eye className="h-3.5 w-3.5" /> {previewModalOpen ? 'Fechar Modal' : 'Ver Modal'}
            </button>
          </div>

          {/* PHONE CONTAINER FRAME */}
          <div
            style={{
              backgroundColor: themeBg,
              color: themeCardText,
              fontFamily: `${themeFontFamily}, system-ui, sans-serif`,
            }}
            className="w-full max-w-[390px] rounded-[44px] border-[10px] border-slate-900 shadow-2xl overflow-hidden relative flex flex-col min-h-[720px] ring-1 ring-slate-800 transition-all duration-300"
          >
            {/* Phone Notch */}
            <div className="w-36 h-4 bg-slate-900 mx-auto rounded-b-xl absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-slate-800 mr-2" />
              <div className="h-1.5 w-12 rounded-full bg-slate-800" />
            </div>

            {/* SIMULATED APP HEADER */}
            <div className="relative w-full pt-4">
              {/* Banner Image */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-900 group">
                <img src={coverUrl} alt="Cover Banner" className="h-full w-full object-cover brightness-90" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                {/* Change Cover Hover Overlay */}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white cursor-pointer z-20">
                  <Upload className="h-6 w-6 text-emerald-400 mb-1" />
                  <span className="text-xs font-bold">Trocar Imagem do Banner</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadBrandingImage('cover', file);
                  }} />
                </label>

                {/* Miaifood Parceiro Badge */}
                <div className="absolute top-6 left-3 flex items-center gap-1 rounded-full bg-emerald-600/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white shadow-md border border-emerald-400/30">
                  <Award className="h-3 w-3" />
                  MIAR AI/FOOD
                </div>

                {/* Mesa Badge */}
                <div className="absolute top-6 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md px-3 py-0.5 text-[11px] font-bold text-white shadow-lg border border-emerald-400/40">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Mesa 01
                </div>
              </div>

              {/* Logo Avatar + Rating + Store Info */}
              <div className="px-4 relative -mt-10 flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  {/* Logo Avatar */}
                  <div className="relative h-20 w-20 rounded-2xl overflow-hidden border-2 border-slate-950 bg-slate-900 shadow-xl group">
                    <img src={logoUrl} alt="Logo Avatar" className="h-full w-full object-cover" />
                    <label className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer">
                      <Upload className="h-5 w-5 text-emerald-400" />
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadBrandingImage('logo', file);
                      }} />
                    </label>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400">4.9</span>
                    <span className="text-[10px] opacity-60">(420+)</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight">{storeName}</h2>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5 flex items-center gap-2 font-medium">
                    <span>{storeTagline}</span>
                  </p>
                </div>

                {/* Sub-tabs */}
                <div className="flex border-b border-white/10 pt-2 mt-1 gap-6 text-xs font-bold">
                  <span className="pb-1.5 border-b-2 text-emerald-400 font-extrabold" style={{ borderColor: themePrimary, color: themePrimary }}>Cardápio</span>
                  <span className="pb-1.5 opacity-50">Avaliações</span>
                  <span className="pb-1.5 opacity-50">Informações</span>
                </div>
              </div>
            </div>

            {/* SEARCH BAR IN SIMULATOR */}
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 opacity-50" />
                <input
                  type="text"
                  readOnly
                  placeholder="Buscar pratos ou bebidas..."
                  style={{ backgroundColor: themeCardBg, color: themeCardText }}
                  className="w-full rounded-xl border border-white/10 pl-8 pr-3 py-2 text-xs pointer-events-none"
                />
              </div>
            </div>

            {/* CALL WAITER BUTTON */}
            <div className="px-3 mb-3">
              <button
                type="button"
                onClick={() => {
                  const next = !waiterCallEnabled;
                  setWaiterCallEnabled(next);
                  localStorage.setItem('qrmenu_waiter_call', String(next));
                  toast.success(next ? 'Botão de chamar garçom ATIVADO' : 'Botão DESATIVADO');
                }}
                className={`w-full rounded-xl py-2.5 px-4 text-xs font-extrabold flex items-center justify-center gap-2 transition border ${
                  waiterCallEnabled
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-black/20 opacity-50 border-white/10'
                }`}
              >
                <Bell className="h-4 w-4" /> Chamar garçom {waiterCallEnabled ? '(Ativo)' : '(Desativado)'}
              </button>
            </div>

            {/* CATEGORIES PILLS BAR IN SIMULATOR */}
            <div className="px-3 mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-bold flex-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  style={{
                    backgroundColor: selectedCategory === 'all' ? themePrimary : themeCardBg,
                    color: selectedCategory === 'all' ? '#ffffff' : themeCardText,
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/10 transition shrink-0 font-extrabold"
                >
                  Todas
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      backgroundColor: selectedCategory === cat ? themePrimary : themeCardBg,
                      color: selectedCategory === cat ? '#ffffff' : themeCardText,
                    }}
                    className="px-3 py-1.5 rounded-xl border border-white/10 transition shrink-0"
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setManageCategoriesOpen(true)}
                title="Editar ou Criar Categorias"
                style={{ backgroundColor: themeCardBg }}
                className="p-1.5 rounded-lg border border-white/10 text-emerald-400 hover:opacity-80 shrink-0"
              >
                <Tag className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* PRODUCTS LIST IN SIMULATOR */}
            <div className="flex-1 px-3 space-y-3 overflow-y-auto max-h-[380px] pb-14">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-10 opacity-50 text-xs">Nenhum produto cadastrado nesta categoria.</div>
              ) : (
                filteredProducts.map((p) => {
                  const entry = byProduct.get(p.id);
                  const isSelected = selectedProduct?.id === p.id;
                  const isPublished = entry?.active ?? false;
                  const isFeatured = entry?.featured ?? false;

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProduct(p);
                        setPreviewModalOpen(true);
                      }}
                      style={{
                        backgroundColor: themeCardBg,
                        color: themeCardText,
                        borderColor: isSelected ? themePrimary : 'rgba(255,255,255,0.1)',
                      }}
                      className={`group relative rounded-2xl border p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                        isSelected ? 'ring-2 ring-emerald-500/30' : isPublished ? 'hover:opacity-90' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Product Image */}
                        <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-black/20 shrink-0 border border-white/10">
                          {entry?.image_url ? (
                            <img src={entry.image_url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center opacity-40">
                              <ImageIcon className="h-6 w-6 stroke-1" />
                            </div>
                          )}

                          {isFeatured && (
                            <div className="absolute top-1 left-1 p-0.5 bg-amber-500 text-slate-950 rounded-full">
                              <Star className="h-2.5 w-2.5 fill-slate-950" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold truncate">{p.name}</h3>
                            {!isPublished && (
                              <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">Oculto</span>
                            )}
                          </div>
                          <p className="text-[10px] opacity-70 line-clamp-1 mt-0.5">{entry?.description || 'Clique para adicionar descrição...'}</p>
                          <p className="text-xs font-black mt-1" style={{ color: themePrimary }}>
                            {Number(p.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{ backgroundColor: themePrimary }}
                        className="h-8 w-8 rounded-xl text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-lg"
                      >
                        +
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* SIMULATED BOTTOM BAR */}
            <div
              style={{ backgroundColor: themeCardBg }}
              className="mt-auto border-t border-white/10 px-4 py-2.5 flex items-center justify-around text-[10px] font-bold opacity-80"
            >
              <div className="flex flex-col items-center gap-1" style={{ color: themePrimary }}>
                <UtensilsCrossed className="h-4 w-4" />
                <span>Cardápio</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShoppingBag className="h-4 w-4" />
                <span>Carrinho</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Receipt className="h-4 w-4" />
                <span>Fechar conta</span>
              </div>
            </div>

            {/* SIMULATED MODAL OVERLAY IN PHONE */}
            {previewModalOpen && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col justify-end animate-in fade-in duration-200">
                <div
                  style={{
                    backgroundColor: themeModalBg,
                    color: themeModalText,
                    fontFamily: `${themeFontFamily}, system-ui, sans-serif`,
                  }}
                  className="rounded-t-[32px] p-5 space-y-4 border-t border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85%] overflow-y-auto"
                >
                  <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2" />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Prévia do Modal do Prato</span>
                      <h3 className="text-lg font-black">{selectedProduct?.name || 'Hambúrguer Gourmet MIAR'}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(false)}
                      className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Image */}
                  <div className="h-36 w-full rounded-2xl overflow-hidden bg-black/30 border border-white/10 relative">
                    <img
                      src={selectedEntry?.image_url || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80'}
                      alt="Prato"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <p className="text-xs opacity-80 leading-relaxed">
                    {selectedEntry?.description || 'Suculento hambúrguer artesanal de 180g com queijo cheddar fatiado, bacon crocante e molho especial no pão brioche.'}
                  </p>

                  {/* Simulated Addons */}
                  <div className="space-y-2 border-t border-b border-white/10 py-3">
                    <p className="text-xs font-bold">Adicionais recomendados</p>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="opacity-90">+ Bacon extra</span>
                      <span className="font-bold">+ R$ 4,50</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="opacity-90">+ Queijo cheddar duplo</span>
                      <span className="font-bold">+ R$ 5,00</span>
                    </div>
                  </div>

                  {/* Price + Action Button */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <span className="text-[10px] opacity-60 block">Valor total</span>
                      <span className="text-lg font-black" style={{ color: themePrimary }}>
                        {Number(selectedProduct?.price || 38.90).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <button
                      type="button"
                      style={{ backgroundColor: themePrimary }}
                      className="px-5 py-2.5 rounded-2xl text-white font-extrabold text-xs shadow-lg flex items-center gap-2"
                    >
                      <ShoppingBag className="h-4 w-4" /> Adicionar ao Pedido
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ALL CONTROLS & TABS */}
        <div className="lg:col-span-7 space-y-6">
          <Tabs defaultValue="visual" className="space-y-6">
            <TabsList className="bg-muted/60 p-1 w-full flex overflow-x-auto">
              <TabsTrigger value="visual" className="flex items-center gap-2 flex-1">
                <Smartphone className="h-4 w-4 text-emerald-500" /> Edição de Produtos
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2 flex-1">
                <Sliders className="h-4 w-4 text-emerald-500" /> Cores, Modais & Fontes
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2 flex-1">
                <Settings2 className="h-4 w-4 text-emerald-500" /> Fotos & Marca
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: PRODUCT EDITING */}
            <TabsContent value="visual" className="space-y-6">
              {selectedProduct ? (
                <Card className="border-2 border-emerald-500/40 shadow-lg">
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 mr-4">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Nome do Produto</label>
                        <Input
                          defaultValue={selectedProduct.name}
                          className="font-bold text-lg"
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== selectedProduct.name) {
                              void saveProductDetails(selectedProduct, { name: e.target.value.trim() });
                            }
                          }}
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Preço (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={selectedProduct.price}
                          className="font-black text-emerald-500 text-base"
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0 && val !== selectedProduct.price) {
                              void saveProductDetails(selectedProduct, { price: val });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 pt-5">
                    {/* CATEGORY SELECTOR / EDIT */}
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">Categoria do Produto</label>
                      <div className="flex gap-2">
                        <Input
                          defaultValue={selectedProduct.category || 'Geral'}
                          placeholder="Ex: Bebidas, Lanches, Mercearia, Padaria..."
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== selectedProduct.category) {
                              void saveProductDetails(selectedProduct, { category: e.target.value.trim() });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* PUBLISH AND FEATURED TOGGLES */}
                    <div className="grid grid-cols-2 gap-4 p-3.5 border rounded-2xl bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">Publicado no Menu</p>
                          <p className="text-[10px] text-muted-foreground">Exibir para o cliente</p>
                        </div>
                        <Switch
                          checked={selectedEntry?.active ?? true}
                          onCheckedChange={(val) => void saveEntry(selectedProduct, { active: val })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-500">Destaque Especial ★</p>
                          <p className="text-[10px] text-muted-foreground">Exibir no topo</p>
                        </div>
                        <Switch
                          checked={selectedEntry?.featured ?? false}
                          onCheckedChange={(val) => void saveEntry(selectedProduct, { featured: val })}
                        />
                      </div>
                    </div>

                    {/* ITEM DESCRIPTION */}
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1 block">Descrição no Cardápio</label>
                      <Textarea
                        rows={3}
                        defaultValue={selectedEntry?.description || ''}
                        placeholder="Descreva os ingredientes, adicionais e sugestões deste produto..."
                        onBlur={(e) => void saveEntry(selectedProduct, { description: e.target.value })}
                      />
                    </div>

                    {/* ITEM PHOTO UPLOAD */}
                    <div>
                      <label className="text-xs font-bold text-foreground mb-2 block">Foto do Prato</label>
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-2xl overflow-hidden bg-muted border shrink-0 flex items-center justify-center">
                          {selectedEntry?.image_url ? (
                            <img src={selectedEntry.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground stroke-1" />
                          )}
                        </div>

                        <div className="flex-1 space-y-2">
                          <label className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold transition">
                            <Upload className="h-4 w-4" /> Enviar Nova Foto
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadProductImage(selectedProduct, file);
                              }}
                            />
                          </label>

                          {selectedEntry?.image_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-rose-500 hover:text-rose-600"
                              onClick={() => void removeProductImage(selectedProduct)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover Foto
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* MANAGE ADDONS BUTTON */}
                    {selectedEntry && (
                      <Button
                        variant="secondary"
                        className="w-full font-bold text-xs"
                        onClick={() =>
                          setAddonsProduct({
                            id: selectedProduct.id,
                            name: selectedProduct.name,
                            menuProductId: selectedEntry.id,
                          })
                        }
                      >
                        <Plus className="mr-2 h-4 w-4 text-emerald-500" /> Gerenciar Adicionais & Opcionais do Prato
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="p-8 border rounded-2xl text-center text-muted-foreground">
                  Selecione um produto na tela do celular para começar a editar.
                </div>
              )}
            </TabsContent>

            {/* TAB 2: APPEARANCE, COLORS & FONTS */}
            <TabsContent value="appearance" className="space-y-6">
              {/* PRESETS CARD */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-emerald-500" /> Presets de Temas em 1-Clique
                  </CardTitle>
                  <CardDescription>Escolha uma combinação de cores pronta para aplicar instantaneamente no celular.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* PRESET 1: MIAR Dark Spruce */}
                    <button
                      type="button"
                      onClick={() => saveThemeSettings({
                        bg: '#050b14', cardBg: '#0d1726', cardText: '#f8fafc',
                        modalBg: '#0f172a', modalText: '#f8fafc', primary: '#007200'
                      })}
                      className="p-3.5 rounded-2xl border text-left space-y-2 bg-[#050b14] text-white hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
                    >
                      <p className="font-bold text-xs flex items-center justify-between">
                        <span>🌲 MIAR Dark Spruce</span>
                        <span className="h-3 w-3 rounded-full bg-[#007200]" />
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        <div className="h-3.5 w-3.5 rounded bg-[#050b14] border border-white/20" title="Fundo" />
                        <div className="h-3.5 w-3.5 rounded bg-[#0d1726] border border-white/20" title="Card" />
                        <div className="h-3.5 w-3.5 rounded bg-[#0f172a] border border-white/20" title="Modal" />
                        <div className="h-3.5 w-3.5 rounded bg-[#007200]" title="Destaque" />
                      </div>
                    </button>

                    {/* PRESET 2: MIAR Light Clean */}
                    <button
                      type="button"
                      onClick={() => saveThemeSettings({
                        bg: '#f8fafc', cardBg: '#ffffff', cardText: '#0f172a',
                        modalBg: '#ffffff', modalText: '#0f172a', primary: '#004B23'
                      })}
                      className="p-3.5 rounded-2xl border text-left space-y-2 bg-[#f8fafc] text-slate-900 hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
                    >
                      <p className="font-bold text-xs flex items-center justify-between">
                        <span>☀️ MIAR Light Clean</span>
                        <span className="h-3 w-3 rounded-full bg-[#004B23]" />
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        <div className="h-3.5 w-3.5 rounded bg-[#f8fafc] border border-slate-300" title="Fundo" />
                        <div className="h-3.5 w-3.5 rounded bg-[#ffffff] border border-slate-300" title="Card" />
                        <div className="h-3.5 w-3.5 rounded bg-[#ffffff] border border-slate-300" title="Modal" />
                        <div className="h-3.5 w-3.5 rounded bg-[#004B23]" title="Destaque" />
                      </div>
                    </button>

                    {/* PRESET 3: Radioactive Grass */}
                    <button
                      type="button"
                      onClick={() => saveThemeSettings({
                        bg: '#081308', cardBg: '#102410', cardText: '#f0fdf4',
                        modalBg: '#142d14', modalText: '#f0fdf4', primary: '#70E000'
                      })}
                      className="p-3.5 rounded-2xl border text-left space-y-2 bg-[#081308] text-white hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
                    >
                      <p className="font-bold text-xs flex items-center justify-between">
                        <span>⚡ Radioactive Grass</span>
                        <span className="h-3 w-3 rounded-full bg-[#70E000]" />
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        <div className="h-3.5 w-3.5 rounded bg-[#081308] border border-white/20" title="Fundo" />
                        <div className="h-3.5 w-3.5 rounded bg-[#102410] border border-white/20" title="Card" />
                        <div className="h-3.5 w-3.5 rounded bg-[#142d14] border border-white/20" title="Modal" />
                        <div className="h-3.5 w-3.5 rounded bg-[#70E000]" title="Destaque" />
                      </div>
                    </button>

                    {/* PRESET 4: Dark Minimalist */}
                    <button
                      type="button"
                      onClick={() => saveThemeSettings({
                        bg: '#09090b', cardBg: '#18181b', cardText: '#fafafa',
                        modalBg: '#18181b', modalText: '#fafafa', primary: '#38B000'
                      })}
                      className="p-3.5 rounded-2xl border text-left space-y-2 bg-[#09090b] text-white hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
                    >
                      <p className="font-bold text-xs flex items-center justify-between">
                        <span>🖤 Dark Minimalist</span>
                        <span className="h-3 w-3 rounded-full bg-[#38B000]" />
                      </p>
                      <div className="flex gap-1.5 pt-1">
                        <div className="h-3.5 w-3.5 rounded bg-[#09090b] border border-white/20" title="Fundo" />
                        <div className="h-3.5 w-3.5 rounded bg-[#18181b] border border-white/20" title="Card" />
                        <div className="h-3.5 w-3.5 rounded bg-[#18181b] border border-white/20" title="Modal" />
                        <div className="h-3.5 w-3.5 rounded bg-[#38B000]" title="Destaque" />
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* INDIVIDUAL COLOR PICKERS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sliders className="h-4 w-4 text-emerald-500" /> Cores Personalizadas (Fundo, Cards & Modais)
                  </CardTitle>
                  <CardDescription>Qualquer alteração feita aqui reflete imediatamente na tela do celular ao lado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fundo da Página */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Fundo do Cardápio (Página)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeBg}
                          onChange={(e) => saveThemeSettings({ bg: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themeBg}
                          onChange={(e) => saveThemeSettings({ bg: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Fundo dos Cards */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Fundo dos Cards de Produtos</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeCardBg}
                          onChange={(e) => saveThemeSettings({ cardBg: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themeCardBg}
                          onChange={(e) => saveThemeSettings({ cardBg: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Cor do Texto dos Cards */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Texto dos Cards de Produtos</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeCardText}
                          onChange={(e) => saveThemeSettings({ cardText: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themeCardText}
                          onChange={(e) => saveThemeSettings({ cardText: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Fundo dos Modais */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Fundo dos Modais (Detalhes)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeModalBg}
                          onChange={(e) => saveThemeSettings({ modalBg: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themeModalBg}
                          onChange={(e) => saveThemeSettings({ modalBg: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Cor do Texto dos Modais */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Texto dos Modais (Detalhes)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themeModalText}
                          onChange={(e) => saveThemeSettings({ modalText: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themeModalText}
                          onChange={(e) => saveThemeSettings({ modalText: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    {/* Cor de Destaque / Botões */}
                    <div className="space-y-1.5 border p-3.5 rounded-2xl bg-card">
                      <label className="text-xs font-bold block">Destaque & Botões de Ação</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={themePrimary}
                          onChange={(e) => saveThemeSettings({ primary: e.target.value })}
                          className="h-9 w-9 rounded-xl border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={themePrimary}
                          onChange={(e) => saveThemeSettings({ primary: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* FONT FAMILY SELECTOR */}
                  <div className="pt-3 border-t">
                    <label className="text-xs font-bold block mb-2">Fonte & Tipografia do Cardápio</label>
                    <Select value={themeFontFamily} onValueChange={(val) => saveThemeSettings({ fontFamily: val })}>
                      <SelectTrigger className="w-full font-bold">
                        <SelectValue placeholder="Selecione uma fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Inter">Inter (Moderna, Limpa e Padrão)</SelectItem>
                        <SelectItem value="Space Grotesk">Space Grotesk (Tech & Gastronômica)</SelectItem>
                        <SelectItem value="Poppins">Poppins (Arredondada e Amigável)</SelectItem>
                        <SelectItem value="Playfair Display">Playfair Display (Elegante & Sofisticada)</SelectItem>
                        <SelectItem value="Roboto Mono">Roboto Mono (Moderna & Estruturada)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: BRANDING & STORE SETTINGS */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-emerald-500" /> Nome & Subtítulo do Estabelecimento
                  </CardTitle>
                  <CardDescription>As alterações aparecem imediatamente no topo do celular ao lado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Nome do Estabelecimento</label>
                    <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} onBlur={saveGeneralSettings} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Subtítulo / Especialidade</label>
                    <Input value={storeTagline} onChange={(e) => setStoreTagline(e.target.value)} onBlur={saveGeneralSettings} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Settings2 className="h-4 w-4 text-emerald-500" /> Imagens de Capa e Logo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* BANNER COVER */}
                    <div className="space-y-3 border p-4 rounded-2xl bg-card">
                      <h4 className="text-xs font-bold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-emerald-500" /> Banner de Capa (Topo)
                      </h4>
                      <div className="h-32 w-full rounded-xl overflow-hidden bg-slate-900 border">
                        <img src={coverUrl} alt="Banner" className="h-full w-full object-cover" />
                      </div>
                      <label className="inline-flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-xs font-bold transition">
                        <Upload className="h-4 w-4" /> Enviar Banner
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadBrandingImage('cover', file);
                        }} />
                      </label>
                    </div>

                    {/* LOGO AVATAR */}
                    <div className="space-y-3 border p-4 rounded-2xl bg-card">
                      <h4 className="text-xs font-bold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-emerald-500" /> Logotipo / Avatar
                      </h4>
                      <div className="h-32 w-full rounded-xl flex items-center justify-center bg-slate-900 border">
                        <img src={logoUrl} alt="Logo" className="h-20 w-20 rounded-2xl object-cover border" />
                      </div>
                      <label className="inline-flex items-center justify-center gap-2 cursor-pointer w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-2 text-xs font-bold transition">
                        <Upload className="h-4 w-4" /> Enviar Logotipo
                        <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadBrandingImage('logo', file);
                        }} />
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* CATEGORY MANAGER MODAL */}
      <Dialog open={manageCategoriesOpen} onOpenChange={setManageCategoriesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-500" /> Gerenciar & Criar Categorias
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* CREATE NEW CATEGORY SECTION */}
            <div className="p-4 border rounded-2xl bg-emerald-500/5 border-emerald-500/20 space-y-2">
              <label className="text-xs font-bold text-emerald-400 block">➕ Criar Nova Categoria</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Sobremesas, Drinks, Combos..."
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="text-xs font-semibold"
                />
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                  disabled={!newCatInput.trim()}
                  onClick={() => {
                    const catName = newCatInput.trim();
                    if (catName) {
                      const next = Array.from(new Set([...customCategories, catName]));
                      setCustomCategories(next);
                      localStorage.setItem('qrmenu_custom_categories', JSON.stringify(next));
                      setSelectedCategory(catName);
                      setNewCatInput('');
                      setManageCategoriesOpen(false);
                      toast.success(`Categoria '${catName}' criada com sucesso! Pílula adicionada ao cardápio.`);
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Criar Categoria
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Categorias existentes (edite os nomes ou renomeie abaixo):
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const count = categoryProductCounts[cat] || 0;
                const editingName = editingCategoryName[cat] ?? cat;

                return (
                  <div key={cat} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-muted/30">
                    <div className="flex-1">
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingCategoryName((prev) => ({ ...prev, [cat]: e.target.value }))}
                        className="text-xs font-bold"
                      />
                      <span className="text-[10px] text-muted-foreground mt-1 block">{count} produto(s) nesta categoria</span>
                    </div>

                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      disabled={editingName === cat || !editingName.trim()}
                      onClick={() => void handleRenameCategory(cat, editingName)}
                    >
                      Renomear
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Addons Modal */}
      {addonsProduct && (
        <FoodMenuAddonsDialog
          open={Boolean(addonsProduct)}
          onOpenChange={(v) => {
            if (!v) setAddonsProduct(null);
          }}
          menuProductId={addonsProduct.menuProductId}
          productName={addonsProduct.name}
        />
      )}
    </main>
  );
}
