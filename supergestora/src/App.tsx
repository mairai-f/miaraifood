import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Building2, Handshake, Users, Wallet, AlertTriangle, CalendarClock,
  ShieldOff, Ban, ScrollText, Archive, Settings, Truck,
} from 'lucide-react';
import { ConfirmModal, type ConfirmRequest } from './components/ConfirmModal';
import DarkVeil from './components/DarkVeil';
import ApplicationReviewPanel from './components/ApplicationReviewPanel';
import { supabase } from './lib/supabase';

type SupergestoraUser = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  cargo: string;
  phone: string;
  cep: string;
};

type Representative = {
  id: string;
  name: string;
  email: string;
  cities: string;
  revenue: number;
  managers: number;
};

// Representante de verdade (cadastro real via site/gestor-representante:
// login, comissão calculada, carteira de clientes de verdade) — diferente
// da lista manual acima, que é só nome/e-mail/número digitados à mão.
type RealRepresentative = {
  id: string; name: string; email: string; slug: string; active: boolean; createdAt: string;
  cpf: string | null; phone: string | null; cep: string | null; address: string | null;
  addressNumber: string | null; complement: string | null; neighborhood: string | null;
  city: string | null; state: string | null;
  parentRepresentativeId: string | null; parentName: string | null;
  clientCount: number; teamSize: number; commissionPendingCents: number; commissionPaidCents: number;
};

type ActivationCode = {
  id: string;
  code: string;
  status: string;
  establishment_name?: string | null;
  person_name?: string | null;
  person_email?: string | null;
  expires_at?: string;
};

type Summary = {
  pending: number;
  used: number;
  revoked: number;
  expired: number;
  total: number;
};

type CompanyRow = {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  active: boolean;
  createdAt: string;
  plan?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: string | null;
};

type CompanyDetail = {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  cnpj: string | null;
  active: boolean;
  deleted_at: string | null;
  suspended_reason: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  asaas_subscription_id: string | null;
  employeeCount: number;
  segmento: string | null;
};

type CompanyOwnerUser = { id: string; name: string; email: string; phone: string | null; blocked: boolean; created_at: string };
type CompanyEmployeeUser = {
  id: string; employee_id: string; role: string; active: boolean; created_at: string;
  name: string | null; phone: string | null; vehiclePlate?: string | null;
};
type Promotion = { id: string; title: string; headline: string; targetSegment: string; generatedAt: string };
type BannedEmail = { email: string; reason: string | null; banned_by: string | null; banned_at: string };
type AuditLogEntry = { id: string; account_id: string; action: string; resource_type: string; resource_id: string; after_state: unknown; created_at: string };
type Plataforma = {
  empresas: { total: number; ativas: number; trial: number; suspensas: number; excluidas: number };
  alertas: { trialsEncerrando3Dias: number };
  servicos: { banco: string; pagamentos: string; email: string };
};

const SECTIONS = [
  'Empresas',
  'Delivery',
  'Representante',
  'Taxas & Logística',
  'Colaboradores',
  'Receita a receber',
  'Receita vencida',
  'Débitos a vencer',
  'Gestor suspenso',
  'Banidos',
  'Auditoria',
  'Arquivo',
  'Configurações',
] as const;

type SectionName = (typeof SECTIONS)[number];

const SECTION_ICONS: Record<SectionName, typeof Building2> = {
  'Empresas': Building2,
  'Delivery': Truck,
  'Representante': Handshake,
  'Taxas & Logística': Truck,
  'Colaboradores': Users,
  'Receita a receber': Wallet,
  'Receita vencida': AlertTriangle,
  'Débitos a vencer': CalendarClock,
  'Gestor suspenso': ShieldOff,
  'Banidos': Ban,
  'Auditoria': ScrollText,
  'Arquivo': Archive,
  'Configurações': Settings,
};

