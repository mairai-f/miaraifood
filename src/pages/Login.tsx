/*
  Login.tsx – página de autenticação principal da MIAR AI/FOOD.
  - Gerencia login de Administrador (online/offline) e Operador.
  - Utiliza o hook useAuth (AuthContext) para realizar chamadas ao Supabase.
  - Integração com Electron via IPC (offline/online status, licença).
  - Fluxos de login e recuperação de credenciais são detalhados nos diagramas UML.
*/
import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import GhostFibers from '@/components/GhostFibers';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import loginPdvRapido from '@/assets/login/pdvrapido.webp';
import loginRelatorios from '@/assets/login/relatorios.webp';
import loginErp from '@/assets/login/erp.webp';
import loginEstoque from '@/assets/login/estoque.webp';
import {
  applySystemSessionPreference,
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from '@/lib/authSessionPreferences';
import { clearDesktopActivation, readDesktopActivation } from '@/lib/desktopActivation';
import { readOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { isLocalAppRuntime, isMobileAppRuntime } from '@/lib/offlineConcentrator';
import type { Database } from '@/integrations/supabase/types';
import { getOperatorCredentialError } from '../../shared/security/operatorCredential';
import { requestTurnstileToken } from '../../shared/security/turnstile';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { miarCollapsedIconWhite } from '@/lib/brandAssets';

type LoginMode = 'admin' | 'operator';
type AdminAccessMode = 'online' | 'offline';
type OperatorRecoveryStep = 'email' | 'code' | 'reset';

interface RecoveryOperator {
  user_id: string;
  username: string;
  role: 'operator' | 'waiter' | 'hr';
}

interface OperatorRecoveryResponse {
  success?: boolean;
  operators?: RecoveryOperator[];
  operator?: RecoveryOperator;
  error?: string;
}

const operatorRecoveryClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'happycash-operator-recovery',
    },
  },
);

const loginFeatureCards = [
  { label: 'PDV Rápido', image: loginPdvRapido, imageClassName: 'w-full scale-[1.28]' },
  { label: 'Relatórios', image: loginRelatorios, imageClassName: 'w-full scale-[1.28]' },
  { label: 'ERP', image: loginErp, imageClassName: 'w-full scale-[1.28]' },
  { label: 'Estoque', image: loginEstoque, imageClassName: 'w-full scale-[1.28]' },
];

const MIAR_SITE_RECOVERY_URL = 'https://www.miaraifood.com.br/login?recovery=1';

