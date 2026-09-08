import { useEffect, useMemo, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Building2, CircleDollarSign, Copy, Eye, EyeOff, KeyRound, LogIn, Plus, ShieldCheck, Users, WalletCards, Link2, Send } from 'lucide-react';
import GhostFibers from './components/GhostFibers';
import './representante.css';

type Establishment = { id: string; name: string; city: string; company_id?: string | null };
type TeamMember = { id: string; name: string; slug: string; created_at: string; childCount: number };
type PendingInvite = { id: string; invitee_email: string; invitee_phone: string | null; created_at: string; expires_at: string };
type Commission = { id: string; company_id: string; company_name: string; source_amount_cents: number; amount_cents: number; level: number; status: string; created_at: string; paid_at: string | null };
type Dashboard = { companiesAttributed: number; companiesConverted: number; commissionPendingCents: number; commissionPaidCents: number; teamSize: number };
type Me = { id: string; name: string; email: string; slug: string; signupLink: string; representativeSignupLink: string };

const api = import.meta.env.VITE_API_URL ?? '';
const tokenKey = 'miar-representante-token';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem(tokenKey);
  const response = await fetch(`${api}/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir a operação.');
  return data as T;
}

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Campo de senha com botão de mostrar/ocultar (05/09/2026, pedido explícito
// — nenhum campo de senha aqui tinha isso, ficava impossível conferir o que
// foi digitado antes de enviar).
function PasswordField({ value, onChange, minLength }: { value: string; onChange: (v: string) => void; minLength?: number }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input type={visible ? 'text' : 'password'} minLength={minLength} required value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ─── Tela de aceite de convite (pública, ?token=... na URL) ───────────────────
function AcceptInviteScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const [inviter, setInviter] = useState<{ inviterName: string; inviterSlug: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    request<{ inviterName: string; inviterSlug: string }>(`/representantes/equipe/convite/${token}`)
      .then(setInviter)
      .catch((err) => setError(err instanceof Error ? err.message : 'Convite inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const accept = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const data = await request<{ token: string }>('/representantes/equipe/aceitar', { method: 'POST', body: JSON.stringify({ token, name, email, password }) });
      window.localStorage.setItem(tokenKey, data.token);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aceitar convite.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="rep-login"><p className="muted">Verificando convite…</p></main>;
  if (!inviter) return <main className="rep-login"><section className="rep-login-card"><p className="error">{error || 'Convite inválido ou expirado.'}</p></section></main>;

  return (
    <main className="rep-login">
      <section className="rep-login-card">
        <div className="rep-mark">M</div>
        <p className="eyebrow">MIAR AI/FOOD</p>
        <h1>Você foi convidado</h1>
        <p className="muted">{inviter.inviterName} convidou você para integrar a equipe comercial MIAR. Crie sua própria conta de representante.</p>
        <form onSubmit={accept}>
          <label>Nome completo<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Senha<PasswordField value={password} onChange={setPassword} minLength={10} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={submitting} type="submit"><LogIn size={17} /> {submitting ? 'Aguarde...' : 'Aceitar convite e criar conta'}</button>
        </form>
      </section>
    </main>
  );
}

export default function App() {
  const inviteToken = useMemo(() => new URLSearchParams(window.location.search).get('token'), []);
  const [token, setToken] = useState(() => window.localStorage.getItem(tokenKey));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'carteira' | 'equipe' | 'link' | 'comissoes'>('carteira');

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');

  const [me, setMe] = useState<Me | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [repQrDataUrl, setRepQrDataUrl] = useState('');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [team, setTeam] = useState<{ members: TeamMember[]; pendingInvites: PendingInvite[] }>({ members: [], pendingInvites: [] });
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteSplit, setInviteSplit] = useState('20');
  const [lastInviteLink, setLastInviteLink] = useState('');

  const loadEstablishments = async () => {
    try { setEstablishments(await request<Establishment[]>('/representantes/estabelecimentos')); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a carteira.'); }
  };
  const loadMe = async () => {
    try {
      const data = await request<Me>('/representantes/me');
      setMe(data);
      QrCode(data.signupLink).then(setQrDataUrl);
      QrCode(data.representativeSignupLink).then(setRepQrDataUrl);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar perfil.'); }
  };
  const loadDashboard = async () => {
    try { setDashboard(await request<Dashboard>('/representantes/dashboard')); } catch { /* silencioso */ }
  };
  const loadTeam = async () => {
    try { setTeam(await request('/representantes/equipe')); } catch { /* silencioso */ }
  };
  const loadCommissions = async () => {
    try { setCommissions(await request<Commission[]>('/representantes/comissoes')); } catch { /* silencioso */ }
  };

  async function QrCode(text: string): Promise<string> {
    try { return await QRCode.toDataURL(text, { width: 220, margin: 1 }); } catch { return ''; }
  }

  useEffect(() => {
    if (!token) return;
    void loadEstablishments();
    void loadMe();
    void loadDashboard();
    void loadTeam();
    void loadCommissions();
  }, [token]);

  // Cadastro (05/09/2026, pedido explícito) só existe no site
  // (miarisite.../representante — CPF, telefone e endereço completo, que o
  // backend agora exige). Este app é só login de quem já tem conta.
  const login = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try { const data = await request<{ token: string }>('/representantes/login', { method: 'POST', body: JSON.stringify({ email, password }) }); window.localStorage.setItem(tokenKey, data.token); setToken(data.token); setPassword(''); } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Falha no acesso.'); } finally { setLoading(false); }
  };
  const addEstablishment = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try { await request('/representantes/estabelecimentos', { method: 'POST', body: JSON.stringify({ name: newName, city: newCity }) }); setNewName(''); setNewCity(''); setShowForm(false); await loadEstablishments(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar cadastro.'); } finally { setLoading(false); }
  };
  const generateCode = async (id: string) => {
    setError('');
    try { const data = await request<{ code: string }>(`/representantes/estabelecimentos/${id}/codigo`, { method: 'POST' }); setCode(data.code); await navigator.clipboard?.writeText(data.code); } catch (codeError) { setError(codeError instanceof Error ? codeError.message : 'Falha ao gerar código.'); }
  };
  const sendInvite = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const data = await request<{ acceptLink: string }>('/representantes/equipe/convidar', { method: 'POST', body: JSON.stringify({ email: inviteEmail, phone: invitePhone || undefined, splitPercent: Number(inviteSplit) }) });
      setLastInviteLink(data.acceptLink);
      setInviteEmail(''); setInvitePhone(''); setInviteSplit('20'); setShowInvite(false);
      await loadTeam();
    } catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : 'Falha ao enviar convite.'); } finally { setLoading(false); }
  };

  if (inviteToken) return <AcceptInviteScreen token={inviteToken} onDone={() => { window.location.href = window.location.pathname; }} />;

  if (!token) return <main className="rep-login">
    <div className="rep-login-veil"><GhostFibers lineColor="#06100A" glowColor="#38B000" speed={0.2} scale={2} rotation={0} rotationSpeed={0.25} layers={4} waveAmplitude={0.3} waveFrequency={3} waveSpeed={0.15} layerSpeed={0.08} twist={0.1} twistFrequency={5} twistSpeed={1.2} lineFrequency={5} lineSpacing={2} lineSharpness={16} glowFalloff={10} glowIntensity={1.6} brightness={2} blueBoost={1.25} vignette={0.8} grain={0.05} dpr={1} /></div>
    <section className="rep-login-card rep-login-card--glass"><div className="rep-mark">M</div><p className="eyebrow">MIAR AI/FOOD</p><h1>Gestor Representante</h1><p className="muted">Sua carteira comercial, em um só lugar.</p><form onSubmit={login}><label>E-mail<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha<PasswordField value={password} onChange={setPassword} minLength={10} /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={loading} type="submit"><LogIn size={17} /> {loading ? 'Aguarde...' : 'Entrar'}</button></form><a className="link-button" href="/representante">Ainda não é representante? Cadastre-se →</a><p className="security-note"><ShieldCheck size={16} /> Acesso individual e auditável</p></section>
  </main>;

  return <main className="rep-shell"><aside><div className="brand"><span className="rep-mark small">M</span><span>MIAR<br /><strong>Representante</strong></span></div><nav>
    <button className={tab === 'carteira' ? 'active' : ''} onClick={() => setTab('carteira')}><Building2 size={18} /> Carteira</button>
    <button className={tab === 'equipe' ? 'active' : ''} onClick={() => setTab('equipe')}><Users size={18} /> Minha equipe</button>
    <button className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}><Link2 size={18} /> Meu link</button>
    <button className={tab === 'comissoes' ? 'active' : ''} onClick={() => setTab('comissoes')}><CircleDollarSign size={18} /> Comissões</button>
  </nav><button className="logout" onClick={() => { window.localStorage.removeItem(tokenKey); setToken(null); }}>Sair</button></aside>

  <section className="rep-content">
    {error && <p className="error banner">{error}</p>}

    {tab === 'carteira' && <>
      <header><div><p className="eyebrow">PAINEL COMERCIAL</p><h1>Minha carteira</h1><p className="muted">Acompanhe estabelecimentos e ações autorizadas.</p></div><button className="primary" onClick={() => setShowForm(true)}><Plus size={17} /> Novo estabelecimento</button></header>
      <div className="metrics"><article><Building2 size={20} /><strong>{establishments.length}</strong><span>Estabelecimentos</span></article><article><WalletCards size={20} /><strong>Consulta real</strong><span>Pagamentos autorizados</span></article><article><KeyRound size={20} /><strong>{establishments.filter((item) => !item.company_id).length}</strong><span>Aguardando vínculo</span></article></div>
      <section className="panel"><div className="panel-heading"><div><h2>Estabelecimentos</h2><p className="muted">O gestor confirma o vínculo com um código de uso único.</p></div><button className="icon-button" title="Copiar código gerado" disabled={!code} onClick={() => void navigator.clipboard?.writeText(code)}><Copy size={17} /></button></div><div className="table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{establishments.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.city}</small></td><td><span className="status">{item.company_id ? 'Vinculado' : 'Aguardando código'}</span></td><td>{!item.company_id && <button className="table-action" onClick={() => void generateCode(item.id)}><KeyRound size={15} /> Gerar código</button>}</td></tr>)}</tbody></table></div></section>
    </>}

    {tab === 'equipe' && <>
      <header><div><p className="eyebrow">EQUIPE COMERCIAL</p><h1>Minha equipe</h1><p className="muted">Convide pessoas para criar sua própria conta de representante, subordinada à sua.</p></div><button className="primary" onClick={() => setShowInvite(true)}><Send size={17} /> Convidar</button></header>
      <div className="metrics"><article><Users size={20} /><strong>{team.members.length}</strong><span>Membros diretos</span></article><article><KeyRound size={20} /><strong>{team.pendingInvites.length}</strong><span>Convites pendentes</span></article></div>
      {lastInviteLink && <section className="panel code-panel"><div className="code-box"><p className="muted">Link de convite gerado — copie e envie por WhatsApp ou e-mail:</p><code style={{ wordBreak: 'break-all' }}>{lastInviteLink}</code><a className="table-action" href={`https://wa.me/?text=${encodeURIComponent(lastInviteLink)}`} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a></div></section>}
      <section className="panel"><h2>Membros diretos</h2><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Slug</th><th>Equipe dele</th></tr></thead><tbody>{team.members.map((m) => <tr key={m.id}><td><strong>{m.name}</strong></td><td>{m.slug}</td><td>{m.childCount}</td></tr>)}</tbody></table></div></section>
      <section className="panel"><h2>Convites pendentes</h2><div className="table-wrap"><table><thead><tr><th>E-mail</th><th>Expira em</th></tr></thead><tbody>{team.pendingInvites.map((i) => <tr key={i.id}><td>{i.invitee_email}</td><td>{new Date(i.expires_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div></section>
    </>}

    {tab === 'link' && me && <>
      <header><div><p className="eyebrow">LINK DE INDICAÇÃO</p><h1>Meus links</h1><p className="muted">Dois links separados — um pra indicar restaurantes, outro pra convidar novos representantes pra sua equipe.</p></div></header>
      <section className="panel code-panel">
        <div className="code-box">
          <h2 style={{ marginBottom: 4 }}>Indicar um restaurante</h2>
          <p className="muted">Estabelecimentos que se cadastrarem por aqui são atribuídos automaticamente a você.</p>
          {qrDataUrl && <img src={qrDataUrl} alt="QR code do link de indicação de restaurante" width={220} height={220} />}
          <code style={{ wordBreak: 'break-all' }}>{me.signupLink}</code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="table-action" onClick={() => void navigator.clipboard?.writeText(me.signupLink)}><Copy size={15} /> Copiar link</button>
            <a className="table-action" href={`https://wa.me/?text=${encodeURIComponent(me.signupLink)}`} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a>
          </div>
        </div>
      </section>
      <section className="panel code-panel">
        <div className="code-box">
          <h2 style={{ marginBottom: 4 }}>Convidar um representante</h2>
          <p className="muted">Quem se cadastrar por aqui vira parte da sua equipe automaticamente — o vínculo é conferido no banco no momento do cadastro.</p>
          {repQrDataUrl && <img src={repQrDataUrl} alt="QR code do convite de representante" width={220} height={220} />}
          <code style={{ wordBreak: 'break-all' }}>{me.representativeSignupLink}</code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="table-action" onClick={() => void navigator.clipboard?.writeText(me.representativeSignupLink)}><Copy size={15} /> Copiar link</button>
            <a className="table-action" href={`https://wa.me/?text=${encodeURIComponent(me.representativeSignupLink)}`} target="_blank" rel="noreferrer">Compartilhar no WhatsApp</a>
          </div>
        </div>
      </section>
    </>}

    {tab === 'comissoes' && <>
      <header><div><p className="eyebrow">RESULTADOS</p><h1>Comissões</h1><p className="muted">30% do que a empresa paga à MIAR — gerado apenas quando o pagamento é confirmado.</p></div></header>
      <div className="metrics">
        <article><Building2 size={20} /><strong>{dashboard?.companiesAttributed ?? 0}</strong><span>Empresas atribuídas</span></article>
        <article><WalletCards size={20} /><strong>{dashboard?.companiesConverted ?? 0}</strong><span>Pagantes</span></article>
        <article><CircleDollarSign size={20} /><strong>{centsToBRL(dashboard?.commissionPendingCents ?? 0)}</strong><span>Pendente</span></article>
      </div>
      <div className="metrics">
        <article><CircleDollarSign size={20} /><strong>{centsToBRL(dashboard?.commissionPaidCents ?? 0)}</strong><span>Pago</span></article>
        <article><Users size={20} /><strong>{dashboard?.teamSize ?? 0}</strong><span>Membros da equipe</span></article>
      </div>
      <section className="panel"><h2>Lançamentos</h2><div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Nível</th><th>Valor</th><th>Situação</th><th>Data</th></tr></thead><tbody>{commissions.map((c) => <tr key={c.id}><td>{c.company_name}</td><td>{c.level}</td><td>{centsToBRL(c.amount_cents)}</td><td><span className="status">{c.status === 'paid' ? 'Pago' : 'Pendente'}</span></td><td>{new Date(c.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table></div></section>
    </>}
  </section>

  {showForm && <div className="modal-backdrop"><form className="modal" onSubmit={addEstablishment}><h2>Cadastrar estabelecimento</h2><label>Nome do estabelecimento<input required value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>Cidade e país<input required value={newCity} onChange={(event) => setNewCity(event.target.value)} /></label><div className="modal-actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary" disabled={loading} type="submit">Salvar cadastro</button></div></form></div>}

  {showInvite && <div className="modal-backdrop"><form className="modal" onSubmit={sendInvite}><h2>Convidar para a equipe</h2><label>E-mail do convidado<input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label><label>Telefone (opcional)<input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} /></label><label>Percentual de repasse (%)<input type="number" min={0} max={100} required value={inviteSplit} onChange={(e) => setInviteSplit(e.target.value)} /></label><div className="modal-actions"><button type="button" onClick={() => setShowInvite(false)}>Cancelar</button><button className="primary" disabled={loading} type="submit">Enviar convite</button></div></form></div>}
  </main>;
}