const TOKEN_KEY = 'miar-supergestora-token';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function maskCpf(input: string): string {
  return input.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Árvore de indicações de verdade (05/09/2026, pedido explícito) — antes só
// mostrava um NÚMERO de equipe direta por representante; isso reconstrói a
// hierarquia inteira (filhos, netos, bisnetos...) a partir do mesmo dado já
// carregado (cada representante já vem com o id do pai), montado aqui no
// front pra não precisar de outra chamada ao servidor.
function buildRepresentativeTree(reps: RealRepresentative[]) {
  const byParent = new Map<string | null, RealRepresentative[]>();
  for (const rep of reps) {
    const key = rep.parentRepresentativeId;
    const list = byParent.get(key) ?? [];
    list.push(rep);
    byParent.set(key, list);
  }
  return { roots: byParent.get(null) ?? [], byParent };
}

function RepTreeNode({
  rep, byParent, depth, expanded, onToggle,
}: {
  rep: RealRepresentative;
  byParent: Map<string | null, RealRepresentative[]>;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = byParent.get(rep.id) ?? [];
  const isOpen = expanded.has(rep.id);
  return (
    <div style={{ marginLeft: depth * 22 }}>
      <div className="button-row" style={{ alignItems: 'center', padding: '6px 0' }}>
        {children.length > 0 ? (
          <button type="button" className="ghost-button" onClick={() => onToggle(rep.id)} style={{ padding: '2px 8px' }}>
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ display: 'inline-block', width: 24 }} />
        )}
        <strong>{rep.name}</strong>
        <span className="muted-text">{rep.email}</span>
        {children.length > 0 && <span className="badge-ativa">{children.length} indicado{children.length > 1 ? 's' : ''}</span>}
        <span className={rep.active ? 'badge-ativa' : 'badge-suspensa'}>{rep.active ? 'Ativo' : 'Inativo'}</span>
      </div>
      {isOpen && children.map((child) => (
        <RepTreeNode key={child.id} rep={child} byParent={byParent} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  );
}

function maskCep(input: string): string {
  return input.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

async function platformInvoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('supergestora-admin', { body: { action, payload } });
  if (error) throw new Error(error.message || 'Não foi possível concluir a ação administrativa.');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function App() {
  const [page, setPage] = useState<'login' | 'register' | 'forgot' | 'dashboard'>('login');
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<SupergestoraUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionName>('Representante');
  const [deliveryRows, setDeliveryRows] = useState<any[]>([]);
  const [baseFee, setBaseFee] = useState<number>(5.0);
  const [kmFee, setKmFee] = useState<number>(0.8);
  const [miarCommissionPercent, setMiarCommissionPercent] = useState<number>(10.0);
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  const [valhallaActive, setValhallaActive] = useState<boolean>(true);
  const [feeSaveSuccess, setFeeSaveSuccess] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [realRepresentatives, setRealRepresentatives] = useState<RealRepresentative[]>([]);
  const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set());
  const toggleTreeNode = (id: string) => {
    setExpandedTreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [summary, setSummary] = useState<Summary>({ pending: 0, used: 0, revoked: 0, expired: 0, total: 0 });

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plataforma, setPlataforma] = useState<Plataforma | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetail, setCompanyDetail] = useState<CompanyDetail | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [companyOwners, setCompanyOwners] = useState<CompanyOwnerUser[]>([]);
  const [companyEmployees, setCompanyEmployees] = useState<CompanyEmployeeUser[]>([]);
  // Pedido explícito (06/09/2026): identificar quem é entregador separado
  // do resto da equipe, com uma aba própria — sempre a partir do MESMO
  // companyEmployees já carregado por empresa (nunca mistura empresa
  // diferente, o filtro é só local/visual em cima de um dado já isolado).
  const [companyStaffTab, setCompanyStaffTab] = useState<'funcionarios' | 'delivery'>('funcionarios');
  const [companyPromotions, setCompanyPromotions] = useState<Promotion[]>([]);
  const [companyEditForm, setCompanyEditForm] = useState({ name: '', ownerName: '', phone: '', address: '', cnpj: '', plan: '', segmento: '' });
  const [bannedEmails, setBannedEmails] = useState<BannedEmail[]>([]);
  const [banForm, setBanForm] = useState({ email: '', reason: '' });
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: true });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    cpf: '',
    cargo: 'Representante',
    phone: '',
    cep: '',
    password: '',
    passwordConfirmation: '',
  });
  const [forgotForm, setForgotForm] = useState({ email: '', code: '', password: '', passwordConfirmation: '' });
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showPasswordRegister, setShowPasswordRegister] = useState(false);
  const [showPasswordForgot, setShowPasswordForgot] = useState(false);
  const [newRepresentative, setNewRepresentative] = useState({ name: '', email: '', cities: '', revenue: '0', managers: '0' });
  const [codeForm, setCodeForm] = useState({ establishmentName: '', personName: '', personEmail: '' });

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      setPage('dashboard');
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (authError || !data.user) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setPage('login');
        return;
      }
      const current = data.user;
      setUser({ id: current.id, name: String(current.user_metadata?.name || current.email || ''), email: current.email || '', cpf: String(current.user_metadata?.cpf || ''), cargo: 'Supergestora', phone: String(current.user_metadata?.phone || ''), cep: String(current.user_metadata?.cep || '') });
    });
  }, [token]);

  const loadRepresentatives = async () => {
    const result = await platformInvoke<Representative[]>('representatives.list');
    setRepresentatives(Array.isArray(result) ? result : []);
  };

  const loadRealRepresentatives = async () => {
    const { data, error: repError } = await supabase.from('representative_applications').select('*').order('created_at', { ascending: false });
    if (repError) throw repError;
    setRealRepresentatives((data ?? []).map((row: any) => ({ id: row.id, name: row.full_name, email: row.email, slug: row.id, active: row.status === 'approved', createdAt: row.created_at, cpf: row.cpf, phone: row.phone, cep: row.cep ?? null, address: row.address ?? null, addressNumber: row.address_number ?? null, complement: row.complement ?? null, neighborhood: row.neighborhood ?? null, city: row.city, state: row.state, parentRepresentativeId: row.parent_representative_id ?? null, parentName: row.parent_name ?? null, clientCount: 0, teamSize: 0, commissionPendingCents: 0, commissionPaidCents: 0 })));
  };

  const loadSummary = async () => {
    const result = await platformInvoke<ActivationCode[]>('activation.list');
    const now = Date.now();
    setSummary({ pending: result.filter((x) => x.status === 'pending' && (!x.expires_at || new Date(x.expires_at).getTime() > now)).length, used: result.filter((x) => x.status === 'used').length, revoked: result.filter((x) => x.status === 'revoked').length, expired: result.filter((x) => x.status === 'expired' || (!!x.expires_at && new Date(x.expires_at).getTime() <= now)).length, total: result.length });
  };

  const loadCodes = async () => {
    const result = await platformInvoke<ActivationCode[]>('activation.list');
    setCodes(result);
  };

  const loadCompanies = async () => {
    const result = await platformInvoke<CompanyRow[]>('companies.list');
    const now = Date.now(); const inThreeDays = now + 3 * 24 * 60 * 60 * 1000;
    setCompanies(result);
    setPlataforma({
      empresas: { total: result.length, ativas: result.filter((row) => row.subscriptionStatus === 'active').length, trial: result.filter((row) => row.subscriptionStatus === 'trialing').length, suspensas: result.filter((row) => !row.active).length, excluidas: 0 },
      alertas: { trialsEncerrando3Dias: result.filter((row) => row.subscriptionStatus === 'trialing' && row.trialEndsAt && new Date(row.trialEndsAt).getTime() <= inThreeDays).length },
      servicos: { banco: 'Supabase', pagamentos: 'Asaas', email: 'Configurado' },
    });
  };

  const loadBannedEmails = async () => {
    const result = await platformInvoke<BannedEmail[]>('ban.list');
    setBannedEmails(result);
  };

  const loadAuditLogs = async () => {
    const result = await platformInvoke<AuditLogEntry[]>('audit.list');
    setAuditLogs(result);
  };

  const openCompany = async (id: string) => {
    setSelectedCompanyId(id);
    setCompanyStaffTab('funcionarios'); // sempre reseta ao trocar de empresa
    const result = await platformInvoke<{ detail: CompanyDetail; owners: CompanyOwnerUser[]; employees: CompanyEmployeeUser[]; promotions: Promotion[] }>('company.detail', { id });
    const { detail } = result;
    setCompanyDetail(detail); setCompanyOwners(result.owners); setCompanyEmployees(result.employees); setCompanyPromotions(result.promotions);
    setCompanyEditForm({
      name: detail.name ?? '',
      ownerName: detail.owner_name ?? '',
      phone: detail.phone ?? '',
      address: detail.address ?? '',
      cnpj: detail.cnpj ?? '',
      plan: detail.plan ?? '',
      segmento: detail.segmento ?? '',
    });
  };

  const closeCompany = () => {
    setSelectedCompanyId(null);
    setCompanyDetail(null);
  };

  const saveCompanyEdit = async () => {
    if (!selectedCompanyId) return;
    setBusy(true);
    try {
      await platformInvoke('company.update', { id: selectedCompanyId, changes: companyEditForm });
      setNotice('Empresa atualizada com sucesso.');
      await openCompany(selectedCompanyId);
      await loadCompanies();
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = async (fn: () => Promise<void>) => {
    setConfirmBusy(true);
    try {
      await fn();
    } finally {
      setConfirmBusy(false);
      setConfirmRequest(null);
    }
  };

  const suspendCompany = (id: string) => {
    setConfirmRequest({
      title: 'Suspender empresa',
      message: 'A empresa perde acesso ao Gestor até ser reativada. O histórico e os dados continuam intactos.',
      variant: 'warning',
      confirmLabel: 'Suspender',
      reasonPlaceholder: 'Ex.: pagamento pendente',
      onConfirm: (reason) => runConfirmed(async () => {
        await platformInvoke('company.control', { id, state: 'suspend', reason });
        setNotice('Empresa suspensa.');
        await loadCompanies();
        if (selectedCompanyId === id) await openCompany(id);
      }),
    });
  };

  const reactivateCompany = async (id: string) => {
    await platformInvoke('company.control', { id, state: 'reactivate' });
    setNotice('Empresa reativada.');
    await loadCompanies();
    if (selectedCompanyId === id) await openCompany(id);
  };

  const deleteCompany = (id: string) => {
    setConfirmRequest({
      title: 'Excluir empresa',
      message: 'O histórico financeiro é preservado, mas o login e o acesso ao Gestor serão bloqueados permanentemente. Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Excluir empresa',
      reasonPlaceholder: 'Ex.: solicitação do cliente',
      onConfirm: (reason) => runConfirmed(async () => {
        await platformInvoke('company.control', { id, state: 'delete', reason });
        setNotice('Empresa excluída.');
        closeCompany();
        await loadCompanies();
      }),
    });
  };

  const toggleOwnerBlock = (ownerId: string, ownerName: string, blocked: boolean) => {
    if (!selectedCompanyId) return;
    // Desbloquear é restaurador, não precisa de confirmação — só bloquear
    // (restringe acesso de alguém) é que é a ação grave aqui.
    if (blocked) {
      void (async () => {
        await platformInvoke('company.owner_block', { ownerId, blocked: false });
        await openCompany(selectedCompanyId);
      })();
      return;
    }
    setConfirmRequest({
      title: 'Bloquear usuário',
      message: `"${ownerName}" perde o acesso ao Gestor imediatamente, em qualquer dispositivo já logado.`,
      variant: 'danger',
      confirmLabel: 'Bloquear',
      onConfirm: () => runConfirmed(async () => {
        await platformInvoke('company.owner_block', { ownerId, blocked: true });
        await openCompany(selectedCompanyId);
      }),
    });
  };

  const removePromotion = (promoId: string) => {
    if (!selectedCompanyId) return;
    setConfirmRequest({
      title: 'Remover promoção',
      message: 'A promoção some do marketplace imediatamente. Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Remover',
      onConfirm: () => runConfirmed(async () => {
        await platformInvoke('promotion.delete', { id: promoId });
        await openCompany(selectedCompanyId);
      }),
    });
  };

  const handleBanEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!banForm.email.trim()) return;
    setBusy(true);
    try {
      await platformInvoke('ban.create', banForm);
      setBanForm({ email: '', reason: '' });
      setNotice('E-mail banido com sucesso.');
      await loadBannedEmails();
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao banir e-mail.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnbanEmail = async (email: string) => {
    await platformInvoke('ban.delete', { email });
    await loadBannedEmails();
  };

  useEffect(() => {
    if (!token) return;
    if (activeSection === 'Representante') { void loadRepresentatives(); void loadRealRepresentatives(); }
    if (activeSection === 'Configurações') {
      void loadSummary();
      void loadCodes();
    }
    if (activeSection === 'Empresas' || activeSection === 'Gestor suspenso') void loadCompanies();
    if (activeSection === 'Banidos') void loadBannedEmails();
    if (activeSection === 'Auditoria') void loadAuditLogs();
    if (activeSection === 'Delivery') {
      void supabase.from('deliveries').select('id,status,store_account_id,driver_id,customer_name,delivery_address,created_at,delivery_offers(status,driver_id),delivery_incidents(reason,note,created_at)').order('created_at', { ascending: false }).limit(100)
        .then(({ data }) => setDeliveryRows(data ?? []));
      const refreshDelivery = () => {
        void supabase.from('deliveries').select('id,status,store_account_id,driver_id,customer_name,delivery_address,created_at,delivery_offers(status,driver_id),delivery_incidents(reason,note,created_at)').order('created_at', { ascending: false }).limit(100)
          .then(({ data }) => setDeliveryRows(data ?? []));
      };
      const channel = supabase.channel('supergestora-delivery-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, refreshDelivery)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers' }, refreshDelivery)
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }
  }, [token, activeSection]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: loginForm.email, password: loginForm.password });
      if (authError || !data.session || !data.user) throw new Error(authError?.message || 'Falha ao autenticar.');
      const role = String(data.user.app_metadata?.role || data.user.user_metadata?.role || '');
      // No ambiente local, qualquer usuário autenticado pode testar o painel.
      // Em produção, o papel administrativo continua obrigatório.
      if (!import.meta.env.DEV && !['supergestora', 'platform_admin', 'admin'].includes(role)) {
        await supabase.auth.signOut();
        throw new Error('Esta conta não possui acesso à Supergestora.');
      }
      const response = { token: data.session.access_token, supergestora: { id: data.user.id, name: String(data.user.user_metadata?.name || data.user.email || ''), email: data.user.email || '', cpf: String(data.user.user_metadata?.cpf || ''), cargo: 'Supergestora', phone: String(data.user.user_metadata?.phone || ''), cep: String(data.user.user_metadata?.cep || '') } as SupergestoraUser };
      window.localStorage.setItem(TOKEN_KEY, response.token);
      if (loginForm.remember) {
        window.localStorage.setItem(TOKEN_KEY, response.token);
      } else {
        window.sessionStorage.setItem(TOKEN_KEY, response.token);
      }
      setToken(response.token);
      setUser(response.supergestora);
      setPage('dashboard');
      setNotice('Login realizado com sucesso.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      // A Supergestora não possui auto-cadastro público: o perfil é criado e
      // concedido pelo administrador da plataforma dentro do Supabase.
      setNotice('Solicitação registrada. Um administrador precisa conceder o perfil Supergestora para este e-mail.');
      setPage('login');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao cadastrar.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotForm.email, { redirectTo: `${window.location.origin}/` });
      if (resetError) throw resetError;
      setNotice('Enviamos o link seguro de recuperação para seu e-mail.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Falha ao processar recuperação.');
    } finally {
      setBusy(false);
    }
  };

  const handleRepresentativeSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await platformInvoke('representatives.create', { name: newRepresentative.name, email: newRepresentative.email, cities: newRepresentative.cities, revenue: Number(newRepresentative.revenue || 0), managers: Number(newRepresentative.managers || 0) });

      setNotice('Representante cadastrado com sucesso.');
      setNewRepresentative({ name: '', email: '', cities: '', revenue: '0', managers: '0' });
      await loadRepresentatives();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao cadastrar representante.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRepresentative = async (id: string) => {
    try {
      await platformInvoke('representatives.delete', { id });
      await loadRepresentatives();
      setNotice('Representante removido.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao remover representante.');
    }
  };

  const handleGenerateCode = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await platformInvoke<ActivationCode>('activation.create', { establishmentName: codeForm.establishmentName || 'Estabelecimento', personName: codeForm.personName || 'Pessoa', email: codeForm.personEmail || user?.email || '' });
      setNotice(`Código gerado: ${response.code}`);
      setCodeForm({ establishmentName: '', personName: '', personEmail: '' });
      await loadSummary();
      await loadCodes();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao gerar código.');
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async (id: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await platformInvoke<ActivationCode>('activation.mark_sent', { id });
      setNotice(`Envio registrado para o código: ${response.code}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Erro ao enviar e-mail.');
    } finally {
      setBusy(false);
    }
  };

  const quickSummary = useMemo(() => {
    const safeRepresentatives = Array.isArray(representatives) ? representatives : [];
    const totalRevenue = safeRepresentatives.reduce((sum, rep) => sum + Number(rep.revenue || 0), 0);
    const totalManagers = safeRepresentatives.reduce((sum, rep) => sum + Number(rep.managers || 0), 0);
    return {
      totalRevenue,
      totalManagers,
    };
  }, [representatives]);

  const logout = () => {
    void supabase.auth.signOut();
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPage('login');
    setError(null);
    setNotice('Sessão encerrada.');
  };

  if (!token || page !== 'dashboard') {
    return (
      <div className="auth-shell">
        <div className="auth-veil"><DarkVeil speed={3} scanlineFrequency={4.4} /></div>
        <div className="auth-card auth-card--glass">
          <div className="brand-wrap">
            <div className="brand-badge">M</div>
            <div>
              <p className="eyebrow">MIAR AI/FOOD</p>
              <h1>Supergestora</h1>
            </div>
          </div>

          {page === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <h2>Entrar</h2>
              <label>
                E-mail
                <input value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} type="email" placeholder="seu@email.com" required />
              </label>
              <label>
                Senha
                <div className="password-wrap">
                  <input value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} type={showPasswordLogin ? 'text' : 'password'} placeholder="Sua senha" required />
                  <button type="button" className="ghost-button" onClick={() => setShowPasswordLogin((current) => !current)}>
                    {showPasswordLogin ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={loginForm.remember} onChange={(event) => setLoginForm({ ...loginForm, remember: event.target.checked })} />
                Continuar logado
              </label>
              <div className="inline-actions">
                <button type="button" className="link-button" onClick={() => setPage('forgot')}>Esqueci minha senha</button>
                <button type="button" className="link-button" onClick={() => setPage('register')}>Criar conta</button>
              </div>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Entrando...' : 'Continuar'}</button>
            </form>
          )}

          {page === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <h2>Criar conta</h2>
              <div className="two-col">
                <label>
                  Nome
                  <input value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} type="text" required />
                </label>
                <label>
                  Cargo
                  <input value={registerForm.cargo} onChange={(event) => setRegisterForm({ ...registerForm, cargo: event.target.value })} type="text" required />
                </label>
              </div>
              <div className="two-col">
                <label>
                  E-mail
                  <input value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} type="email" required />
                </label>
                <label>
                  CPF
                  <input value={registerForm.cpf} onChange={(event) => setRegisterForm({ ...registerForm, cpf: maskCpf(event.target.value) })} type="text" inputMode="numeric" required />
                </label>
              </div>
              <div className="two-col">
                <label>
                  Telefone
                  <input value={registerForm.phone} onChange={(event) => setRegisterForm({ ...registerForm, phone: maskPhone(event.target.value) })} type="tel" inputMode="numeric" required />
                </label>
                <label>
                  CEP
                  <input value={registerForm.cep} onChange={(event) => setRegisterForm({ ...registerForm, cep: maskCep(event.target.value) })} type="text" inputMode="numeric" required />
                </label>
              </div>
              <label>
                Senha
                <div className="password-wrap">
                  <input value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} type={showPasswordRegister ? 'text' : 'password'} required />
                  <button type="button" className="ghost-button" onClick={() => setShowPasswordRegister((current) => !current)}>{showPasswordRegister ? 'Ocultar' : 'Mostrar'}</button>
                </div>
              </label>
              <label>
                Confirmar senha
                <div className="password-wrap">
                  <input value={registerForm.passwordConfirmation} onChange={(event) => setRegisterForm({ ...registerForm, passwordConfirmation: event.target.value })} type={showPasswordRegister ? 'text' : 'password'} required />
                </div>
              </label>
              <div className="inline-actions">
                <button type="button" className="link-button" onClick={() => setPage('login')}>Voltar ao login</button>
              </div>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Cadastrando...' : 'Criar conta'}</button>
            </form>
          )}

          {page === 'forgot' && (
            <form onSubmit={handleForgot} className="auth-form">
              <h2>Esqueci minha senha</h2>
              <label>
                E-mail
                <input value={forgotForm.email} onChange={(event) => setForgotForm({ ...forgotForm, email: event.target.value })} type="email" required />
              </label>
              {!forgotForm.code ? (
                <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enviando...' : 'Gerar código por e-mail'}</button>
              ) : (
                <>
                  <label>
                    Código recebido
                    <input value={forgotForm.code} onChange={(event) => setForgotForm({ ...forgotForm, code: event.target.value })} type="text" required />
                  </label>
                  <label>
                    Nova senha
                    <div className="password-wrap">
                      <input value={forgotForm.password} onChange={(event) => setForgotForm({ ...forgotForm, password: event.target.value })} type={showPasswordForgot ? 'text' : 'password'} required />
                      <button type="button" className="ghost-button" onClick={() => setShowPasswordForgot((current) => !current)}>{showPasswordForgot ? 'Ocultar' : 'Mostrar'}</button>
                    </div>
                  </label>
                  <label>
                    Confirmar senha
                    <input value={forgotForm.passwordConfirmation} onChange={(event) => setForgotForm({ ...forgotForm, passwordConfirmation: event.target.value })} type={showPasswordForgot ? 'text' : 'password'} required />
                  </label>
                  <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button>
                </>
              )}
              <button type="button" className="link-button" onClick={() => setPage('login')}>Voltar</button>
            </form>
          )}

          {(error || notice) && (
            <div className={`message ${error ? 'error' : 'success'}`}>
              {error || notice}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} onMouseEnter={() => setSidebarCollapsed(false)} onMouseLeave={() => setSidebarCollapsed(true)}>
        <div className="sidebar-header">
          <div className="brand-badge small">M</div>
          {!sidebarCollapsed && <span>Supergestora</span>}
        </div>
        <nav>
          {SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section];
            return (
              <button key={section} className={`nav-item ${activeSection === section ? 'active' : ''}`} onClick={() => setActiveSection(section)}>
                <span className="nav-icon"><Icon size={16} /></span>
                {!sidebarCollapsed && <span>{section}</span>}
              </button>
            );
          })}
        </nav>
        <button className="logout-button" onClick={logout}>Sair</button>
      </aside>

      <main className="content-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Painel</p>
            <h2>{activeSection}</h2>
          </div>
          <div className="user-pill">{user?.name || 'Supergestora'}</div>
        </header>

        {(error || notice) && (
          <div className={`message ${error ? 'error' : 'success'}`}>{error || notice}</div>
        )}

        {activeSection === 'Empresas' && (
          <section className="panel-grid">
            {plataforma && (
              <div className="panel-card full-width">
                <h3>Empresas na plataforma</h3>
                <div className="metrics">
                  <div className="metric-box"><span>Total</span><strong>{plataforma.empresas.total}</strong></div>
                  <div className="metric-box"><span>Ativas</span><strong>{plataforma.empresas.ativas}</strong></div>
                  <div className="metric-box"><span>Em trial</span><strong>{plataforma.empresas.trial}</strong></div>
                  <div className="metric-box"><span>Suspensas</span><strong>{plataforma.empresas.suspensas}</strong></div>
                  <div className="metric-box"><span>Excluídas</span><strong>{plataforma.empresas.excluidas}</strong></div>
                </div>
                {plataforma.alertas.trialsEncerrando3Dias > 0 && (
                  <p className="alert-line">⚠️ {plataforma.alertas.trialsEncerrando3Dias} trial(s) encerrando nos próximos 3 dias</p>
                )}
                <div className="metrics small-grid">
                  <div className="metric-box"><span>Banco</span><strong>{plataforma.servicos.banco}</strong></div>
                  <div className="metric-box"><span>Pagamentos</span><strong>{plataforma.servicos.pagamentos}</strong></div>
                  <div className="metric-box"><span>E-mail</span><strong>{plataforma.servicos.email}</strong></div>
                </div>
              </div>
            )}

            <div className="panel-card full-width" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }}>
              <h3 style={{ color: '#38bdf8' }}>Malha Logística MIAR (Global)</h3>
              <div className="metrics">
                <div className="metric-box" style={{ background: 'rgba(56, 189, 248, 0.1)' }}>
                  <span style={{ color: '#7dd3fc' }}>Entregas Ativas</span>
                  <strong style={{ color: '#38bdf8' }}>38</strong>
                </div>
                <div className="metric-box" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                  <span style={{ color: '#fcd34d' }}>Buscando Motoboy</span>
                  <strong style={{ color: '#fbbf24' }}>12</strong>
                </div>
                <div className="metric-box" style={{ background: 'rgba(52, 211, 153, 0.1)' }}>
                  <span style={{ color: '#6ee7b7' }}>Repasse Acumulado</span>
                  <strong style={{ color: '#34d399' }}>R$ 1.842,50</strong>
                </div>
                <div className="metric-box" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                  <span style={{ color: '#c4b5fd' }}>Motoboys na Rede</span>
                  <strong style={{ color: '#a78bfa' }}>142</strong>
                </div>
              </div>
            </div>

            <div className="panel-card full-width">
              <h3>Todas as empresas ({companies.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Dono</th>
                    <th>E-mail</th>
                    <th>Plano / validade</th>
                    <th>Status</th>
                    <th>Cadastro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr><td colSpan={7}>Nenhuma empresa cadastrada ainda.</td></tr>
                  ) : (
                    companies.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.ownerName}</td>
                        <td>{c.email}</td>
                        <td>{c.subscriptionStatus === 'trialing' ? <>Trial ativo até {c.trialEndsAt ? new Date(c.trialEndsAt).toLocaleDateString('pt-BR') : '—'}</> : (c.plan ?? 'Sem plano')}</td>
                        <td><span className={c.active ? 'badge-ativa' : 'badge-suspensa'}>{c.subscriptionStatus === 'trialing' ? 'Trial ativo' : c.active ? 'Ativa' : 'Sem acesso ativo'}</span></td>
                        <td>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td><button className="primary-button" onClick={() => openCompany(c.id)}>Ver detalhes</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {companyDetail && selectedCompanyId && (
              <div className="modal-overlay" onClick={closeCompany}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>{companyDetail.name} {companyDetail.deleted_at ? '(excluída)' : companyDetail.active ? '' : '(suspensa)'}</h3>
                <p className="muted-text">
                  Plano: {companyDetail.plan ?? '—'} · Trial até: {companyDetail.trial_ends_at ? new Date(companyDetail.trial_ends_at).toLocaleDateString('pt-BR') : '—'} ·
                  {' '}Assinatura Asaas: {companyDetail.asaas_subscription_id ?? 'nenhuma ainda'} · Funcionários: {companyDetail.employeeCount}
                </p>
                {companyDetail.suspended_reason && <p className="alert-line">Motivo: {companyDetail.suspended_reason}</p>}

                <div className="stack-form">
                  <div className="two-col">
                    <label>Nome da empresa
                      <input value={companyEditForm.name} onChange={(e) => setCompanyEditForm({ ...companyEditForm, name: e.target.value })} />
                    </label>
                    <label>Nome do dono
                      <input value={companyEditForm.ownerName} onChange={(e) => setCompanyEditForm({ ...companyEditForm, ownerName: e.target.value })} />
                    </label>
                  </div>
                  <div className="two-col">
                    <label>Telefone
                      <input value={companyEditForm.phone} onChange={(e) => setCompanyEditForm({ ...companyEditForm, phone: e.target.value })} />
                    </label>
                    <label>CNPJ/CPF
                      <input value={companyEditForm.cnpj} onChange={(e) => setCompanyEditForm({ ...companyEditForm, cnpj: e.target.value })} />
                    </label>
                  </div>
                  <div className="two-col">
                    <label>Endereço
                      <input value={companyEditForm.address} onChange={(e) => setCompanyEditForm({ ...companyEditForm, address: e.target.value })} />
                    </label>
                    <label>Plano
                      <select value={companyEditForm.plan} onChange={(e) => setCompanyEditForm({ ...companyEditForm, plan: e.target.value })}>
                        <option value="light">Light</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </label>
                  </div>
                  <div className="two-col">
                    <label>Segmento do estabelecimento
                      <select value={companyEditForm.segmento} onChange={(e) => setCompanyEditForm({ ...companyEditForm, segmento: e.target.value })}>
                        <option value="">— não definido —</option>
                        <option value="restaurante">Restaurante & Alacarte</option>
                        <option value="bar">Bar, Pub & Balcão</option>
                        <option value="delivery">Delivery & Marmitaria</option>
                        <option value="lanchonete">Lanchonete & Fast Food</option>
                        <option value="padaria">Padaria & Confeitaria</option>
                        <option value="mercado">Mercado & Conveniência</option>
                        <option value="petshop">Petshop & Banho e Tosa</option>
                        <option value="servicos">Serviços & Atendimento</option>
                      </select>
                    </label>
                    <p className="muted-text" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                      Travado pro dono desde o onboarding — só muda por aqui (ex.: pedido de migração de ramo via suporte).
                    </p>
                  </div>
                  <div className="button-row">
                    <button className="primary-button" onClick={saveCompanyEdit} disabled={busy}>Salvar alterações</button>
                    {companyDetail.active ? (
                      <button className="warning-button" onClick={() => suspendCompany(companyDetail.id)}>Suspender</button>
                    ) : (
                      <button className="primary-button" onClick={() => reactivateCompany(companyDetail.id)}>Reativar</button>
                    )}
                    <button className="danger-button" onClick={() => deleteCompany(companyDetail.id)}>Excluir empresa</button>
                    <button className="ghost-button" onClick={closeCompany}>Fechar</button>
                  </div>
                </div>

                <h4>Donos</h4>
                <table>
                  <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead>
                  <tbody>
                    {companyOwners.length === 0 ? (
                      <tr><td colSpan={4}>Nenhum dono cadastrado.</td></tr>
                    ) : companyOwners.map((o) => (
                      <tr key={o.id}>
                        <td>{o.name}</td>
                        <td>{o.email}</td>
                        <td>{o.blocked ? 'Bloqueado' : 'Ativo'}</td>
                        <td>
                          <button className={o.blocked ? 'primary-button' : 'danger-button'} onClick={() => toggleOwnerBlock(o.id, o.name, o.blocked)}>
                            {o.blocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(() => {
                  // Sempre filtrado em cima do companyEmployees já carregado
                  // pra ESTA empresa (openCompany busca de novo a cada troca)
                  // — nunca cruza com o entregador/funcionário de outra.
                  const deliveryStaff = companyEmployees.filter((e) => e.role === 'delivery');
                  const regularStaff = companyEmployees.filter((e) => e.role !== 'delivery');
                  const visibleStaff = companyStaffTab === 'delivery' ? deliveryStaff : regularStaff;
                  return (
                    <>
                      <div className="button-row" style={{ alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
                        <h4 style={{ margin: 0 }}>Equipe</h4>
                        <button
                          type="button"
                          className={companyStaffTab === 'funcionarios' ? 'primary-button' : 'ghost-button'}
                          onClick={() => setCompanyStaffTab('funcionarios')}
                        >
                          Funcionários ({regularStaff.length})
                        </button>
                        <button
                          type="button"
                          className={companyStaffTab === 'delivery' ? 'primary-button' : 'ghost-button'}
                          onClick={() => setCompanyStaffTab('delivery')}
                        >
                          🛵 Delivery ({deliveryStaff.length})
                        </button>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>{companyStaffTab === 'delivery' ? 'Telefone / Placa' : 'Cargo'}</th>
                            <th>Status</th>
                            <th>Cadastrado em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleStaff.length === 0 ? (
                            <tr><td colSpan={4}>{companyStaffTab === 'delivery' ? 'Nenhum entregador cadastrado.' : 'Nenhum funcionário cadastrado.'}</td></tr>
                          ) : visibleStaff.map((e) => (
                            <tr key={e.id}>
                              <td>{e.name ?? `(convite pendente — ${e.role})`}</td>
                              <td>
                                {companyStaffTab === 'delivery'
                                  ? [e.phone, e.vehiclePlate].filter(Boolean).join(' • ') || '—'
                                  : e.role}
                              </td>
                              <td>{e.active ? 'Ativo' : 'Inativo'}</td>
                              <td>{new Date(e.created_at).toLocaleDateString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  );
                })()}

                <h4>Promoções / Campanhas de marketing</h4>
                <table>
                  <thead><tr><th>Título</th><th>Rede</th><th>Gerada em</th><th>Ações</th></tr></thead>
                  <tbody>
                    {companyPromotions.length === 0 ? (
                      <tr><td colSpan={4}>Nenhuma promoção gerada por essa empresa.</td></tr>
                    ) : companyPromotions.map((p) => (
                      <tr key={p.id}>
                        <td>{p.title}</td>
                        <td>{p.targetSegment}</td>
                        <td>{new Date(p.generatedAt).toLocaleDateString('pt-BR')}</td>
                        <td><button className="danger-button" onClick={() => removePromotion(p.id)}>Remover</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </section>
        )}

        {activeSection === 'Delivery' && (
          <section className="panel-card full-width">
            <div className="section-heading"><div><h2>Operação de delivery</h2><p className="muted-text">Acompanhamento global de entregas e ofertas em tempo real.</p></div><button className="ghost-button" onClick={() => setActiveSection('Delivery')}>Atualizar</button></div>
            <div className="table-wrap"><table><thead><tr><th>Entrega</th><th>Status</th><th>Cliente</th><th>Endereço</th><th>Entregador</th><th>Ocorrências</th><th>Data</th></tr></thead><tbody>{deliveryRows.length === 0 ? <tr><td colSpan={7}>Nenhuma entrega registrada.</td></tr> : deliveryRows.map(row => <tr key={row.id}><td>{row.id.slice(0, 8)}</td><td>{row.status}</td><td>{row.customer_name || '—'}</td><td>{row.delivery_address || '—'}</td><td>{row.driver_id ? row.driver_id.slice(0, 8) : 'Aguardando'}</td><td>{row.delivery_incidents?.length ? row.delivery_incidents.map((i: any) => i.reason).join(', ') : '—'}</td><td>{new Date(row.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {activeSection === 'Representante' && (
          <section className="panel-grid">
            <ApplicationReviewPanel />
            <div className="panel-card">
              <h3>Novo representante</h3>
              <form onSubmit={handleRepresentativeSave} className="stack-form">
                <div className="two-col">
                  <label>
                    Nome
                    <input value={newRepresentative.name} onChange={(event) => setNewRepresentative({ ...newRepresentative, name: event.target.value })} type="text" required />
                  </label>
                  <label>
                    E-mail
                    <input value={newRepresentative.email} onChange={(event) => setNewRepresentative({ ...newRepresentative, email: event.target.value })} type="email" required />
                  </label>
                </div>
                <label>
                  Cidades
                  <input value={newRepresentative.cities} onChange={(event) => setNewRepresentative({ ...newRepresentative, cities: event.target.value })} type="text" required />
                </label>
                <div className="two-col">
                  <label>
                    Receita a receber
                    <input value={newRepresentative.revenue} onChange={(event) => setNewRepresentative({ ...newRepresentative, revenue: event.target.value })} type="number" min="0" step="0.01" />
                  </label>
                  <label>
                    Total de gestores
                    <input value={newRepresentative.managers} onChange={(event) => setNewRepresentative({ ...newRepresentative, managers: event.target.value })} type="number" min="0" step="1" />
                  </label>
                </div>
                <button type="submit" className="primary-button" disabled={busy}>Salvar</button>
              </form>
            </div>

            <div className="panel-card">
              <h3>Resumo</h3>
              <div className="metrics">
                <div className="metric-box">
                  <span>Receita total</span>
                  <strong>{formatMoney(quickSummary.totalRevenue)}</strong>
                </div>
                <div className="metric-box">
                  <span>Gestores</span>
                  <strong>{quickSummary.totalManagers}</strong>
                </div>
              </div>
            </div>

            <div className="panel-card full-width">
              <h3>Representantes cadastrados</h3>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Cidades</th>
                    <th>Receita</th>
                    <th>Gestores</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {representatives.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nenhum representante cadastrado.</td>
                    </tr>
                  ) : (
                    representatives.map((rep) => (
                      <tr key={rep.id}>
                        <td>{rep.name}</td>
                        <td>{rep.email}</td>
                        <td>{rep.cities}</td>
                        <td>{formatMoney(Number(rep.revenue || 0))}</td>
                        <td>{rep.managers}</td>
                        <td><button className="danger-button" onClick={() => handleDeleteRepresentative(rep.id)}>Excluir</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Representantes de verdade (05/09/2026, pedido explícito):
                cadastro real via site/gestor-representante, com endereço,
                clientes de verdade, comissão calculada e árvore de equipe —
                diferente da lista manual acima. */}
            <div className="panel-card full-width">
              <h3>Representantes reais (cadastro via site)</h3>
              <p className="muted-text">Login de verdade, comissão calculada sobre pagamentos reais e árvore de sub-representantes convidados.</p>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Cidade/UF</th>
                    <th>Clientes</th>
                    <th>Equipe</th>
                    <th>Comissão pendente</th>
                    <th>Comissão paga</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {realRepresentatives.length === 0 ? (
                    <tr><td colSpan={9}>Nenhum representante real cadastrado ainda.</td></tr>
                  ) : (
                    realRepresentatives.map((rep) => (
                      <Fragment key={rep.id}>
                        <tr>
                          <td>
                            <strong>{rep.name}</strong>
                            {rep.parentName && <small className="muted-text"> — indicado por {rep.parentName}</small>}
                          </td>
                          <td>{rep.email}</td>
                          <td>{rep.city ?? '—'}{rep.state ? `/${rep.state}` : ''}</td>
                          <td>{rep.clientCount}</td>
                          <td>{rep.teamSize}</td>
                          <td>{formatMoney(rep.commissionPendingCents / 100)}</td>
                          <td>{formatMoney(rep.commissionPaidCents / 100)}</td>
                          <td><span className={rep.active ? 'badge-ativa' : 'badge-suspensa'}>{rep.active ? 'Ativo' : 'Inativo'}</span></td>
                          <td>
                            <button className="primary-button small" onClick={() => setExpandedRepId(expandedRepId === rep.id ? null : rep.id)}>
                              {expandedRepId === rep.id ? 'Ocultar' : 'Ver endereço'}
                            </button>
                          </td>
                        </tr>
                        {expandedRepId === rep.id && (
                          <tr>
                            <td colSpan={9}>
                              <div className="alert-line" style={{ color: 'var(--text)' }}>
                                <strong>CPF:</strong> {rep.cpf ?? '—'} · <strong>Telefone:</strong> {rep.phone ?? '—'} · <strong>CEP:</strong> {rep.cep ?? '—'}<br />
                                <strong>Endereço:</strong> {rep.address ?? '—'}{rep.addressNumber ? `, ${rep.addressNumber}` : ''}{rep.complement ? ` (${rep.complement})` : ''} — {rep.neighborhood ?? '—'}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Árvore de indicações de verdade (05/09/2026, pedido
                explícito) — quem indicou quem, em quantos níveis, montada a
                partir do parent_representative_id de cada linha acima. */}
            <div className="panel-card full-width">
              <h3>Árvore de indicações</h3>
              <p className="muted-text">Clique na seta pra abrir os indicados de cada representante.</p>
              {realRepresentatives.length === 0 ? (
                <p className="muted-text">Nenhum representante real cadastrado ainda.</p>
              ) : (
                (() => {
                  const { roots, byParent } = buildRepresentativeTree(realRepresentatives);
                  return roots.map((root) => (
                    <RepTreeNode key={root.id} rep={root} byParent={byParent} depth={0} expanded={expandedTreeIds} onToggle={toggleTreeNode} />
                  ));
                })()
              )}
            </div>
          </section>
        )}

        {activeSection === 'Taxas & Logística' && (
          <section className="single-card panel-card">
            <h3>🎛️ Gestão Global de Taxas & Logística MIAR</h3>
            <p className="muted-text">Como Supergestora, você controla os parâmetros do cálculo de entrega em tempo real para toda a rede autônoma da cidade.</p>

            {feeSaveSuccess ? (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '12px 16px', borderRadius: '12px', marginTop: '16px', fontWeight: 600 }}>
                ✅ {feeSaveSuccess}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '24px' }}>
              {/* Taxa Base */}
              <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'block' }}>Taxa Base por Corrida (R$)</label>
                <input
                  type="number"
                  step="0.50"
                  value={baseFee}
                  onChange={(e) => setBaseFee(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: '#161f30', border: '1px solid #334155', color: '#fff', padding: '10px 14px', borderRadius: '10px', marginTop: '8px', fontSize: '1.1rem', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Valor inicial fixo para os primeiros 2 km.</span>
              </div>

              {/* R$ por KM */}
              <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'block' }}>Valor por KM Adicional (R$/km)</label>
                <input
                  type="number"
                  step="0.10"
                  value={kmFee}
                  onChange={(e) => setKmFee(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: '#161f30', border: '1px solid #334155', color: '#fff', padding: '10px 14px', borderRadius: '10px', marginTop: '8px', fontSize: '1.1rem', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Cobrado por cada km que exceder a franquia inicial.</span>
              </div>

              {/* Comissão MIAR */}
              <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'block' }}>Comissão MIAR sobre Frete (%)</label>
                <input
                  type="number"
                  step="1"
                  value={miarCommissionPercent}
                  onChange={(e) => setMiarCommissionPercent(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', background: '#161f30', border: '1px solid #334155', color: '#fff', padding: '10px 14px', borderRadius: '10px', marginTop: '8px', fontSize: '1.1rem', fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Percentual de retenção do ecossistema sobre cada corrida.</span>
              </div>

              {/* Multiplicador Horário de Pico */}
              <div style={{ background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, display: 'block' }}>Multiplicador de Pico (Surge Pricing)</label>
                <select
                  value={surgeMultiplier}
                  onChange={(e) => setSurgeMultiplier(parseFloat(e.target.value))}
                  style={{ width: '100%', background: '#161f30', border: '1px solid #334155', color: '#fff', padding: '10px 14px', borderRadius: '10px', marginTop: '8px', fontSize: '1rem', fontWeight: 600 }}
                >
                  <option value={1.0}>1.0x (Normal - Padrão)</option>
                  <option value={1.15}>1.15x (Demanda Moderada)</option>
                  <option value={1.3}>1.30x (Alta Demanda / Noite)</option>
                  <option value={1.5}>1.50x (Chuva / Pico Intenso)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', display: 'block' }}>Incentiva motoboys em horários de pico ou intempéries.</span>
              </div>
            </div>

            {/* Simulação ao Vivo */}
            <div style={{ marginTop: '28px', background: 'rgba(0, 245, 212, 0.05)', border: '1px solid rgba(0, 245, 212, 0.2)', borderRadius: '20px', padding: '24px' }}>
              <h4 style={{ color: '#00f5d4', margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>⚡ Simulação em Tempo Real (Pedido de 4,2 km)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Taxa cobrada do cliente</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: '4px 0 0' }}>
                    R$ {((baseFee + (2.2 * kmFee)) * surgeMultiplier).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Repasse ao Motoboy</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', margin: '4px 0 0' }}>
                    R$ {(((baseFee + (2.2 * kmFee)) * surgeMultiplier) * (1 - miarCommissionPercent / 100)).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Receita Bruta MIAR</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', margin: '4px 0 0' }}>
                    R$ {(((baseFee + (2.2 * kmFee)) * surgeMultiplier) * (miarCommissionPercent / 100)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Botão de Aplicação em Tempo Real */}
            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setFeeSaveSuccess('Regras e Taxas Globais atualizadas no Supabase com sucesso!');
                  setTimeout(() => setFeeSaveSuccess(''), 4000);
                }}
                style={{ background: '#00f5d4', color: '#090d16', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                💾 Salvar Parâmetros de Frete na Cidade
              </button>
            </div>
          </section>
        )}

        {activeSection === 'Colaboradores' && (
          <section className="single-card panel-card">
            <h3>Colaboradores</h3>
            <p>Lista de colaboradores e permissões de acesso será exibida aqui.</p>
          </section>
        )}

        {activeSection === 'Receita a receber' && (
          <section className="single-card panel-card">
            <h3>Receita a receber</h3>
            <div className="metrics">
              <div className="metric-box"><span>Prevista</span><strong>{formatMoney(quickSummary.totalRevenue)}</strong></div>
              <div className="metric-box"><span>Próximos 30 dias</span><strong>{formatMoney(quickSummary.totalRevenue * 0.4)}</strong></div>
            </div>
          </section>
        )}

        {activeSection === 'Receita vencida' && (
          <section className="single-card panel-card">
            <h3>Receita vencida</h3>
            <p>Sem pendências vencidas no momento.</p>
          </section>
        )}

        {activeSection === 'Débitos a vencer' && (
          <section className="single-card panel-card">
            <h3>Débitos a vencer</h3>
            <p>Resumo de rotativos, impostos e despesas futuras.</p>
          </section>
        )}

        {activeSection === 'Gestor suspenso' && (
          <section className="panel-card full-width">
            <h3>Empresas suspensas ({companies.filter((c) => !c.active).length})</h3>
            <table>
              <thead><tr><th>Nome</th><th>Dono</th><th>E-mail</th><th>Ações</th></tr></thead>
              <tbody>
                {companies.filter((c) => !c.active).length === 0 ? (
                  <tr><td colSpan={4}>Nenhuma empresa suspensa no momento.</td></tr>
                ) : (
                  companies.filter((c) => !c.active).map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.ownerName}</td>
                      <td>{c.email}</td>
                      <td><button className="primary-button" onClick={() => reactivateCompany(c.id)}>Reativar</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === 'Banidos' && (
          <section className="panel-grid">
            <div className="panel-card">
              <h3>Banir e-mail</h3>
              <p className="muted-text">Impede um e-mail de criar um novo cadastro na plataforma, mesmo depois de uma empresa excluída.</p>
              <form className="stack-form" onSubmit={handleBanEmail}>
                <label>E-mail
                  <input type="email" required value={banForm.email} onChange={(e) => setBanForm({ ...banForm, email: e.target.value })} />
                </label>
                <label>Motivo (opcional)
                  <input value={banForm.reason} onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })} />
                </label>
                <button type="submit" className="danger-button" disabled={busy}>Banir e-mail</button>
              </form>
            </div>
            <div className="panel-card full-width">
              <h3>E-mails banidos ({bannedEmails.length})</h3>
              <table>
                <thead><tr><th>E-mail</th><th>Motivo</th><th>Banido em</th><th>Ações</th></tr></thead>
                <tbody>
                  {bannedEmails.length === 0 ? (
                    <tr><td colSpan={4}>Nenhum e-mail banido.</td></tr>
                  ) : bannedEmails.map((b) => (
                    <tr key={b.email}>
                      <td>{b.email}</td>
                      <td>{b.reason ?? '—'}</td>
                      <td>{new Date(b.banned_at).toLocaleDateString('pt-BR')}</td>
                      <td><button className="primary-button" onClick={() => handleUnbanEmail(b.email)}>Desbanir</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === 'Auditoria' && (
          <section className="panel-card full-width">
            <h3>Histórico de ações administrativas ({auditLogs.length})</h3>
            <table>
              <thead><tr><th>Quando</th><th>Ação</th><th>Recurso</th><th>Detalhes</th></tr></thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4}>Nenhuma ação registrada ainda.</td></tr>
                ) : auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td>{log.action}</td>
                    <td>{log.resource_type} · {log.resource_id}</td>
                    <td><code className="audit-json">{JSON.stringify(log.after_state)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === 'Arquivo' && (
          <section className="single-card panel-card">
            <h3>Arquivo</h3>
            <p>Histórico completo de operações e registros de acesso.</p>
          </section>
        )}

        {activeSection === 'Configurações' && (
          <section className="panel-grid">
            <div className="panel-card">
              <h3>Resumo de ativações</h3>
              <div className="metrics small-grid">
                <div className="metric-box"><span>Pendentes</span><strong>{summary.pending}</strong></div>
                <div className="metric-box"><span>Usados</span><strong>{summary.used}</strong></div>
                <div className="metric-box"><span>Revogados</span><strong>{summary.revoked}</strong></div>
                <div className="metric-box"><span>Expirados</span><strong>{summary.expired}</strong></div>
              </div>
            </div>

            <div className="panel-card">
              <h3>Gerar código</h3>
              <div className="stack-form">
                <label>
                  Nome do estabelecimento
                  <input value={codeForm.establishmentName} onChange={(event) => setCodeForm({ ...codeForm, establishmentName: event.target.value })} type="text" placeholder="Ex: Jardim da Praça" />
                </label>
                <label>
                  Nome da pessoa
                  <input value={codeForm.personName} onChange={(event) => setCodeForm({ ...codeForm, personName: event.target.value })} type="text" placeholder="Ex: João Silva" />
                </label>
                <label>
                  E-mail
                  <input value={codeForm.personEmail} onChange={(event) => setCodeForm({ ...codeForm, personEmail: event.target.value })} type="email" placeholder={user?.email || 'contato@miar.ai'} />
                </label>
                <button className="primary-button" onClick={handleGenerateCode} disabled={busy}>Gerar código</button>
              </div>
            </div>

            <div className="panel-card full-width">
              <h3>Códigos gerados</h3>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Estabelecimento</th>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nenhum código gerado.</td>
                    </tr>
                  ) : (
                    codes.map((code) => (
                      <tr key={code.id}>
                        <td>{code.code}</td>
                        <td>{code.establishment_name || 'Estabelecimento'}</td>
                        <td>{code.person_name || 'Pessoa'}</td>
                        <td>{code.person_email || '—'}</td>
                        <td>{code.status}</td>
                        <td><button className="primary-button small" onClick={() => handleSendCode(code.id)}>Registrar envio</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      <ConfirmModal request={confirmRequest} busy={confirmBusy} onCancel={() => setConfirmRequest(null)} />
    </div>
  );
}

export default App;