/*
  Componente Login – ponto de entrada da UI de autenticação.
  Inicializa estados de preferência, modo de login e verifica status online/offline.
*/
export default function Login() {
  const initialPreferences = getSystemLoginPreferences();
  const desktopActivation = readDesktopActivation();
  const offlineAdminAccess = desktopActivation?.ownerUserId
    ? readOfflineAdminAccess(desktopActivation.ownerUserId)
    : null;
  const offlineAdminAvailable = Boolean(desktopActivation && offlineAdminAccess);
  const initialLoginMode = desktopActivation
    ? (offlineAdminAvailable ? 'operator' : 'admin')
    : initialPreferences.loginMode;
  const [loginMode, setLoginMode] = useState<LoginMode>(initialLoginMode);
  const [adminAccessMode, setAdminAccessMode] = useState<AdminAccessMode>(() => (
    offlineAdminAvailable && typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'
  ));
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [email, setEmail] = useState(initialPreferences.adminEmail);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminAccessCode, setAdminAccessCode] = useState('');
  const [adminLoginVerificationRequired, setAdminLoginVerificationRequired] = useState(false);
  const [adminLoginAlert, setAdminLoginAlert] = useState<string | null>(null);
  const [adminOfflineUsername, setAdminOfflineUsername] = useState(offlineAdminAccess?.username ?? '');
  const [adminOfflinePin, setAdminOfflinePin] = useState('');
  const [operatorUsername, setOperatorUsername] = useState(initialPreferences.operatorUsername);
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [keepConnected, setKeepConnected] = useState(initialPreferences.keepConnected);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const { login, signInWithGoogle, loginOfflineAdmin, loginOperator } = useAuth();
  const { canInstall: canInstallPwa, isInstalling: installingPwa, install: installPwa } = usePwaInstall();
  const isLocalRuntime = isLocalAppRuntime();
  const isMobileApp = isMobileAppRuntime();
  const localDeviceReference = isMobileApp ? 'este aparelho' : 'esta maquina';
  const localDeviceSetupReference = isMobileApp ? 'deste aparelho' : 'desta maquina';
  const localRuntimeLabel = isMobileApp ? 'app Android' : 'desktop';
  const canUseGoogleLogin = adminAccessMode === 'online' && !isLocalRuntime && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);

  const [operatorRecoveryOpen, setOperatorRecoveryOpen] = useState(false);
  const [operatorRecoveryStep, setOperatorRecoveryStep] = useState<OperatorRecoveryStep>('email');
  const [operatorRecoveryEmail, setOperatorRecoveryEmail] = useState('');
  const [operatorRecoveryCode, setOperatorRecoveryCode] = useState('');
  const [operatorRecoveryList, setOperatorRecoveryList] = useState<RecoveryOperator[]>([]);
  const [operatorRecoveryUserId, setOperatorRecoveryUserId] = useState('');
  const [operatorRecoveryPin, setOperatorRecoveryPin] = useState('');
  const [operatorRecoveryBusy, setOperatorRecoveryBusy] = useState(false);

  useEffect(() => {
    const syncNetworkStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', syncNetworkStatus);
    window.addEventListener('offline', syncNetworkStatus);

    return () => {
      window.removeEventListener('online', syncNetworkStatus);
      window.removeEventListener('offline', syncNetworkStatus);
    };
  }, []);

  useEffect(() => {
    if (offlineAdminAccess?.username) {
      setAdminOfflineUsername(offlineAdminAccess.username);
    }
  }, [offlineAdminAccess?.username]);

  useEffect(() => {
    if (offlineAdminAvailable && !isOnline) {
      setAdminAccessMode('offline');
    }
  }, [isOnline, offlineAdminAvailable]);

  /*
  handleAdminSubmit – trata o envio do formulário de login do Administrador.
  - Salva preferências de login.
  - Executa login offline (PIN) ou online (email/senha) via Supabase.
  - Em caso de verificação adicional, solicita código de acesso.
*/
const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    saveSystemLoginPreferences({
      loginMode: 'admin',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setSubmitting(true);
    setAdminLoginAlert(null);

    try {
      const result = adminAccessMode === 'offline'
        ? await loginOfflineAdmin(adminOfflineUsername, adminOfflinePin)
        : await login(email, adminPassword, adminLoginVerificationRequired ? adminAccessCode : undefined);
      if (result !== true) {
        if (typeof result === 'object') {
          setAdminLoginVerificationRequired(Boolean(result.verificationRequired));
          if (result.verificationRequired) setAdminAccessCode('');
          setAdminLoginAlert(result.error || 'Codigo de autorizacao necessario.');
          toast.error(result.error || 'Codigo de autorizacao necessario.');
          return;
        }

        toast.error(result || (adminAccessMode === 'offline'
          ? 'Usuario admin ou PIN incorretos.'
          : 'Email ou senha incorretos.'));
        return;
      }

      if (adminAccessMode === 'online') {
        setAdminLoginVerificationRequired(false);
        setAdminAccessCode('');
        setAdminLoginAlert(null);
        applySystemSessionPreference(keepConnected);
      }
    } finally {
      setSubmitting(false);
    }
  };

  /*
  handleOperatorSubmit – trata o envio do formulário de login do Operador.
  - Usa loginOperator do AuthContext para autenticação via Supabase.
  - Aplica preferências de manter conectado.
*/
const handleOperatorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    saveSystemLoginPreferences({
      loginMode: 'operator',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setSubmitting(true);

    try {
      const result = await loginOperator(operatorUsername, operatorPassword);
      if (result !== true) {
        toast.error(result || 'Usuário ou senha incorretos.');
        return;
      }

      applySystemSessionPreference(keepConnected);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (oauthSubmitting || !canUseGoogleLogin) return;

    saveSystemLoginPreferences({
      loginMode: 'admin',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setOauthSubmitting(true);
    const result = await signInWithGoogle();

    if (result !== true) {
      setOauthSubmitting(false);
      toast.error(result || 'Nao foi possivel iniciar o login com Google.');
    }
  };

  const resetOperatorRecovery = () => {
    setOperatorRecoveryStep('email');
    setOperatorRecoveryEmail('');
    setOperatorRecoveryCode('');
    setOperatorRecoveryList([]);
    setOperatorRecoveryUserId('');
    setOperatorRecoveryPin('');
    setOperatorRecoveryBusy(false);
    void operatorRecoveryClient.auth.signOut();
  };

  const handleOperatorRecoveryOpenChange = (open: boolean) => {
    setOperatorRecoveryOpen(open);
    if (!open) resetOperatorRecovery();
  };

  const handleSendOperatorRecoveryCode = async () => {
    const normalizedEmail = operatorRecoveryEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Informe o email do administrador.');
      return;
    }

    setOperatorRecoveryBusy(true);
    let captchaToken: string | undefined;
    try {
      captchaToken = await requestTurnstileToken('app-operator-recovery');
    } catch (error) {
      setOperatorRecoveryBusy(false);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel concluir a verificacao de seguranca.');
      return;
    }

    const { error } = await operatorRecoveryClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, captchaToken },
    });
    setOperatorRecoveryBusy(false);

    if (error) {
      toast.error('Nao foi possivel enviar o codigo de recuperacao.');
      return;
    }

    setOperatorRecoveryEmail(normalizedEmail);
    setOperatorRecoveryStep('code');
    toast.success('Codigo enviado ao email do administrador.');
  };

  const handleVerifyOperatorRecoveryCode = async () => {
    const code = operatorRecoveryCode.replace(/\D/g, '');
    if (code.length < 6) {
      toast.error('Informe o codigo recebido por email.');
      return;
    }

    setOperatorRecoveryBusy(true);
    const { data: verification, error: verificationError } = await operatorRecoveryClient.auth.verifyOtp({
      email: operatorRecoveryEmail,
      token: code,
      type: 'email',
    });

    if (verificationError || !verification.session?.access_token) {
      setOperatorRecoveryBusy(false);
      toast.error('Codigo invalido ou expirado.');
      return;
    }

    const { data, error } = await operatorRecoveryClient.functions.invoke<OperatorRecoveryResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${verification.session.access_token}` },
      body: { action: 'list' },
    });
    setOperatorRecoveryBusy(false);

    if (error || !data?.success || !data.operators?.length) {
      toast.error(data?.error || 'Nenhum operador foi encontrado para esta loja.');
      return;
    }

    setOperatorRecoveryList(data.operators);
    setOperatorRecoveryUserId(data.operators[0].user_id);
    setOperatorRecoveryStep('reset');
  };

  const handleResetOperatorCredential = async () => {
    const credentialError = getOperatorCredentialError(operatorRecoveryPin.trim());
    if (credentialError) {
      toast.error(credentialError);
      return;
    }

    const { data: sessionData } = await operatorRecoveryClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken || !operatorRecoveryUserId) {
      toast.error('A recuperacao expirou. Solicite um novo codigo.');
      return;
    }

    setOperatorRecoveryBusy(true);
    const { data, error } = await operatorRecoveryClient.functions.invoke<OperatorRecoveryResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        action: 'reset_password',
        operatorUserId: operatorRecoveryUserId,
        password: operatorRecoveryPin.trim(),
      },
    });
    setOperatorRecoveryBusy(false);

    if (error || !data?.success || !data.operator) {
      toast.error(data?.error || 'Nao foi possivel redefinir o PIN.');
      return;
    }

    setOperatorUsername(data.operator.username);
    setOperatorPassword('');
    setOperatorRecoveryOpen(false);
    resetOperatorRecovery();
    toast.success(`Acesso de ${data.operator.username} recuperado. Informe o novo PIN para entrar.`);
  };

  /*
  Renderiza a interface de login com animações, tabs para Admin/Operador,
  e botões de login Google/OAuth.
  O layout inclui efeitos de glassmorphism e background dinâmico.
*/
return (
    <div className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden px-4 bg-black">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-80">
        <GhostFibers
          lineColor="#06100A"
          glowColor="#70E000"
          speed={0.2}
          scale={2}
          rotation={0}
          rotationSpeed={0.25}
          layers={4}
          waveAmplitude={0.015}
          waveFrequency={3}
          waveSpeed={0.15}
          layerSpeed={0.08}
          twist={0.1}
          twistFrequency={5}
          twistSpeed={1.2}
          lineFrequency={5}
          lineSpacing={2}
          lineSharpness={16}
          glowFalloff={10}
          glowIntensity={1.6}
          brightness={2}
          blueBoost={1.25}
          vignette={0.8}
          grain={0.05}
          dpr={1}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, type: 'spring' }}
        className="w-full max-w-[32rem] relative z-10 max-[360px]:origin-center max-[360px]:scale-[0.94] px-0 sm:px-4"
      >
        <div className="rounded-none sm:rounded-3xl border-y border-x-0 sm:border-x border-white/20 bg-white/10 backdrop-blur-xl px-4 py-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] sm:px-10 sm:py-8 w-full">
          
          <div className="space-y-1 text-center mb-6">
            <div className="flex flex-col items-center justify-center">
              <motion.img
                src={miarCollapsedIconWhite}
                alt="MIAR AI/FOOD"
                className="h-16 w-auto object-contain sm:h-20"
                loading="eager"
                decoding="async"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-3">
                MIAR AI / FOOD
              </h1>
            </div>
          </div>

              {desktopActivation && (
                <div className="mt-2 rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-left text-[13px] leading-5 text-white/80 sm:text-sm sm:leading-6">
                  <p className="font-semibold text-white">{desktopActivation.companyName}</p>
                  {isLocalRuntime && (
                    <p className="mt-1.5 text-white/70">
                      {offlineAdminAvailable
                        ? `Empresa reconhecida ${localDeviceReference}. Ao entrar online, o ${localRuntimeLabel} baixa os dados da loja e atualiza a cópia local para uso offline.`
                        : `Empresa reconhecida ${localDeviceReference}. No primeiro acesso, entre como administrador com email e senha para cadastrar o usuário admin offline ${localDeviceSetupReference}.`}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-white transition-colors hover:text-white/60"
                    onClick={() => {
                      clearDesktopActivation();
                      window.location.reload();
                    }}
                  >
                    Trocar chave {localDeviceSetupReference}
                  </button>
                </div>
              )}
              {!isOnline && !offlineAdminAvailable && (
                <div className="mt-2 rounded-[20px] border border-red-500/30 bg-red-500/20 px-4 py-3 text-[13px] leading-5 text-red-100 sm:text-sm sm:leading-6">
                  {isMobileApp ? 'Este aparelho' : 'Esta maquina'} ainda nao tem usuario admin offline configurado. Conecte a internet, entre com email e senha e finalize o cadastro local.
                </div>
              )}

              {canInstallPwa && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void installPwa()}
                  disabled={installingPwa}
                  className="mt-4 h-10 w-full rounded-2xl border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-50 hover:bg-cyan-300/20 hover:text-white sm:h-11"
                >
                  {installingPwa ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {installingPwa ? 'Abrindo instalação...' : 'Instalar app neste aparelho'}
                </Button>
              )}

              <Tabs value={loginMode} onValueChange={value => setLoginMode(value as LoginMode)} className="mt-4 w-full">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-[18px] bg-black/20 p-1 text-white/50 sm:h-11 border border-white/10">
                  <TabsTrigger
                    value="admin"
                    className="rounded-[14px] text-[13px] font-semibold data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm transition-colors hover:text-white/80"
                  >
                    Administrador
                  </TabsTrigger>
                  <TabsTrigger
                    value="operator"
                    disabled={Boolean(desktopActivation && !offlineAdminAvailable)}
                    className="rounded-[14px] text-[13px] font-semibold data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm transition-colors hover:text-white/80"
                  >
                    Operacional
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="admin" className="mt-3.5 sm:mt-5">
                  <form onSubmit={handleAdminSubmit} className="space-y-3 sm:space-y-4" autoComplete="off">
                    {offlineAdminAvailable && (
                      <div className="rounded-[20px] border border-white/20 bg-white/5 p-3 mb-4 backdrop-blur-md">
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(
                              'h-10 rounded-2xl border text-sm font-semibold shadow-none transition-colors',
                              adminAccessMode === 'online'
                                ? 'border-transparent bg-white/20 text-white'
                                : 'border-white/10 bg-transparent text-white/60 hover:bg-white/10 hover:text-white',
                            )}
                            onClick={() => setAdminAccessMode('online')}
                          >
                            Email e senha
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(
                              'h-10 rounded-2xl border text-sm font-semibold shadow-none',
                              adminAccessMode === 'offline'
                                ? 'border-[#1f56a5] bg-[#1f56a5] text-white hover:bg-[#194788] hover:text-white'
                                : 'border-[#d6deec] bg-white text-[#5f6f86] hover:bg-[#edf3fb] hover:text-[#24324a]',
                            )}
                            onClick={() => setAdminAccessMode('offline')}
                          >
                            Usuário e PIN
                          </Button>
                        </div>
                      </div>
                    )}

                    {adminAccessMode === 'offline' ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[14px] font-medium text-white/90">Usuário admin</Label>
                          <Input
                            id="happycash-admin-offline-username"
                            name="happycash-admin-offline-username"
                            value={adminOfflineUsername}
                            onChange={e => setAdminOfflineUsername(e.target.value)}
                            required
                            placeholder="Digite seu usuario"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[14px] font-medium text-white/90">PIN offline</Label>
                          <div className="relative">
                            <Input
                              id="happycash-admin-offline-pin"
                              name="happycash-admin-offline-pin"
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminOfflinePin}
                              onChange={e => setAdminOfflinePin(e.target.value)}
                              required
                              placeholder="Digite seu PIN"
                              autoComplete="off"
                              inputMode="numeric"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                              aria-label={showAdminPassword ? 'Ocultar PIN' : 'Mostrar PIN'}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[14px] font-medium text-white/90">E-mail</Label>
                          <Input
                            id="happycash-admin-email"
                            name="happycash-admin-email"
                            type="email"
                            value={email}
                            onChange={e => {
                              setEmail(e.target.value);
                              setAdminAccessCode('');
                              setAdminLoginVerificationRequired(false);
                              setAdminLoginAlert(null);
                            }}
                            required
                            placeholder="Digite seu e-mail"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-[14px] font-medium text-white/90">Senha</Label>
                            <a
                              href={MIAR_SITE_RECOVERY_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-sm font-medium text-white/60 transition-colors hover:text-white"
                            >
                              Recuperar no site
                            </a>
                          </div>
                          <div className="relative mt-2">
                            <Input
                              id="happycash-admin-password"
                              name="happycash-admin-password"
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminPassword}
                              onChange={e => {
                                setAdminPassword(e.target.value);
                                setAdminLoginAlert(null);
                              }}
                              required
                              placeholder="Digite sua senha"
                              minLength={6}
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                              aria-label={showAdminPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        {adminLoginVerificationRequired && (
                          <div className="space-y-2">
                            <Label className="text-[14px] font-medium text-white/90">Chave de acesso</Label>
                            <Input
                              id="happycash-admin-access-code"
                              name="happycash-admin-access-code"
                              value={adminAccessCode}
                              onChange={e => {
                                setAdminAccessCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                                setAdminLoginAlert(null);
                              }}
                              required
                              placeholder="00000000"
                              autoComplete="one-time-code"
                              inputMode="numeric"
                              className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 text-center text-[15px] font-bold tracking-[0.35em] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md"
                            />
                            <p className="text-xs leading-5 text-white/60">
                              Enviamos uma chave para reconhecer esta tentativa de entrada.
                            </p>
                          </div>
                        )}
                        {adminLoginAlert && (
                          <p className="rounded-2xl border-none bg-red-500/20 px-3 py-2 text-xs font-semibold leading-5 text-red-100 backdrop-blur-md">
                            {adminLoginAlert}
                          </p>
                        )}
                      </>
                    )}

                    <div className="grid gap-2 pt-0.5 sm:gap-2.5 sm:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="remember-admin-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                        <Label htmlFor="remember-admin-account" className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="keep-admin-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                        <Label htmlFor="keep-admin-connected" className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white">
                          Manter conectado
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-10 w-full rounded-2xl bg-white text-base font-semibold text-black hover:bg-white/90 sm:h-12 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-colors"
                      disabled={submitting || oauthSubmitting || (adminAccessMode === 'offline' && !offlineAdminAvailable)}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>

                    {canUseGoogleLogin && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full rounded-2xl border-white/20 bg-white/10 text-sm font-semibold text-white hover:bg-white/20 sm:h-12 backdrop-blur-md transition-colors shadow-none"
                        disabled={submitting || oauthSubmitting}
                        onClick={() => void handleGoogleLogin()}
                      >
                        {oauthSubmitting ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" />
                            Redirecionando...
                          </>
                        ) : (
                          'Google'
                        )}
                      </Button>
                    )}
                  </form>
                </TabsContent>

                <TabsContent value="operator" className="mt-3.5 sm:mt-5">
                  <form onSubmit={handleOperatorSubmit} className="space-y-3 sm:space-y-4" autoComplete="off">
                    <div className="space-y-2">
                      <Label className="text-[14px] font-medium text-white/90">Usuário</Label>
                      <Input
                        id="happycash-operator-username"
                        name="happycash-operator-username"
                        value={operatorUsername}
                        onChange={e => setOperatorUsername(e.target.value)}
                        required
                        placeholder="Digite seu usuário"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-[14px] font-medium text-white/90">Senha ou PIN</Label>
                        <button
                          type="button"
                          onClick={() => setOperatorRecoveryOpen(true)}
                          className="shrink-0 text-sm font-medium text-white/60 transition-colors hover:text-white"
                        >
                          Esqueci usuário ou PIN
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="happycash-operator-password"
                          name="happycash-operator-password"
                          type={showOperatorPassword ? 'text' : 'password'}
                          value={operatorPassword}
                          onChange={e => setOperatorPassword(e.target.value)}
                          required
                          placeholder="Digite sua senha"
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          className="h-10 rounded-2xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOperatorPassword(current => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                          aria-label={showOperatorPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showOperatorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 pt-0.5 sm:gap-2.5 sm:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="remember-operator-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                        <Label htmlFor="remember-operator-account" className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="keep-operator-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                        />
                        <Label htmlFor="keep-operator-connected" className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white">
                          Manter conectado
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="h-10 w-full rounded-2xl bg-white px-4 text-base font-semibold text-black hover:bg-white/90 sm:h-12 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-colors"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>

      <Dialog open={operatorRecoveryOpen} onOpenChange={handleOperatorRecoveryOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar acesso operacional</DialogTitle>
          </DialogHeader>

          {operatorRecoveryStep === 'email' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Um codigo sera enviado ao email do administrador da loja.
              </p>
              <div className="space-y-2">
                <Label>Email do administrador</Label>
                <Input
                  type="email"
                  value={operatorRecoveryEmail}
                  onChange={event => setOperatorRecoveryEmail(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                />
              </div>
              <Button className="w-full" onClick={() => void handleSendOperatorRecoveryCode()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar codigo
              </Button>
            </div>
          )}

          {operatorRecoveryStep === 'code' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Informe o codigo enviado para {operatorRecoveryEmail}.</p>
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input
                  inputMode="numeric"
                  value={operatorRecoveryCode}
                  onChange={event => setOperatorRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  autoComplete="one-time-code"
                />
              </div>
              <Button className="w-full" onClick={() => void handleVerifyOperatorRecoveryCode()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar codigo
              </Button>
            </div>
          )}

          {operatorRecoveryStep === 'reset' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={operatorRecoveryUserId} onValueChange={setOperatorRecoveryUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o usuario" /></SelectTrigger>
                  <SelectContent>
                    {operatorRecoveryList.map(operator => (
                      <SelectItem key={operator.user_id} value={operator.user_id}>{operator.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo PIN ou senha</Label>
                <Input
                  type="password"
                  value={operatorRecoveryPin}
                  onChange={event => setOperatorRecoveryPin(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button className="w-full" onClick={() => void handleResetOperatorCredential()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar novo acesso
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
