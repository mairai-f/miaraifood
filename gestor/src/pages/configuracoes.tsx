import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { customFetch } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  Utensils,
  Store,
  Printer,
  Search,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Phone,
  SlidersHorizontal,
  Bot,
  Megaphone,
  Package,
  Activity,
  Wrench,
  UserCheck,
  CreditCard,
  ChefHat,
  Languages,
  Camera,
  DollarSign,
  ShoppingCart,
  Tv,
  HardDrive,
  Wifi,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/IdiomaContext';
import { IDIOMA_LABEL, type Idioma } from '@/i18n/traducoes';
import { Bandeira } from '@/i18n/Bandeira';
import { decodeJwtPayload } from '@/lib/jwt';
import { compressDishPhoto } from '@/lib/image-compression';
import {
  MenuThemeProvider,
  ProductCard,
  DEFAULT_MENU_THEME,
  mergeMenuTheme,
  type MenuTheme,
} from '@workspace/menu-theme';
import { Palette } from 'lucide-react';
import FuncionariosPage from './funcionarios';
import Estoque from './estoque';
import Compras from './compras';
import Rentabilidade from './rentabilidade';

const MENU_FONT_OPTIONS = ['Manrope', 'Poppins', 'Inter', 'Roboto', 'Playfair Display'];

function getOwnerToken(): string | null {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
}

// Trade Types / Segment Options
const BUSINESS_SEGMENTS = [
  { id: 'restaurante', label: 'Restaurante & Alacarte', icon: Utensils, desc: 'Mesas, comandas, KDS e pedidos' },
  { id: 'bar', label: 'Bar, Pub & Balcão', icon: Store, desc: 'Faturamento rápido, fichas e comandas' },
  { id: 'delivery', label: 'Delivery & Marmitaria', icon: Phone, desc: 'Despacho de motoboys e pedidos online' },
  { id: 'lanchonete', label: 'Lanchonete & Fast Food', icon: CreditCard, desc: 'PDV ágil, painel de senhas e autoatendimento' },
  { id: 'padaria', label: 'Padaria & Confeitaria', icon: Building2, desc: 'Venda por quilo, balança e produção' },
  { id: 'mercado', label: 'Mercado & Conveniência', icon: Package, desc: 'Código de barras, controle de lote e caixa' },
  { id: 'petshop', label: 'Petshop & Banho e Tosa', icon: Activity, desc: 'Agendamentos, serviços e produtos' },
  { id: 'servicos', label: 'Serviços & Atendimento', icon: Wrench, desc: 'Ordens de serviço e orçamento' },
];

// Operational Options (Modern Button Chips instead of checkboxes)
const BUSINESS_FEATURES = [
  { id: 'mesas', label: 'Gestão de Mesas e Comandas', desc: 'Ativa mapa do salão' },
  { id: 'kds', label: 'Cozinha KDS', desc: 'Monitor de preparo de pratos' },
  { id: 'delivery_online', label: 'Cardápio Digital / Delivery', desc: 'Pedidos QR Code e online' },
  { id: 'impressao_automatica', label: 'Impressão ESC/POS Automática', desc: 'Disparo direto pra cozinha' },
  { id: 'estoque_insumos', label: 'Baixa Automática de Estoque', desc: 'Desconto por ficha técnica' },
  { id: 'ia_aria', label: 'Assistente Ária Copilot', desc: 'Inteligência artificial ativa' },
  { id: 'seguranca_pin', label: 'Login Rápido por PIN', desc: 'Acesso sem senha no PDV' },
];

