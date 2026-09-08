import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, ArrowRight, Loader2, Wifi, WifiOff, Zap, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { useTranslation } from '@/i18n/IdiomaContext';
import { SeletorIdioma } from '@/i18n/SeletorIdioma';
import GhostFibers from '@/components/GhostFibers';
import { startKioskMode } from '@/lib/kiosk';

function getStoredToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token');
}

function storeAuthToken(token: string, remember = true) {
  window.localStorage.removeItem('miar-owner-token');
  window.sessionStorage.removeItem('miar-owner-token');
  (remember ? window.localStorage : window.sessionStorage).setItem('miar-owner-token', token);
}

export default function LoginMIAR() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  // Tabs - Administrador por padrão para donos de conta
  const [mainTab, setMainTab] = useState<'admin' | 'operacional'>('admin');

  // Connection State
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Form Fields - Admin
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Form Fields - Operacional
  const [opUsername, setOpUsername] = useState('');
  const [opPin, setOpPin] = useState('');

  // Common UI Controls
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Erro de login persistente (05/09/2026): antes só existia um toast, que
  // some sozinho em poucos segundos e é fácil de perder — ficava difícil
  // saber se a falha foi "senha errada" (o usuário digitou algo errado) ou
  // "erro de servidor/conexão" (problema real, não é o usuário). Agora fica
  // um banner fixo no formulário até o próximo envio, com o texto certo
  // pra cada caso.
  const [loginError, setLoginError] = useState<{ kind: 'credentials' | 'connection'; message: string } | null>(null);
  const [stayConnected, setStayConnected] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Monitor Online/Offline Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if already authenticated
  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken && existingToken !== 'dev-bypass') {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${existingToken}` },
      })
        .then((res) => {
          if (res.ok) setLocation('/painel');
        })
        .catch(() => {
          window.localStorage.removeItem('miar-owner-token');
        });
    }
  }, [setLocation]);

  const redirectByRole = (role: string, customPermissions?: string[]) => {
    const r = (role || '').toLowerCase();
    window.localStorage.setItem('miar-current-user-role', r);
    if (customPermissions && Array.isArray(customPermissions)) {
      window.localStorage.setItem('miar-current-user-permissions', JSON.stringify(customPermissions));
    } else {
      // Chat da equipe é liberado pra TODO funcionário, de qualquer perfil
      // (05/09/2026, pedido explícito) — sempre incluído, nunca depende do
      // cargo como os módulos operacionais abaixo.
      if (r.includes('waiter') || r.includes('garcom') || r.includes('atendente')) {
        window.localStorage.setItem('miar-current-user-permissions', JSON.stringify(['mesas', 'chat-equipe']));
      } else if (r.includes('cook') || r.includes('cozinha')) {
        window.localStorage.setItem('miar-current-user-permissions', JSON.stringify(['cozinha', 'chat-equipe']));
      } else if (r.includes('cashier') || r.includes('caixa')) {
        window.localStorage.setItem('miar-current-user-permissions', JSON.stringify(['pdv', 'mesas', 'chat-equipe']));
      } else {
        window.localStorage.setItem('miar-current-user-permissions', JSON.stringify(['dashboard', 'pdv', 'cozinha', 'mesas', 'comando', 'cardapio', 'estoque', 'compras', 'financeiro', 'funcionarios', 'ia', 'configuracoes', 'chat-equipe']));
      }
    }

    if (r.includes('cook') || r.includes('cozinha')) setLocation('/app/cozinha');
    else if (r.includes('cashier') || r.includes('caixa')) setLocation('/app/pdv');
    else if (r.includes('waiter') || r.includes('garcom') || r.includes('atendente')) setLocation('/app/mesas');
    else setLocation('/painel');
  };

  // Submit Operacional Login (Usuário + PIN / Senha criado pelo Administrador)
  const handleOperacionalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const userClean = opUsername.trim().toLowerCase();
    const pinClean = opPin.trim();

    if (!userClean || !pinClean) {
      toast.error('Preencha o usuário e a senha/PIN.');
      return;
    }

    setLoginError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/employees/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userClean, pin: pinClean }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.employee && data?.token) {
        toast.success(`Bem-vindo(a), ${data.employee.name}!`);
        storeAuthToken(data.token, remember);
        // Guarda as permissões granulares reais do funcionário (mesmo objeto
        // EmployeePermissions do backend — data-store.ts) separado do array
        // de módulos ('miar-current-user-permissions', usado só pro menu do
        // AppLayout). Telas específicas (ex.: botão "+ Nova Mesa" em
        // mesas.tsx) leem daqui pra decidir o que mostrar, ao invés de
        // reimplementar defaults por cargo no frontend.
        if (data.employee.permissions) {
          window.localStorage.setItem('miar-employee-permissions', JSON.stringify(data.employee.permissions));
        }
        // Login Operacional = colaborador num aparelho da empresa — trava a
        // tela nesse app (Screen Pinning) pra ele não sair pro launcher/outros
        // apps durante o turno. No-op fora do app nativo Android (ver lib/kiosk.ts).
        void startKioskMode();
        redirectByRole(data.employee.role);
        return;
      } else {
        const message = data?.error || 'Usuário ou PIN incorretos.';
        setLoginError({ kind: 'credentials', message });
        toast.error(message);
      }
    } catch {
      const message = 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
      setLoginError({ kind: 'connection', message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Admin Login (E-mail + Senha do dono, cadastrado via miar.ai)
  const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      toast.error('Preencha o e-mail e a senha.');
      return;
    }

    setLoginError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.token) {
        storeAuthToken(data.token, remember);
        // Login de dono: descarta qualquer permissão de funcionário deixada
        // por uma sessão operacional anterior no mesmo navegador.
        window.localStorage.removeItem('miar-employee-permissions');
        toast.success('Login de Administrador Efetuado!');
        setLocation('/painel');
        return;
      } else {
        const message = data?.error || 'E-mail ou senha incorretos.';
        setLoginError({ kind: 'credentials', message });
        toast.error(message);
      }
    } catch {
      const message = 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
      setLoginError({ kind: 'connection', message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#06100A] text-[#F2F7F3] px-4 py-6 select-none overflow-hidden font-inter">
      {/* Dynamic WebGL Shader Background (GhostFibers, React Bits) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GhostFibers
          lineColor="#16301F"
          glowColor="#008000"
          speed={0.2}
          scale={2}
          rotation={180}
          rotationSpeed={0.15}
          layers={4}
          waveFrequency={3}
          waveSpeed={2}
          layerSpeed={0.08}
          twist={0.1}
          twistFrequency={4.7}
          twistSpeed={1.2}
          lineFrequency={5}
          lineSpacing={4}
          lineSharpness={16}
          glowFalloff={10}
          glowIntensity={1.4}
          brightness={1.6}
          blueBoost={0.9}
          vignette={0.8}
          grain={0.05}
          dpr={1}
        />
      </div>

      {/* Glows de fundo em Prussian Blue e School Bus Yellow */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-[#0B1A10] opacity-60 blur-[100px] pointer-events-none" />
      {/* Seletor de Idioma no topo da página */}
      <div className="absolute top-4 right-4 z-30">
        <SeletorIdioma />
      </div>

      {/* Main Container - High Contrast Dark Tech Premium */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg rounded-3xl border border-[#16301F] bg-[#0B1A10]/95 p-8 shadow-2xl backdrop-blur-2xl"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="h-12 w-48 mb-2 flex items-center justify-center">
            <img
              src="/branding/miar-logo-real.png"
              alt="MIAR AI / FOOD"
              className="h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(255,195,0,0.3)]"
            />
          </div>
          <p className="text-sm text-[#8FA396] font-medium">{t('auth.slogan')}</p>
        </div>

        {/* Main Tab Switcher: [ Administrador ] | [ Operacional ] */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#06100A] p-1.5 border border-[#16301F] mb-4">
          <button
            type="button"
            onClick={() => { setMainTab('admin'); setLoginError(null); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              mainTab === 'admin'
                ? 'bg-[#16301F] text-[#F2F7F3] font-bold border border-[#008000]/40 shadow'
                : 'text-[#8FA396] hover:text-[#F2F7F3]'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {t('auth.admin')}
          </button>
          <button
            type="button"
            onClick={() => { setMainTab('operacional'); setLoginError(null); }}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              mainTab === 'operacional'
                ? 'bg-[#16301F] text-[#F2F7F3] font-bold border border-[#008000]/40 shadow'
                : 'text-[#8FA396] hover:text-[#F2F7F3]'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t('auth.operacional')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {/* TAB 1: OPERACIONAL (Usuário + PIN/Senha cadastrado pelo Administrador) */}
          {mainTab === 'operacional' ? (
            <motion.form
              key="tab-operacional"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleOperacionalSubmit}
              className="space-y-4"
            >
              {loginError && (
                <div
                  role="alert"
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    loginError.kind === 'credentials'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {loginError.kind === 'credentials' ? '🔒 ' : '⚠️ '}{loginError.message}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-[#8FA396] mb-1">
                  {t('auth.user')}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#38B000]" />
                  <input
                    type="text"
                    value={opUsername}
                    onChange={(e) => setOpUsername(e.target.value)}
                    required
                    placeholder={t('auth.user.placeholder')}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#8FA396]">
                    {t('auth.pin')}
                  </label>
                  <button
                    type="button"
                    onClick={() => toast.info('Entre em contato com o administrador para redefinir seu PIN.')}
                    className="text-[10px] text-[#8FA396] hover:text-[#008000] hover:underline"
                  >
                    {t('auth.forgot_pin')}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={opPin}
                    onChange={(e) => setOpPin(e.target.value)}
                    required
                    placeholder={t('auth.pin.placeholder')}
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-10 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8FA396] hover:text-[#F2F7F3]"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center justify-between text-[11px] text-[#8FA396] pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-[#16301F] bg-[#06100A] text-[#008000] focus:ring-0 cursor-pointer"
                  />
                  <span>{t('auth.remember')}</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stayConnected}
                    onChange={(e) => setStayConnected(e.target.checked)}
                    className="rounded border-[#16301F] bg-[#06100A] text-[#008000] focus:ring-0 cursor-pointer"
                  />
                  <span>{t('auth.stay_connected')}</span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-3 text-xs font-inter font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_2px_12px_rgba(255,195,0,0.3)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.button.entering')}
                  </>
                ) : (
                  <>
                    {t('auth.enter_btn')}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            /* TAB 2: ADMINISTRADOR (E-mail + Senha do dono, cadastrado via miar.ai) */
            <motion.form
              key="tab-admin"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleAdminSubmit}
              className="space-y-4"
            >
              {loginError && (
                <div
                  role="alert"
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    loginError.kind === 'credentials'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {loginError.kind === 'credentials' ? '🔒 ' : '⚠️ '}{loginError.message}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-[#8FA396] mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required
                    placeholder="Digite seu e-mail"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-3 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#8FA396]">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => toast.info('Link de recuperação enviado para o e-mail cadastrado.')}
                    className="text-[10px] text-[#8FA396] hover:text-[#008000] hover:underline"
                  >
                    Recuperar no site
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8FA396]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    placeholder="Digite sua senha"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] py-2.5 pl-10 pr-10 text-xs text-[#F2F7F3] placeholder-[#7A8F7E] focus:border-[#008000] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8FA396] hover:text-[#F2F7F3]"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center justify-between text-[11px] text-[#8FA396] pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-[#16301F] bg-[#06100A] text-[#008000] focus:ring-0 cursor-pointer"
                  />
                  <span>Lembrar minha conta</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stayConnected}
                    onChange={(e) => setStayConnected(e.target.checked)}
                    className="rounded border-[#16301F] bg-[#06100A] text-[#008000] focus:ring-0 cursor-pointer"
                  />
                  <span>Manter conectado</span>
                </label>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#008000] py-3 text-xs font-inter font-bold text-[#F2F7F3] hover:bg-[#38B000] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_2px_12px_rgba(255,195,0,0.3)]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              {/* Informação sobre cadastro de novas contas via site */}
              <div className="pt-2 border-t border-[#16301F] text-center">
                <p className="text-[11px] text-[#8FA396]">
                  Ainda não possui uma conta?{' '}
                  <a
                    href="https://miar.ai/food"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#008000] hover:underline"
                  >
                    Assine no site miar.ai
                  </a>
                </p>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Footer Security Badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#7A8F7E]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#38B000]" />
          <span>Segurança MIAR AI / FOOD • Dark Tech System</span>
        </div>
      </motion.div>
    </div>
  );
}
