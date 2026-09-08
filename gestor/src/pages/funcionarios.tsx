import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  Users,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  AlertTriangle,
  KeyRound,
  Edit2,
  X,
  Phone,
  ChefHat,
  CreditCard,
  Utensils,
  UserCheck,
  Check,
  Camera,
  MapPin,
  Calendar,
  Percent,
  Eye,
  EyeOff,
  UtensilsCrossed,
  LayoutDashboard,
  BookOpen,
  Bot,
  Settings,
  Package,
  Tv,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { lojaHeaders } from '@/lib/loja';
import { useTranslation } from '@/i18n/IdiomaContext';
import { ConfirmModal } from '@/components/ConfirmModal';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

type Employee = {
  id: string;
  name: string;
  // CORRIGIDO 04/09/2026: agora existe de verdade — gerado pelo backend
  // (slug do nome + sufixo numérico se precisar) e é o que o funcionário
  // digita na tela de login junto com o PIN (ver POST /employees/verify-pin
  // em api-server/src/routes/employees.ts). `pin` nunca volta do backend
  // em nenhuma resposta (só hash bcrypt existia ali, e é filtrado antes de
  // sair da API) — PIN é write-only.
  username?: string;
  role: string;
  customRoleTitle?: string;
  active: boolean;
  phone?: string;
  photoUrl?: string;
  // Cadastro completo do entregador (preenchido por ele via convite, ver
  // artifacts/entregador/src/App.tsx e POST /api/delivery-invites/:token/register).
  cpf?: string;
  vehiclePlate?: string;
  documentPhoto?: string;
  selfiePhoto?: string;
  documentVerifiedAt?: string | null;
  // CORRIGIDO 04/09/2026: era tipado como `string[]` (lista de nomes de
  // módulo), mas o backend sempre devolveu o objeto EmployeePermissions
  // real (viewKitchen, viewTables, closeCashier, ...) — daí o card mostrar
  // sempre "7 Módulos" fixo pra todo mundo: `.length` num objeto é sempre
  // undefined, caindo direto no fallback. Ver visibleModuleLabels() abaixo.
  permissions?: Record<string, boolean>;
};

// Deriva os módulos realmente visíveis a partir das flags de permissão de
// verdade — mesma lógica que App.tsx usa pra decidir o que o funcionário vê
// depois do login Operacional (temCozinha = viewKitchen, temCaixa =
// viewCashier || closeCashier, temMesas = viewTables).
function visibleModuleLabels(permissions?: Record<string, boolean>): string {
  if (!permissions) return 'Nenhum módulo';
  const modules: string[] = [];
  if (permissions.viewKitchen) modules.push('Cozinha');
  if (permissions.viewCashier || permissions.closeCashier) modules.push('Caixa');
  if (permissions.viewTables) modules.push('Mesas');
  if (permissions.viewStock) modules.push('Estoque');
  if (permissions.viewReports) modules.push('Relatórios');
  if (permissions.viewEmployees || permissions.manageEmployees) modules.push('Funcionários');
  if (permissions.viewSettings || permissions.manageSettings) modules.push('Configurações');
  if (permissions.viewDelivery) modules.push('Logística');
  return modules.length > 0 ? modules.join(', ') : 'Nenhum módulo';
}