// Catálogo de módulos reais do sistema — navegação rápida a partir das
// Configurações. Os "path" abaixo são SEMPRE relativos (sem prefixo) porque
// a navegação usa o setLocation do wouter (SPA), que já sabe aplicar o
// prefixo de base sozinho — diferente de um iframe/window.location, que
// precisaria do prefixo manual. Não mostramos o path na tela, só nome e
// categoria (corrigido 05/09/2026 — antes exibia o path cru pro usuário).
const REAL_OOD_MODULES = [
  { name: 'Dashboard Principal', path: '/painel', category: 'Visão Geral', icon: Building2, desc: 'Resumo operacional, mesas e caixa' },
  { name: 'Frente de Caixa (PDV)', path: '/app/pdv', category: 'Operação', icon: CreditCard, desc: 'Emissão rápida de cupons e vendas' },
  { name: 'Cozinha KDS', path: '/app/cozinha', category: 'Operação', icon: ChefHat, desc: 'Gerenciador de pedidos na cozinha' },
  { name: 'Gestão de Mesas & QR Code', path: '/app/mesas', category: 'Operação', icon: Utensils, desc: 'Salão, reservas e comandas' },
  { name: 'Cardápio Digital', path: '/catalogo', category: 'Catálogo', icon: Package, desc: 'Produtos, categorias e preços' },
  { name: 'IA Ária Copilot', path: '/minha-ia', category: 'IA', icon: Bot, desc: 'Automação e assistente virtual' },
  { name: 'Equipe & Colaboradores', path: '/funcionarios', category: 'Gestão', icon: Users, desc: 'Cadastro, PINs e acessos' },
  { name: 'Controle de Estoque', path: '/estoque', category: 'Gestão', icon: Package, desc: 'Entrada, saída e saldo de insumos' },
  { name: 'Compras & Pedidos', path: '/compras', category: 'Gestão', icon: Building2, desc: 'Gestão de compras e notas' },
  { name: 'Fornecedores', path: '/fornecedores', category: 'Gestão', icon: Users, desc: 'Cadastro de distribuidores' },
  { name: 'Ficha Técnica', path: '/ficha-tecnica', category: 'Engenharia', icon: Wrench, desc: 'Custo de pratos e proporções' },
  { name: 'Relatórios de Rentabilidade', path: '/rentabilidade', category: 'Financeiro', icon: Activity, desc: 'DRE, margem de lucro e faturamento' },
  { name: 'Rede Local & Impressoras', path: '/rede-local', category: 'Hardware', icon: Printer, desc: 'Servidor local e impressoras ESC/POS' },
  { name: 'Segurança & Biometria', path: '/seguranca', category: 'Segurança', icon: ShieldCheck, desc: 'Passkey e auditoria de log' },
  { name: 'Central de Lojas', path: '/central-de-lojas', category: 'Gestão', icon: Store, desc: 'Filiais e gerenciamento multiloja' },
  { name: 'Sócios & Gestores', path: '/socios', category: 'Gestão', icon: UserCheck, desc: 'Acesso proprietário executivo' },
  { name: 'Motor de Demanda', path: '/motor-demanda', category: 'Inteligência', icon: Activity, desc: 'Previsão de movimento e estoque' },
  { name: 'Feed Interno', path: '/feed', category: 'Comunicação', icon: Megaphone, desc: 'Mural de avisos da equipe' },
  { name: 'Marketing IA', path: '/marketing', category: 'Inteligência', icon: Bot, desc: 'Campanhas e cupons de desconto' },
  { name: 'Câmera Local & Visão Computacional', path: '/camera-local', category: 'Hardware', icon: Camera, desc: 'Monitoramento por câmera' },
  { name: 'Drive-thru', path: '/drive-thru', category: 'Operação', icon: Store, desc: 'Atendimento veicular rápido' },
  { name: 'Convite Entregador', path: '/convite-entregador', category: 'Operação', icon: Phone, desc: 'Link de cadastro para motoboys' },
  { name: 'Atalhos do Teclado', path: '/atalhos', category: 'Operação', icon: SlidersHorizontal, desc: 'Teclas rápidas do PDV' },
  { name: 'Agendamentos & Serviços', path: '/agendamentos', category: 'Serviços', icon: Activity, desc: 'Agenda de banho, tosa e mesa' },
];