const ROLE_LABEL: Record<string, { label: string; badgeClass: string; icon: any }> = {
  owner: { label: 'Dono / Administrador', badgeClass: 'bg-[#008000]/20 text-[#38B000] border-[#008000]/40', icon: UserCheck },
  manager: { label: 'Gerente / Gestor', badgeClass: 'bg-[#008000]/20 text-[#38B000] border-[#008000]/40', icon: UserCheck },
  cashier: { label: 'Caixa', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: CreditCard },
  waiter: { label: 'Garçom / Atendente', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40', icon: UtensilsCrossed },
  cook: { label: 'Cozinha', badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40', icon: ChefHat },
  delivery: { label: 'Logística / Despachante', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Package },
  custom: { label: 'Função Personalizada', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: Shield },
};

type RightTab = 'endereco' | 'escala' | 'comissao' | 'acessos' | 'revisao';

const ALL_SYSTEM_MODULES = [
  { key: 'dashboard', name: 'Visão Geral & Dashboard', desc: 'Resumo operacional, gráficos de vendas e métricas da loja.', icon: LayoutDashboard, roles: ['manager'] },
  { key: 'pdv', name: 'PDV / Frente de Caixa', desc: 'Abertura/fechamento de caixa, pagamentos rápidos e emissão de notas.', icon: CreditCard, roles: ['manager', 'cashier', 'waiter'] },
  { key: 'cozinha', name: 'Cozinha KDS & Preparo', desc: 'Monitor de comanda de preparo e status de pratos na cozinha.', icon: ChefHat, roles: ['manager', 'cook'] },
  { key: 'mesas', name: 'Mesas & Comandas (Salão)', desc: 'Atendimento de garçom, mapa de mesas e lançamento de comandas.', icon: UtensilsCrossed, roles: ['manager', 'waiter', 'cashier'] },
  { key: 'comando', name: 'Central Multi-Monitor & Hardwares', desc: 'Grade 2x2 multi-tela, controle de TVs, HDMI e suporte offline.', icon: Tv, roles: ['manager'] },
  { key: 'cardapio', name: 'Cardápio Digital & Catálogo', desc: 'Gestão de produtos, categorias, adicionais e preços.', icon: BookOpen, roles: ['manager', 'cook'] },
  { key: 'estoque', name: 'Controle de Estoque & Insumos', desc: 'Entrada/saída de produtos, saldo e aviso de estoque baixo.', icon: Package, roles: ['manager', 'cook'] },
  { key: 'compras', name: 'Compras & Fornecedores', desc: 'Pedidos de compra, fornecedores e controle de custos.', icon: Users, roles: ['manager'] },
  { key: 'financeiro', name: 'Financeiro & Rentabilidade', desc: 'DRE, fluxo de caixa e relatórios.', icon: CreditCard, roles: ['manager', 'cashier'] },
  { key: 'funcionarios', name: 'Equipe & Permissões', desc: 'Cadastro de colaboradores, PINs e controle de acessos.', icon: Users, roles: ['manager'] },
  { key: 'ia', name: 'IA Ária & Automação', desc: 'Assistente inteligente para sugestão de vendas e promoções.', icon: Bot, roles: ['manager'] },
  { key: 'logistica', name: 'KDS Logística & Despacho', desc: 'Monitoramento de entregas, atribuição e rotas.', icon: Package, roles: ['manager', 'delivery'] },
  { key: 'configuracoes', name: 'Configurações do Sistema', desc: 'Configurações de segmento, impressoras e preferências.', icon: Settings, roles: ['manager'] },
];

export default function FuncionariosPage({ onBackToGrid }: { onBackToGrid?: () => void }) {
  const { t } = useTranslation();
  const [lista, setLista] = useState<Employee[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('acessos');
  const [showPin, setShowPin] = useState(false);

  const [showAllModules, setShowAllModules] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    role: 'waiter',
    customRoleTitle: '',
    pin: '',
    photoUrl: '',
    permissions: ['mesas'] as string[],
    manageTables: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch('/api/employees', {
        headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() },
      });
      if (r.ok) {
        const data = await r.json();
        setLista(data);
        window.localStorage.setItem('miar-cached-employees', JSON.stringify(data));
      } else {
        const stored = window.localStorage.getItem('miar-cached-employees');
        if (stored) setLista(JSON.parse(stored));
      }
    } catch {
      const stored = window.localStorage.getItem('miar-cached-employees');
      if (stored) setLista(JSON.parse(stored));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const interval = setInterval(() => {
      fetch('/api/employees', {
        headers: { Authorization: `Bearer ${getToken()}`, ...lojaHeaders() },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (Array.isArray(data)) setLista(data); })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [carregar]);

  const [statusConfirmTarget, setStatusConfirmTarget] = useState<Employee | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<Employee | null>(null);
  const [executingAction, setExecutingAction] = useState(false);

  const confirmToggleStatus = async () => {
    if (!statusConfirmTarget) return;
    setExecutingAction(true);
    try {
      const r = await fetch(`/api/employees/${statusConfirmTarget.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ active: !statusConfirmTarget.active }),
      });
      if (r.ok) {
        setLista((prev) =>
          prev.map((e) => (e.id === statusConfirmTarget.id ? { ...e, active: !e.active } : e))
        );
        toast.success(`Acesso de ${statusConfirmTarget.name} ${!statusConfirmTarget.active ? 'liberado' : 'bloqueado'}.`);
        setStatusConfirmTarget(null);
      }
    } catch {
      toast.error('Não foi possível alterar o status.');
    } finally {
      setExecutingAction(false);
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteConfirmTarget) return;
    setExecutingAction(true);
    try {
      const r = await fetch(`/api/employees/${deleteConfirmTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (r.ok || r.status === 204) {
        setLista((prev) => prev.filter((e) => e.id !== deleteConfirmTarget.id));
        toast.success(`Colaborador ${deleteConfirmTarget.name} removido com sucesso.`);
        setDeleteConfirmTarget(null);
      }
    } catch {
      toast.error('Não foi possível remover o colaborador.');
    } finally {
      setExecutingAction(false);
    }
  };

  const userRole = (window.localStorage.getItem('miar-current-user-role') || 'owner').toLowerCase();
  const token = getToken();
  const isAuthorizedToEdit = !token || token.startsWith('admin-') || token === 'dev-bypass' || ['owner', 'admin', 'manager', 'gestor'].includes(userRole);

  const handleVerifyDocument = async (emp: Employee) => {
    try {
      const r = await fetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ documentVerifiedAt: new Date().toISOString() }),
      });
      if (!r.ok) { toast.error('Não foi possível marcar como conferido.'); return; }
      const updated: Employee = await r.json();
      setLista((prev) => prev.map((e) => (e.id === emp.id ? updated : e)));
      toast.success(`Documento de ${emp.name} marcado como conferido.`);
    } catch {
      toast.error('Falha de conexão ao confirmar verificação.');
    }
  };

  const handleOpenModal = (emp?: Employee) => {
    if (!isAuthorizedToEdit) {
      toast.error('🔒 Ação Restrita: Apenas administradores ou pessoas autorizadas podem cadastrar ou alterar colaboradores.');
      return;
    }
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        name: emp.name,
        username: emp.username || '',
        role: emp.role || 'waiter',
        customRoleTitle: emp.customRoleTitle || '',
        pin: '',
        photoUrl: emp.photoUrl || '',
        permissions: emp.role === 'waiter' ? ['mesas'] : emp.role === 'cook' ? ['cozinha'] : emp.role === 'delivery' ? ['logistica'] : emp.role === 'cashier' ? ['pdv', 'mesas'] : ALL_SYSTEM_MODULES.map((m) => m.key),
        manageTables: Boolean((emp.permissions as unknown as Record<string, boolean> | undefined)?.manageTables),
      });
    } else {
      setEditingEmp(null);
      const randomPin = Math.floor(1000 + Math.random() * 9000).toString();
      setFormData({
        name: '',
        username: '',
        role: 'waiter',
        customRoleTitle: '',
        pin: randomPin,
        photoUrl: '',
        permissions: ['mesas'],
        manageTables: false,
      });
    }
    setActiveRightTab('acessos');
    setIsModalOpen(true);
  };

  const toggleModulePermission = (modKey: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(modKey);
      const updated = exists
        ? prev.permissions.filter((k) => k !== modKey)
        : [...prev.permissions, modKey];
      return { ...prev, permissions: updated };
    });
  };

  const applyRolePreset = (presetRole: string) => {
    let perms: string[] = [];
    if (presetRole === 'waiter') perms = ['mesas'];
    else if (presetRole === 'cook') perms = ['cozinha'];
    else if (presetRole === 'cashier') perms = ['pdv', 'mesas'];
    else if (presetRole === 'delivery') perms = ['logistica'];
    else perms = ['dashboard', 'pdv', 'cozinha', 'mesas', 'cardapio', 'ia', 'configuracoes'];

    setFormData((prev) => ({
      ...prev,
      role: presetRole,
      permissions: perms,
    }));
    setShowAllModules(false);
    toast.info(`Perfil de permissão '${presetRole.toUpperCase()}' aplicado!`);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error('Preencha o nome do colaborador.');
      return;
    }

    const existingExactMatch = lista.find((emp) => {
      if (editingEmp && emp.id === editingEmp.id) return false;
      return emp.name.trim().toLowerCase() === trimmedName.toLowerCase();
    });

    if (existingExactMatch) {
      toast.error(`⚠️ Já existe um colaborador chamado "${existingExactMatch.name}". Adicione um sobrenome ou identificador de turno (ex: João Silva, João Manhã).`);
      return;
    }

    const words = trimmedName.split(/\s+/);
    const isSingleWord = words.length === 1;
    const inputFirstName = words[0].toLowerCase();

    if (isSingleWord) {
      const duplicateFirstNameEmp = lista.find((emp) => {
        if (editingEmp && emp.id === editingEmp.id) return false;
        const otherFirstName = emp.name.trim().split(/\s+/)[0].toLowerCase();
        return otherFirstName === inputFirstName;
      });

      if (duplicateFirstNameEmp) {
        toast.error(`⚠️ Já existe o colaborador "${duplicateFirstNameEmp.name}". Para criar outro com o primeiro nome "${words[0]}", adicione sobrenome ou turno (ex: ${words[0]} Silva, ${words[0]} Manhã, ${words[0]} Tarde).`);
        return;
      }
    }

    setSaving(true);
    try {
      const token = getToken();
      const payload = {
        name: trimmedName,
        role: formData.role,
        customRoleTitle: formData.customRoleTitle.trim() || undefined,
        username: formData.username.trim() || undefined,
        pin: formData.pin.trim() || undefined,
        active: editingEmp ? editingEmp.active : true,
        permissionOverrides: {
          viewKitchen: formData.permissions.includes('cozinha'),
          viewCashier: formData.permissions.includes('pdv'),
          viewTables: formData.permissions.includes('mesas'),
          viewStock: formData.permissions.includes('estoque'),
          viewReports: formData.permissions.includes('financeiro'),
          viewEmployees: formData.permissions.includes('funcionarios'),
          viewSettings: formData.permissions.includes('configuracoes'),
          viewDelivery: formData.permissions.includes('logistica'),
          manageTables: formData.manageTables, 
        },
      };

      let r;
      if (editingEmp) {
        r = await fetch(`/api/employees/${editingEmp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        r = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      if (r.ok) {
        const savedData: Employee = await r.json();
        setLista((prev) => {
          const updated = editingEmp
            ? prev.map((e) => (e.id === editingEmp.id ? savedData : e))
            : [...prev, savedData];
          window.localStorage.setItem('miar-cached-employees', JSON.stringify(updated));
          return updated;
        });
        if (editingEmp) {
          toast.success('Colaborador atualizado no banco de dados!');
        } else {
          toast.success(
            `Colaborador cadastrado! Login: "${savedData.username}" · PIN: ${formData.pin}`,
            { duration: 10000 },
          );
        }
        setIsModalOpen(false);
      } else {
        const newEmp: Employee = {
          id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
          ...payload,
        };
        setLista((prev) => {
          const updated = editingEmp
            ? prev.map((e) => (e.id === editingEmp.id ? newEmp : e))
            : [...prev, newEmp];
          window.localStorage.setItem('miar-cached-employees', JSON.stringify(updated));
          return updated;
        });
        toast.success(editingEmp ? 'Colaborador atualizado com sucesso!' : 'Novo colaborador cadastrado!');
        setIsModalOpen(false);
      }
    } catch {
      toast.error('Erro ao salvar colaborador.');
    } finally {
      setSaving(false);
    }
  };

  const filteredLista = lista.filter((e) => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterRole !== 'todos' && e.role !== filterRole) return false;
    return true;
  });

  return (
    <div className="space-y-6 select-none font-inter text-[#F2F7F3]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#16301F] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-[#008000]/10 text-[#38B000] border border-[#008000]/30 font-manrope">
              <Users className="h-3 w-3 text-[#38B000]" /> {t('funcionarios.titulo')}
            </span>
          </div>
          <h1 className="text-2xl font-manrope font-black text-[#F2F7F3] mt-1 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-[#008000]" /> {t('funcionarios.titulo')}
          </h1>
          <p className="text-xs text-[#8FA396]">
            {t('funcionarios.subtitulo')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToGrid && (
            <button
              onClick={onBackToGrid}
              className="rounded-xl border border-[#16301F] bg-[#0B1A10] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:border-[#008000]"
            >
              ← {t('btn.voltar')}
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 rounded-xl bg-[#008000] px-4 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-95 transition-all shadow-[0_2px_12px_rgba(255,195,0,0.3)]"
          >
            <Plus className="h-4 w-4" />
            {t('funcionarios.novo')}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0B1A10] p-3 rounded-2xl border border-[#16301F]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('funcionarios.buscar_placeholder')}
            className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2 pl-9 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'todos', label: t('funcionarios.todos_cargos') },
            { id: 'waiter', label: 'Garçons' },
            { id: 'cook', label: 'Cozinha' },
            { id: 'delivery', label: 'Logística' },
            { id: 'cashier', label: 'Caixa' },
            { id: 'manager', label: 'Gestores' },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setFilterRole(role.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all border ${
                filterRole === role.id
                  ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]'
                  : 'bg-[#06100A] text-[#8FA396] border-[#16301F] hover:text-[#F2F7F3]'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLista.map((emp) => {
          const roleConfig = ROLE_LABEL[emp.role] || ROLE_LABEL.custom;
          const Icon = roleConfig.icon;

          return (
            <div
              key={emp.id}
              className="rounded-2xl border border-[#16301F] bg-[#0B1A10] p-4 flex flex-col justify-between shadow-xl hover:border-[#008000]/50 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-[#06100A] border border-[#16301F] flex items-center justify-center font-bold text-sm text-[#38B000]">
                      {emp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-manrope font-bold text-sm text-[#F2F7F3]">{emp.name}</h3>
                      <span className="text-[11px] text-[#8FA396] block">login: {emp.username || '—'}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${roleConfig.badgeClass}`}>
                    <Icon className="h-3 w-3" />
                    {emp.customRoleTitle || roleConfig.label}
                  </span>
                </div>

                <div className="bg-[#06100A] rounded-xl p-2.5 border border-[#16301F] space-y-1.5 text-xs mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8FA396]">Status de Acesso:</span>
                    <span className={`font-bold ${emp.active ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {emp.active ? '● Ativo' : '○ Bloqueado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8FA396]">PIN de Acesso:</span>
                    <span className="font-mono font-bold text-[#38B000]">•••• protegido</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8FA396]">Módulos Visíveis:</span>
                    <span className="font-bold text-sky-300">
                      {visibleModuleLabels(emp.permissions)}
                    </span>
                  </div>
                </div>

                {emp.role === 'delivery' && (emp.documentPhoto || emp.cpf) && (
                  <div className="bg-[#06100A] rounded-xl p-2.5 border border-[#16301F] space-y-2 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8FA396]">CPF:</span>
                      <span className="font-mono text-[#F2F7F3]">{emp.cpf || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8FA396]">Placa:</span>
                      <span className="font-mono text-[#F2F7F3]">{emp.vehiclePlate || '—'}</span>
                    </div>
                    {(emp.documentPhoto || emp.selfiePhoto) && (
                      <div className="flex gap-2 pt-1">
                        {emp.documentPhoto && (
                          <a href={emp.documentPhoto} target="_blank" rel="noreferrer" className="flex-1">
                            <img src={emp.documentPhoto} alt="Documento" className="w-full h-16 object-cover rounded-lg border border-[#16301F]" />
                            <span className="block text-center text-[10px] text-[#8FA396] mt-0.5">Documento</span>
                          </a>
                        )}
                        {emp.selfiePhoto && (
                          <a href={emp.selfiePhoto} target="_blank" rel="noreferrer" className="flex-1">
                            <img src={emp.selfiePhoto} alt="Selfie" className="w-full h-16 object-cover rounded-lg border border-[#16301F]" />
                            <span className="block text-center text-[10px] text-[#8FA396] mt-0.5">Selfie</span>
                          </a>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[#8FA396]">Verificação:</span>
                      {emp.documentVerifiedAt ? (
                        <span className="font-bold text-emerald-400">✓ Conferido</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleVerifyDocument(emp)}
                          className="rounded-lg border border-[#008000]/40 bg-[#008000]/10 px-2 py-1 text-[10px] font-bold text-[#38B000] hover:bg-[#008000]/20"
                        >
                          Marcar como conferido
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#16301F]">
                <button
                  onClick={() => handleOpenModal(emp)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[#16301F] bg-[#06100A] py-2 text-xs font-bold text-[#F2F7F3] hover:border-[#008000]"
                >
                  <Edit2 className="h-3.5 w-3.5 text-[#38B000]" /> Editar Acessos
                </button>

                <button
                  onClick={() => setStatusConfirmTarget(emp)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold border transition-colors ${
                    emp.active
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  }`}
                  title={emp.active ? 'Bloquear Acesso' : 'Liberar Acesso'}
                >
                  {emp.active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </button>

                <button
                  onClick={() => setDeleteConfirmTarget(emp)}
                  className="rounded-xl px-3 py-2 text-xs font-bold border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
                  title="Excluir Colaborador"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#16301F] pb-3 shrink-0">
              <div>
                <h3 className="font-manrope font-extrabold text-lg text-[#F2F7F3]">
                  {editingEmp ? `Editar Colaborador: ${editingEmp.name}` : 'Cadastrar Novo Colaborador'}
                </h3>
                <p className="text-xs text-[#8FA396]">
                  Defina os dados de login e marque quais módulos o colaborador pode visualizar no menu lateral.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#F2F7F3]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden pt-3">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: João da Silva"
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">Função / Cargo Personalizado</label>
                    <input
                      type="text"
                      value={formData.customRoleTitle}
                      onChange={(e) => setFormData({ ...formData, customRoleTitle: e.target.value })}
                      placeholder="Ex: Pizzaiolo, Sub-Gerente..."
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">Usuário de Login</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Ex: joao.silva (gerado automaticamente se vazio)"
                      className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs font-mono text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                    />
                    <p className="text-[10px] text-[#8FA396] mt-1">
                      É isso que o colaborador digita na tela de login, junto com o PIN. Deixe em branco pra gerar automático a partir do nome.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#8FA396] mb-1">
                      {editingEmp ? 'Novo PIN numérico (deixe em branco para manter o atual)' : 'PIN numérico (Senha Operacional) *'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPin ? 'text' : 'password'}
                        maxLength={8}
                        required={!editingEmp}
                        value={formData.pin}
                        onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                        placeholder={editingEmp ? 'Deixe em branco para não alterar' : 'Ex: 1111'}
                        className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 pr-9 text-xs font-mono text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8FA396] hover:text-[#F2F7F3]"
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Role Presets */}
                <div className="bg-[#06100A] p-3 rounded-2xl border border-[#16301F] space-y-2">
                  <span className="text-xs font-bold text-[#38B000] block">Aplicar Atalho de Permissão por Perfil:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyRolePreset('waiter')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                        formData.role === 'waiter' ? 'bg-sky-500 text-slate-950 border-sky-400' : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F]'
                      }`}
                    >
                      <UtensilsCrossed className="h-3.5 w-3.5" /> Perfil Garçom (Apenas Mesas)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('cook')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                        formData.role === 'cook' ? 'bg-orange-500 text-slate-950 border-orange-400' : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F]'
                      }`}
                    >
                      <ChefHat className="h-3.5 w-3.5" /> Perfil Cozinha (Apenas KDS)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('cashier')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                        formData.role === 'cashier' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F]'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" /> Perfil Caixa (PDV & Mesas)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRolePreset('manager')}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                        formData.role === 'manager' ? 'bg-[#008000] text-[#F2F7F3] border-[#008000]' : 'bg-[#0B1A10] text-[#8FA396] border-[#16301F]'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Perfil Gerente / Total
                    </button>
                  </div>
                </div>

                {/* Granular Module Permissions Matrix */}
                <div className="space-y-2 pt-2">
                  {(() => {
                    const isBroadRole = formData.role === 'manager' || formData.role === 'custom';
                    const visibleModules = isBroadRole || showAllModules
                      ? ALL_SYSTEM_MODULES
                      : ALL_SYSTEM_MODULES.filter((mod) => mod.roles.includes(formData.role));
                    const hiddenCount = ALL_SYSTEM_MODULES.length - visibleModules.length;
                    return (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs font-bold text-[#F2F7F3]">
                            Módulos Visíveis no Menu Lateral ({formData.permissions.length} de {ALL_SYSTEM_MODULES.length}):
                          </span>
                          <span className="text-[10px] text-[#8FA396]">
                            Módulos desmarcados serão <strong>completamente ocultados</strong> do menu lateral deste usuário.
                          </span>
                        </div>
                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowAllModules(true)}
                            className="text-[10px] font-bold text-[#38B000] hover:underline"
                          >
                            Mostrando só os módulos do perfil selecionado — ver todos os {ALL_SYSTEM_MODULES.length} módulos
                          </button>
                        )}
                        {showAllModules && !isBroadRole && (
                          <button
                            type="button"
                            onClick={() => setShowAllModules(false)}
                            className="text-[10px] font-bold text-[#38B000] hover:underline"
                          >
                            Voltar a mostrar só os módulos do perfil
                          </button>
                        )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {visibleModules.map((mod) => {
                      const Icon = mod.icon;
                      const isChecked = formData.permissions.includes(mod.key);
                      return (
                        <div
                          key={mod.key}
                          onClick={() => toggleModulePermission(mod.key)}
                          className={`cursor-pointer rounded-2xl border p-3 transition-all flex items-start gap-3 ${
                            isChecked
                              ? 'border-[#008000] bg-[#008000]/10 shadow-[0_0_10px_rgba(255,195,0,0.1)]'
                              : 'border-[#16301F] bg-[#06100A] opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isChecked ? 'bg-[#008000] border-[#008000] text-[#F2F7F3]' : 'border-[#16301F]'
                          }`}>
                            {isChecked && <Check className="h-3 w-3 font-extrabold" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#F2F7F3]">
                              <Icon className="h-3.5 w-3.5 text-[#38B000]" /> {mod.name}
                            </div>
                            <p className="text-[10px] text-[#8FA396] mt-0.5">{mod.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                      </>
                    );
                  })()}
                </div>

                {/* Permissões operacionais reais (EmployeePermissions no backend —
                    diferente da lista de módulos visíveis acima, que é só sobre o
                    que aparece no menu). Controla o que a ação realmente pode fazer,
                    mesma flag checada pelo backend em POST /tables. */}
                <div className="space-y-2 pt-4 border-t border-[#16301F]">
                  <span className="text-xs font-bold text-[#F2F7F3]">Permissões operacionais:</span>
                  <div
                    onClick={() => setFormData((prev) => ({ ...prev, manageTables: !prev.manageTables }))}
                    className={`cursor-pointer rounded-2xl border p-3 transition-all flex items-start gap-3 ${
                      formData.manageTables
                        ? 'border-[#008000] bg-[#008000]/10 shadow-[0_0_10px_rgba(255,195,0,0.1)]'
                        : 'border-[#16301F] bg-[#06100A] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 ${
                      formData.manageTables ? 'bg-[#008000] border-[#008000] text-[#F2F7F3]' : 'border-[#16301F]'
                    }`}>
                      {formData.manageTables && <Check className="h-3 w-3 font-extrabold" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#F2F7F3]">
                        <Plus className="h-3.5 w-3.5 text-[#38B000]" /> Criar novas mesas
                      </div>
                      <p className="text-[10px] text-[#8FA396] mt-0.5">
                        Libera o botão "+ Nova Mesa" na tela de Mesas &amp; Comandas para este colaborador.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Fixed at Bottom */}
              <div className="shrink-0 pt-4 border-t border-[#16301F] flex items-center justify-end gap-3 bg-[#0B1A10] mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-[#16301F] bg-[#06100A] px-4 py-2 text-xs font-semibold text-[#8FA396] hover:text-[#F2F7F3]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#008000] px-5 py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000] disabled:opacity-50 shadow-[0_2px_12px_rgba(255,195,0,0.3)] transition-all"
                >
                  <Check className="h-4 w-4" /> {saving ? 'Salvar...' : 'Salvar Cadastro & Acessos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sensitive Action Modal: Alternar Status do Colaborador */}
      <ConfirmModal
        isOpen={Boolean(statusConfirmTarget)}
        actionName={`${statusConfirmTarget?.active ? 'Bloquear Acesso' : 'Liberar Acesso'} de "${statusConfirmTarget?.name}"`}
        description={
          statusConfirmTarget?.active
            ? 'O colaborador perderá imediatamente o acesso ao PDV, comandas e módulos do sistema.'
            : 'O colaborador voltará a ter acesso liberado com seu PIN cadastrado.'
        }
        confirmText={statusConfirmTarget?.active ? 'Continuar e Bloquear' : 'Continuar e Liberar'}
        onConfirm={confirmToggleStatus}
        onClose={() => setStatusConfirmTarget(null)}
        loading={executingAction}
      />

      {/* Sensitive Action Modal: Exclusão de Colaborador */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmTarget)}
        actionName={`Excluir Colaborador "${deleteConfirmTarget?.name}"`}
        description="Esta ação removerá permanentemente o cadastro do funcionário e revogará seu PIN de autorização."
        confirmText="Continuar e Excluir Colaborador"
        onConfirm={confirmDeleteEmployee}
        onClose={() => setDeleteConfirmTarget(null)}
        loading={executingAction}
      />
    </div>
  );
}