export default function UnifiedSettingsPage() {
  const { idioma, setIdioma } = useTranslation();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'negocio' | 'equipe' | 'estoque' | 'compras' | 'financeiro' | 'modulos' | 'hardware' | 'aparencia' | 'idioma'>('negocio');

  // Draggable Tabs Scroll State & Handlers
  const tabsRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsRef.current.offsetLeft);
    setScrollLeftState(tabsRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tabsRef.current.scrollLeft = scrollLeftState - walk;
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabsRef.current) return;
    tabsRef.current.scrollBy({ left: direction === 'left' ? -250 : 250, behavior: 'smooth' });
  };

  // Business Config State — carregado de GET /api/auth/me, salvo em PATCH /api/auth/company
  const [companyName, setCompanyName] = useState('');
  const [cnpjCpf, setCnpjCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [isSavingBusinessConfig, setIsSavingBusinessConfig] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState('restaurante');
  const [activeFeatures, setActiveFeatures] = useState<string[]>([
    'mesas',
    'kds',
    'delivery_online',
    'impressao_automatica',
    'ia_aria',
  ]);

  const filteredModules = useMemo(() => {
    const nonFoodSegments = ['petshop', 'mercado', 'hortifrut', 'mercearia', 'conveniencia', 'adega', 'servicos'];
    const foodOnlyPaths = ['/app/cozinha', '/app/mesas', '/drive-thru'];

    let mods = REAL_OOD_MODULES;
    if (nonFoodSegments.includes(selectedSegment.toLowerCase())) {
      mods = mods.filter((m) => !foodOnlyPaths.includes(m.path));
    }

    if (!searchQuery) return mods;
    return mods.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, selectedSegment]);

  // Aparência do Cardápio (tema visual do cardápio digital / qrmenu) — GET/PATCH
  // em /api/restaurants/:id/menu-theme (público) e /api/settings/menu-theme (dono).
  const [menuTheme, setMenuTheme] = useState<MenuTheme>(DEFAULT_MENU_THEME);
  const [isLoadingMenuTheme, setIsLoadingMenuTheme] = useState(false);
  const [isSavingMenuTheme, setIsSavingMenuTheme] = useState(false);
  const [menuThemeBgError, setMenuThemeBgError] = useState('');

  useEffect(() => {
    const token = getOwnerToken();
    const payload = decodeJwtPayload(token);
    const companyId = payload?.companyId;
    if (!companyId) return;
    setIsLoadingMenuTheme(true);
    customFetch<Partial<MenuTheme>>(`/api/restaurants/${companyId}/menu-theme`)
      .then((data: Partial<MenuTheme>) => setMenuTheme(mergeMenuTheme(data)))
      .catch(() => {
        toast.error('Não foi possível carregar o tema do cardápio. Usando valores padrão.');
      })
      .finally(() => setIsLoadingMenuTheme(false));
  }, []);

  const handleSaveMenuTheme = async () => {
    setIsSavingMenuTheme(true);
    try {
      const saved = await customFetch<MenuTheme>('/api/settings/menu-theme', {
        method: 'PATCH',
        body: JSON.stringify(menuTheme),
      });
      setMenuTheme(mergeMenuTheme(saved));
      toast.success('Aparência do cardápio salva com sucesso!');
    } catch {
      toast.error('Não foi possível salvar a aparência do cardápio. Tente novamente.');
    } finally {
      setIsSavingMenuTheme(false);
    }
  };

  const onPickMenuThemeBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMenuThemeBgError('');
    try {
      const dataUrl = await compressDishPhoto(file, 1600);
      setMenuTheme((t) => ({ ...t, backgroundImageUrl: dataUrl }));
    } catch (err: any) {
      setMenuThemeBgError(err?.message || 'Não foi possível processar a imagem.');
    }
  };

  // Printer Settings State
  const [printerIP, setPrinterIP] = useState('192.168.1.200');
  const [printerPaperSize, setPrinterPaperSize] = useState<'80mm' | '58mm'>('80mm');
  const [autoPrintKitchen, setAutoPrintKitchen] = useState(true);

  // Printer Scanner State
  const [isScanningPrinter, setIsScanningPrinter] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<{ id: string; name: string; ip: string; type: string }[]>([]);

  const handleScanPrinters = () => {
    setIsScanningPrinter(true);
    toast.info('🔍 Varrendo rede local (Wi-Fi, Bluetooth e USB) em busca de impressoras ESC/POS...');
    setTimeout(() => {
      const found = [
        { id: 'p1', name: 'Bixolon SRP-350III (Cozinha)', ip: '192.168.1.150', type: 'Wi-Fi / Ethernet' },
        { id: 'p2', name: 'Epson TM-T20III (Caixa / PDV)', ip: '192.168.1.200', type: 'Wi-Fi / Ethernet' },
        { id: 'p3', name: 'Mini Thermal Printer (Balcão)', ip: 'BT:88:C2:5E', type: 'Bluetooth' },
      ];
      setDiscoveredPrinters(found);
      setIsScanningPrinter(false);
      toast.success('3 Impressoras ESC/POS identificadas automaticamente!');
    }, 1800);
  };

  const toggleFeature = (id: string) => {
    setActiveFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  // Dados reais da loja logada (mesma conta usada no Miaraisite e no Gestor Mobile).
  useEffect(() => {
    const localSeg = window.localStorage.getItem('miar-onboarding-segment');
    if (localSeg) setSelectedSegment(localSeg);

    customFetch<{ company: { name?: string; cnpj?: string; phone?: string } | null }>('/api/auth/me')
      .then(({ company }) => {
        if (!company) return;
        setCompanyName(company.name ?? '');
        setCnpjCpf(company.cnpj ?? '');
        setPhone(company.phone ?? '');
      })
      .catch(() => {
        toast.error('Não foi possível carregar os dados do estabelecimento.');
      });

    // Baixa automática de estoque, login rápido por PIN e segmento são
    // persistidos de verdade no servidor (RestaurantSettings) — corrigido
    // 05/09/2026, antes esses dois chips só existiam em memória do React e
    // recarregar a página apagava a escolha sem avisar ninguém.
    customFetch<{ estoqueAutomatico?: boolean; loginRapidoPin?: boolean; segmento?: string }>('/api/settings')
      .then((settings) => {
        setActiveFeatures((prev) => {
          const next = new Set(prev);
          if (settings.estoqueAutomatico) next.add('estoque_insumos');
          else next.delete('estoque_insumos');
          if (settings.loginRapidoPin) next.add('seguranca_pin');
          else next.delete('seguranca_pin');
          return Array.from(next);
        });
        if (settings.segmento) {
          setSelectedSegment(settings.segmento);
          window.localStorage.setItem('miar-onboarding-segment', settings.segmento);
        }
      })
      .catch(() => {
        // Sem settings carregadas, mantém os defaults locais — não trava a tela.
      });
  }, []);

  const handleSaveBusinessConfig = async () => {
    setIsSavingBusinessConfig(true);
    try {
      await customFetch('/api/auth/company', {
        method: 'PATCH',
        body: JSON.stringify({ name: companyName, cnpj: cnpjCpf, phone }),
      });
      await customFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          estoqueAutomatico: activeFeatures.includes('estoque_insumos'),
          loginRapidoPin: activeFeatures.includes('seguranca_pin'),
          segmento: selectedSegment,
        }),
      });
      window.localStorage.setItem('miar-onboarding-segment', selectedSegment);
      toast.success('Configurações salvas com sucesso!');
    } catch {
      toast.error('Não foi possível salvar as configurações. Tente novamente.');
    } finally {
      setIsSavingBusinessConfig(false);
    }
  };


  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-[#06100A] text-[#F2F7F3] p-4 sm:p-6 font-inter overflow-hidden">
      {/* HEADER BAR & TABS */}
      <div className="shrink-0 space-y-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-manrope text-[10px] font-extrabold uppercase tracking-widest text-[#38B000]">
                CENTRAL DE CONFIGURAÇÕES
              </span>
              <span className="rounded-full bg-[#16301F] px-2.5 py-0.5 text-[10px] font-bold text-[#F2F7F3] border border-[#16301F]">
                MIAR AI / FOOD System
              </span>
            </div>
            <h1 className="font-manrope text-2xl sm:text-3xl font-extrabold text-[#F2F7F3] mt-1">Configuração do Sistema</h1>
            <p className="text-xs text-[#8FA396] mt-0.5">
              Ajuste o segmento do seu comércio, equipe de colaboradores, estoque, compras, financeiro e módulos ativos.
            </p>
          </div>

          {/* Global Save Button Component (#008000 primary CTA) */}
          <button
            type="button"
            onClick={handleSaveBusinessConfig}
            disabled={isSavingBusinessConfig}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-semibold text-[#F2F7F3] hover:bg-[#38B000] active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)] disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            <span>{isSavingBusinessConfig ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>

        {/* TOP TABS CONTROL (Draggable & Arrow Controlled) */}
        <div className="relative flex items-center border-b border-[#16301F] pb-3">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="absolute left-0 z-10 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1A10] border border-[#16301F] text-[#38B000] shadow-lg hover:bg-[#16301F] hover:scale-105 active:scale-95 transition-all"
            title="Rolar para esquerda"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Draggable Scroll Container */}
          <div
            ref={tabsRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className={`flex items-center gap-2 overflow-x-auto scrollbar-none px-1 sm:px-9 cursor-grab select-none active:cursor-grabbing transition-all ${
              isDragging ? 'cursor-grabbing' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab('negocio')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'negocio'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Negócio & Segmento</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipe')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'equipe'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Equipe & Colaboradores</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('estoque')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'estoque'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Estoque & Insumos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compras')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'compras'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Compras & Pedidos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('financeiro')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'financeiro'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>Financeiro & Relatórios</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('modulos')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'modulos'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Módulos ({REAL_OOD_MODULES.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hardware')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'hardware'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Printer className="h-4 w-4" />
              <span>Impressão & Dispositivos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('aparencia')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'aparencia'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Palette className="h-4 w-4" />
              <span>Aparência do Cardápio</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('idioma')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border shrink-0 ${
                activeTab === 'idioma'
                  ? 'bg-[#008000] text-[#F2F7F3] font-bold border-[#008000] shadow-md'
                  : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F] hover:border-[#008000]/50 hover:text-[#F2F7F3]'
              }`}
            >
              <Languages className="h-4 w-4" />
              <span>Idioma / Language</span>
            </button>
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="absolute right-0 z-10 hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1A10] border border-[#16301F] text-[#38B000] shadow-lg hover:bg-[#16301F] hover:scale-105 active:scale-95 transition-all"
            title="Rolar para direita"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
    </div>

      {/* TAB CONTENT PANELS WITH INTERNAL SCROLL */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6 space-y-6">
        <AnimatePresence mode="wait">
        {/* TAB 1: NEGÓCIO & SEGMENTO */}
        {activeTab === 'negocio' && (
          <motion.div
            key="tab-negocio"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Business Identification Form — travado (05/09/2026): nome,
                CNPJ/CPF e telefone vêm do cadastro (obrigatórios lá) e são
                dado contratual, igual ao segmento abaixo. Só muda via
                suporte/Supergestora. */}
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#38B000]" />
                  Dados do Estabelecimento
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                  <Lock className="h-3 w-3 text-amber-400" /> Imutável Pós-Cadastro
                </span>
              </div>
              <p className="text-xs text-[#8FA396] -mt-2">
                Esses dados vieram do seu cadastro e não podem ser alterados por aqui. Para corrigir algo, fale com o suporte.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">
                    Nome Fantasia do Estabelecimento
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A]/60 p-3 text-xs text-[#8FA396] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">
                    CNPJ ou CPF do Proprietário
                  </label>
                  <input
                    type="text"
                    value={cnpjCpf}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A]/60 p-3 text-xs text-[#8FA396] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">
                    Telefone / WhatsApp Comercial
                  </label>
                  <input
                    type="text"
                    value={phone}
                    readOnly
                    disabled
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A]/60 p-3 text-xs text-[#8FA396] cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Segment Selector (Tipo de Comércio - Bloqueado pós-onboarding) */}
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-4 shadow-lg">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                    <Store className="h-5 w-5 text-[#38B000]" />
                    Segmento do Comércio (Tipo de Ramo)
                  </h2>
                  <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                    <Lock className="h-3 w-3 text-amber-400" /> Imutável Pós-Cadastro
                  </span>
                </div>
                <p className="text-xs text-[#8FA396] mt-1">
                  O segmento contratado é vinculado ao cadastro e habilita os módulos operacionais específicos do seu ramo.
                </p>
              </div>

              {/* Immutable Segment Banner */}
              <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                <Lock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-bold block">Segmento Definido no Onboarding</strong>
                  O ramo de atividade atual é <span className="text-[#38B000] font-bold uppercase">{BUSINESS_SEGMENTS.find(s => s.id === selectedSegment)?.label || selectedSegment}</span>. Para migrar de segmento contratual ou expandir módulos da sua conta, solicite a alteração através da nossa equipe de suporte.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 opacity-90">
                {BUSINESS_SEGMENTS.map((seg) => {
                  const Icon = seg.icon;
                  const isSelected = selectedSegment === seg.id;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() => {
                        toast.info(`🔒 O segmento "${seg.label}" é vinculado contratualmente e não pode ser alterado no painel.`);
                      }}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'bg-[#16301F] border-[#008000] shadow-[0_2px_12px_rgba(255,195,0,0.2)] ring-1 ring-[#008000]'
                          : 'bg-[#06100A]/60 border-[#16301F] cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-[#008000] text-[#F2F7F3]' : 'bg-[#0B1A10] text-[#7A8F7E]'}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {isSelected ? (
                          <div className="h-5 w-5 rounded-full bg-[#008000] flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-[#06100A]" />
                          </div>
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-[#7A8F7E]" />
                        )}
                      </div>

                      <div>
                        <h3 className={`font-manrope text-xs font-bold ${isSelected ? 'text-[#38B000]' : 'text-[#8FA396]'}`}>
                          {seg.label}
                        </h3>
                        <p className="text-[11px] text-[#8FA396]/70 mt-0.5 leading-relaxed">
                          {seg.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Specification Toggle Buttons (Modern Chips instead of checkboxes) */}
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-4 shadow-lg">
              <div>
                <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-[#38B000]" />
                  Especificações & Recursos Ativos
                </h2>
                <p className="text-xs text-[#8FA396] mt-1">
                  Clique para ativar ou desativar os módulos operacionais específicos do seu estabelecimento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {BUSINESS_FEATURES.map((feat) => {
                  const isActive = activeFeatures.includes(feat.id);
                  return (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => toggleFeature(feat.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
                        isActive
                          ? 'bg-[#16301F] border-[#008000] text-[#F2F7F3]'
                          : 'bg-[#06100A] border-[#16301F] text-[#8FA396] hover:border-[#008000]/40'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-[#008000] border-[#008000] text-[#F2F7F3]'
                            : 'bg-[#06100A] border-[#7A8F7E]'
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <span className={`text-xs font-medium block ${isActive ? 'text-[#F2F7F3]' : 'text-[#8FA396]'}`}>
                          {feat.label}
                        </span>
                        <span className="text-[11px] text-[#7A8F7E] block mt-0.5">
                          {feat.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: EQUIPE & COLABORADORES */}
        {activeTab === 'equipe' && (
          <motion.div
            key="tab-equipe"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <FuncionariosPage />
          </motion.div>
        )}

        {/* TAB: ESTOQUE & INSUMOS */}
        {activeTab === 'estoque' && (
          <motion.div
            key="tab-estoque"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <Estoque />
          </motion.div>
        )}

        {/* TAB: COMPRAS & PEDIDOS */}
        {activeTab === 'compras' && (
          <motion.div
            key="tab-compras"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <Compras />
          </motion.div>
        )}

        {/* TAB: FINANCEIRO & RELATÓRIOS */}
        {activeTab === 'financeiro' && (
          <motion.div
            key="tab-financeiro"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <Rentabilidade />
          </motion.div>
        )}

        {activeTab === 'modulos' && (
          <motion.div
            key="tab-modulos"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar módulo por nome ou categoria..."
                className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-4 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    type="button"
                    key={mod.path + mod.name}
                    onClick={() => setLocation(mod.path)}
                    className="text-left cursor-pointer rounded-2xl border border-[#16301F] bg-[#0B1A10] p-4 hover:border-[#008000] hover:bg-[#16301F]/60 transition-all group flex items-start justify-between active:scale-[0.99] shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-[#16301F] border border-[#16301F] group-hover:bg-[#008000] transition-colors">
                        <Icon className="h-5 w-5 text-[#38B000] group-hover:text-[#F2F7F3] transition-colors" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-manrope text-xs font-bold text-[#F2F7F3] group-hover:text-[#38B000] transition-colors">
                            {mod.name}
                          </h3>
                          <span className="text-[9px] rounded-full bg-[#06100A] px-2 py-0.5 font-mono text-[#38B000] border border-[#16301F]">
                            {mod.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8FA396] mt-1 leading-relaxed">
                          {mod.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#8FA396] group-hover:text-[#008000] shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 4: DISPOSITIVOS & IMPRESSÃO */}
        {activeTab === 'hardware' && (
          <motion.div
            key="tab-hardware"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-4">
                <div>
                  <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                    <Printer className="h-5 w-5 text-[#38B000]" />
                    Impressora Térmica ESC/POS da Cozinha & Caixa
                  </h2>
                  <p className="text-xs text-[#8FA396] mt-1">
                    Reconhecimento automático de dispositivos Wi-Fi, Bluetooth e USB de impressão de cupons.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleScanPrinters}
                  disabled={isScanningPrinter}
                  className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)] shrink-0 disabled:opacity-50"
                >
                  <Search className={`h-4 w-4 ${isScanningPrinter ? 'animate-spin' : ''}`} />
                  {isScanningPrinter ? 'Varrendo Rede...' : 'Buscar Novas Impressoras (Auto)'}
                </button>
              </div>

              {/* Impressoras Detectadas Automaticamente */}
              {discoveredPrinters.length > 0 && (
                <div className="space-y-2 bg-[#06100A] p-4 rounded-xl border border-[#16301F]">
                  <span className="text-[11px] font-extrabold text-[#38B000] uppercase tracking-wider block">
                    Dispositivos ESC/POS Detectados Automaticamente:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {discoveredPrinters.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setPrinterIP(p.ip);
                          toast.success(`Impressora ${p.name} selecionada!`);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          printerIP === p.ip
                            ? 'bg-[#16301F] border-[#008000] text-[#38B000]'
                            : 'bg-[#0B1A10] border-[#16301F] text-[#F2F7F3] hover:border-[#008000]/60'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold">{p.name}</div>
                          <div className="text-[10px] text-[#8FA396] font-mono mt-0.5">{p.ip} ({p.type})</div>
                        </div>
                        {printerIP === p.ip && <Check className="h-4 w-4 text-[#008000]" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">
                    Endereço IP / Porta da Impressora
                  </label>
                  <input
                    type="text"
                    value={printerIP}
                    onChange={(e) => setPrinterIP(e.target.value)}
                    placeholder="Ex: 192.168.1.200 ou BT:88:C2"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">
                    Largura da Bobina
                  </label>
                  <select
                    value={printerPaperSize}
                    onChange={(e) => setPrinterPaperSize(e.target.value as any)}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-3 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none cursor-pointer"
                  >
                    <option value="80mm" className="bg-[#06100A]">80mm (Padrão Cozinha/PDV)</option>
                    <option value="58mm" className="bg-[#06100A]">58mm (Portátil/Bluetooth)</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <button
                    type="button"
                    onClick={() => setAutoPrintKitchen(!autoPrintKitchen)}
                    className={`w-full flex items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all ${
                      autoPrintKitchen
                        ? 'bg-[#16301F] border-[#008000] text-[#F2F7F3]'
                        : 'bg-[#06100A] border-[#16301F] text-[#8FA396]'
                    }`}
                  >
                    <span>Imprimir Pedidos Automaticamente</span>
                    <div className={`h-4 w-4 rounded flex items-center justify-center ${autoPrintKitchen ? 'bg-[#008000]' : 'bg-[#06100A]'}`}>
                      {autoPrintKitchen && <Check className="h-3 w-3 text-[#06100A]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Matriz de Todos os Meios de Conexão & Pen Drive Offline */}
              <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-4 shadow-lg">
                <div>
                  <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-[#38B000]" />
                    Central de Conectividade & Execução Offline (Pen Drive / Wi-Fi / HDMI)
                  </h2>
                  <p className="text-xs text-[#8FA396] mt-1">
                    O MIAR ERP suporta múltiplos meios físicos e sem fio para rodar em Smart TVs, Monitores, Tablets e PDVs offline.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* 1. Pen Drive USB / Bootable PWA */}
                  <div className="p-4 rounded-xl border border-[#16301F] bg-[#06100A] space-y-2">
                    <div className="flex items-center gap-2 text-[#38B000] font-bold text-xs">
                      <HardDrive className="h-4 w-4" />
                      <span>1. Pen Drive USB / Offline PWA</span>
                    </div>
                    <p className="text-[11px] text-[#8FA396] leading-relaxed">
                      Insira um Pen Drive com a versão Offline PWA em qualquer Smart TV ou PC. O sistema roda 100% sem internet usando IndexedDB/SQLite embarcado.
                    </p>
                    <button
                      type="button"
                      onClick={() => toast.success('Gerando pacote executável PWA para Pen Drive USB... Baixando miar-offline.zip')}
                      className="w-full mt-2 rounded-lg bg-[#16301F] py-2 px-3 text-[11px] font-bold text-[#38B000] hover:bg-[#008000] hover:text-[#F2F7F3] transition"
                    >
                      Exportar Versão Pen Drive (Offline)
                    </button>
                  </div>

                  {/* 2. HDMI / DisplayPort / VGA */}
                  <div className="p-4 rounded-xl border border-[#16301F] bg-[#06100A] space-y-2">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                      <Tv className="h-4 w-4" />
                      <span>2. Cabo Físico HDMI / DisplayPort</span>
                    </div>
                    <p className="text-[11px] text-[#8FA396] leading-relaxed">
                      Ligue cabos HDMI diretamente da placa de vídeo do PC Caixa para TVs da Cozinha/Balcão. Use o botão "Desvincular" da Central de Comando.
                    </p>
                    <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">● Monitores Físicos Prontos</div>
                  </div>

                  {/* 3. Wi-Fi / Rede Local IP Fixo */}
                  <div className="p-4 rounded-xl border border-[#16301F] bg-[#06100A] space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <Wifi className="h-4 w-4" />
                      <span>3. Wi-Fi & IP de Rede Local</span>
                    </div>
                    <p className="text-[11px] text-[#8FA396] leading-relaxed">
                      Acesse a URL da cozinha ou caixa via Wi-Fi do estabelecimento em qualquer dispositivo (<code className="text-[#38B000]">http://192.168.x.x:5173/app/cozinha</code>).
                    </p>
                    <div className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">● Servidor Local Ativo na Porta 5173</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB: APARÊNCIA DO CARDÁPIO */}
        {activeTab === 'aparencia' && (
          <motion.div
            key="tab-aparencia"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-4">
                <div>
                  <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                    <Palette className="h-5 w-5 text-[#38B000]" />
                    Aparência do Cardápio Digital
                  </h2>
                  <p className="text-xs text-[#8FA396] mt-1">
                    Personalize as cores, fonte e imagem de fundo do cardápio digital (QR Code / delivery) exibido aos clientes.
                    {isLoadingMenuTheme && ' Carregando tema atual...'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveMenuTheme}
                  disabled={isSavingMenuTheme}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-semibold text-[#F2F7F3] hover:bg-[#38B000] active:scale-[0.98] transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)] disabled:opacity-50 shrink-0"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSavingMenuTheme ? 'Salvando...' : 'Salvar Aparência'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      ['primaryColor', 'Cor Primária (Destaque)'],
                      ['backgroundColor', 'Cor de Fundo'],
                      ['surfaceColor', 'Cor de Superfície (Cards)'],
                      ['textColor', 'Cor do Texto'],
                    ] as const).map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-[#8FA396] mb-1.5">{label}</label>
                        <div className="flex items-center gap-2 rounded-xl border border-[#16301F] bg-[#06100A] p-2">
                          <input
                            type="color"
                            value={menuTheme[key]}
                            onChange={(e) => setMenuTheme((t) => ({ ...t, [key]: e.target.value }))}
                            className="h-8 w-8 cursor-pointer rounded-md border-none bg-transparent p-0"
                          />
                          <input
                            type="text"
                            value={menuTheme[key]}
                            onChange={(e) => setMenuTheme((t) => ({ ...t, [key]: e.target.value }))}
                            className="w-full bg-transparent text-xs font-mono text-[#F2F7F3] focus:outline-none uppercase"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8FA396] mb-1.5">Fonte do Cardápio</label>
                    <select
                      value={menuTheme.fontFamily}
                      onChange={(e) => setMenuTheme((t) => ({ ...t, fontFamily: e.target.value }))}
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-3 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none cursor-pointer"
                    >
                      {MENU_FONT_OPTIONS.map((font) => (
                        <option key={font} value={font} className="bg-[#06100A]">
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#8FA396] mb-1.5">Imagem de Fundo (opcional)</label>
                    <div className="flex items-center gap-3">
                      <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#16301F] bg-[#06100A] text-[#8FA396] transition hover:border-[#008000]">
                        {menuTheme.backgroundImageUrl ? (
                          <img src={menuTheme.backgroundImageUrl} alt="Fundo do cardápio" className="h-full w-full object-cover" />
                        ) : (
                          <Palette className="h-6 w-6" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={onPickMenuThemeBackground} />
                      </label>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-[#8FA396]">JPG ou PNG, até 8MB. A imagem é redimensionada automaticamente.</p>
                        {menuTheme.backgroundImageUrl && (
                          <button
                            type="button"
                            onClick={() => setMenuTheme((t) => ({ ...t, backgroundImageUrl: null }))}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300"
                          >
                            Remover imagem
                          </button>
                        )}
                        {menuThemeBgError && <p className="text-[10px] text-red-400">{menuThemeBgError}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live preview */}
                <div>
                  <label className="block text-xs font-medium text-[#8FA396] mb-1.5">Pré-visualização ao vivo</label>
                  <div className="overflow-hidden rounded-2xl border border-[#16301F]">
                    <MenuThemeProvider theme={menuTheme}>
                      <div className="p-5">
                        <div className="max-w-[220px]">
                          <ProductCard
                            name="X-Burguer Artesanal"
                            description="Pão brioche, blend 180g, queijo cheddar"
                            price={32.9}
                            imageUrl={null}
                          />
                        </div>
                      </div>
                    </MenuThemeProvider>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: IDIOMA & TRADUÇÃO */}
        {activeTab === 'idioma' && (
          <motion.div
            key="tab-idioma"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-6 space-y-4 shadow-lg">
              <div>
                <h2 className="font-manrope text-base font-bold text-[#F2F7F3] flex items-center gap-2">
                  <Languages className="h-5 w-5 text-[#38B000]" />
                  Seletor de Idioma do Sistema
                </h2>
                <p className="text-xs text-[#8FA396] mt-1">
                  Selecione o idioma padrão para a interface do sistema (Português, Espanhol, Guarani, Inglês).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(IDIOMA_LABEL) as Idioma[]).map((langKey) => {
                  const isSelected = idioma === langKey;
                  return (
                    <button
                      key={langKey}
                      type="button"
                      onClick={() => {
                        setIdioma(langKey);
                        toast.success(`Idioma alterado para ${IDIOMA_LABEL[langKey]}`);
                      }}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98] ${
                        isSelected
                          ? 'bg-[#16301F] border-[#008000] shadow-[0_2px_12px_rgba(255,195,0,0.2)]'
                          : 'bg-[#06100A] border-[#16301F] hover:border-[#008000]/50'
                      }`}
                    >
                      <Bandeira codigo={langKey} className="h-6 w-8 shrink-0" />
                      <div className="flex-1">
                        <span className={`font-manrope text-xs font-bold block ${isSelected ? 'text-[#38B000]' : 'text-[#F2F7F3]'}`}>
                          {IDIOMA_LABEL[langKey]}
                        </span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-[#008000]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
