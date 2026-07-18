import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import happyCashLogo from '@/assets/login/happycash.svg';
import loginPdvRapido from '@/assets/login/pdvrapido.svg';
import loginRelatorios from '@/assets/login/relatorios.svg';
import loginErp from '@/assets/login/erp.svg';
import loginEstoque from '@/assets/login/estoque.svg';
import {
  applySystemSessionPreference,
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from '@/lib/authSessionPreferences';
import { clearDesktopActivation, readDesktopActivation } from '@/lib/desktopActivation';
import { readOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import type { Database } from '@/integrations/supabase/types';
import { getOperatorCredentialError } from '../../shared/security/operatorCredential';
import { requestTurnstileToken } from '../../shared/security/turnstile';

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

const HAPPY_CASH_SITE_RECOVERY_URL = 'https://www.happycashsite.com.br/login?recovery=1';

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
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI);
  const canUseGoogleLogin = adminAccessMode === 'online' && !isDesktop && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);

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

    try {
      const result = adminAccessMode === 'offline'
        ? await loginOfflineAdmin(adminOfflineUsername, adminOfflinePin)
        : await login(email, adminPassword, adminLoginVerificationRequired ? adminAccessCode : undefined);
      if (result !== true) {
        if (typeof result === 'object') {
          setAdminLoginVerificationRequired(Boolean(result.verificationRequired));
          if (result.verificationRequired) setAdminAccessCode('');
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
        applySystemSessionPreference(keepConnected);
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#eef3fb]">
      <div className="grid h-full lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, type: 'spring' }}
          className="relative hidden overflow-hidden bg-[linear-gradient(180deg,#5e79ff_0%,#5571f4_48%,#4d69e8_100%)] px-8 py-8 text-white lg:flex lg:items-start lg:justify-center xl:px-14"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(23,37,84,0.16),_transparent_40%)]" />
          <div className="relative flex w-full max-w-[32rem] flex-col items-center pt-6 text-center xl:pt-8">
            <motion.img
              src={happyCashLogo}
              alt="HappyCash"
              className="h-auto w-full max-w-[22rem] object-contain xl:max-w-[25rem]"
              loading="eager"
              decoding="async"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="mt-8 grid w-full max-w-[27rem] grid-cols-2 gap-x-8 gap-y-6 xl:mt-10 xl:gap-y-7">
              {loginFeatureCards.map((feature) => (
                <div key={feature.label} className="flex flex-col items-center gap-1 text-center">
                  <div className="flex h-[6.25rem] w-[8.75rem] items-center justify-center overflow-visible xl:h-[6.75rem] xl:w-[9.25rem]">
                    <img
                      src={feature.image}
                      alt={feature.label}
                      className={cn(
                        'h-auto max-w-none object-contain drop-shadow-[0_18px_30px_rgba(21,41,113,0.22)]',
                        feature.imageClassName,
                      )}
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <span className="w-[9rem] text-center text-[1.18rem] font-medium leading-tight tracking-[-0.02em] text-white/96 xl:text-[1.28rem]">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <main className="relative flex h-full items-center justify-center overflow-hidden bg-[#f8fbff] px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 xl:px-16">
          <div className="absolute inset-y-0 left-0 hidden w-px bg-[linear-gradient(180deg,rgba(77,105,232,0.16),rgba(77,105,232,0.05),transparent)] lg:block" />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, type: 'spring' }}
            className="w-full max-w-[28rem] max-[360px]:origin-center max-[360px]:scale-[0.93]"
          >
            <div className="rounded-[28px] border border-[#d7e0ef] bg-white/88 px-4 py-3 shadow-[0_26px_70px_rgba(29,78,216,0.12)] backdrop-blur-xl sm:p-6">
              <div className="space-y-1.5 pb-0 text-center lg:hidden">
                <img
                  src={happyCashLogo}
                  alt="HappyCash"
                  className="mx-auto h-auto w-full max-w-[15.25rem] object-contain sm:max-w-[16rem]"
                  loading="eager"
                  decoding="async"
                />
                <p className="mx-auto max-w-[17rem] text-[14px] font-semibold leading-snug tracking-[-0.02em] text-[#1f56a5] sm:max-w-[17rem] sm:text-[15px]">
                  Tecnologia simples para sua empresa.
                </p>
              </div>

              <div className="mt-2.5 sm:mt-3">
                <h1 className="text-[1.68rem] font-bold leading-none tracking-[-0.04em] text-[#1f56a5] sm:text-[2.2rem]">
                  Bem-vindo de volta
                </h1>
                <p className="mt-1 text-[14px] text-[#64748b] sm:mt-1.5 sm:text-base">
                  Faça login para continuar
                </p>
              </div>

              {desktopActivation && (
                <div className="mt-4 rounded-[20px] border border-[#d9e3f2] bg-[#f4f7fc] px-4 py-3 text-left text-[13px] leading-5 text-[#5f6f86] sm:text-sm sm:leading-6">
                  <p className="font-semibold text-[#24324a]">{desktopActivation.companyName}</p>
                  {!isDesktop && (
                    <p className="mt-1.5">
                      {offlineAdminAvailable
                        ? 'Empresa reconhecida nesta maquina. Ao entrar online, o desktop baixa os dados da loja e atualiza a copia local para uso offline.'
                        : 'Empresa reconhecida nesta maquina. No primeiro acesso, entre como administrador com email e senha para cadastrar o usuario admin offline desta maquina.'}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-[#1f56a5] transition-colors hover:text-[#194788]"
                    onClick={() => {
                      clearDesktopActivation();
                      window.location.reload();
                    }}
                  >
                    Trocar chave desta máquina
                  </button>
                </div>
              )}
              {!isOnline && !offlineAdminAvailable && (
                <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700 sm:text-sm sm:leading-6">
                  Esta maquina ainda nao tem usuario admin offline configurado. Conecte a internet, entre com email e senha e finalize o cadastro local.
                </div>
              )}

              <Tabs value={loginMode} onValueChange={value => setLoginMode(value as LoginMode)} className="mt-3.5 w-full sm:mt-5">
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-[18px] bg-[#eef2f8] p-1 text-[#7b879d] sm:h-11">
                  <TabsTrigger
                    value="admin"
                    className="rounded-[14px] text-[13px] font-semibold data-[state=active]:bg-[#1f56a5] data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm"
                  >
                    Administrador
                  </TabsTrigger>
                  <TabsTrigger
                    value="operator"
                    disabled={Boolean(desktopActivation && !offlineAdminAvailable)}
                    className="rounded-[14px] text-[13px] font-semibold data-[state=active]:bg-[#1f56a5] data-[state=active]:text-white data-[state=active]:shadow-none sm:text-sm"
                  >
                    Operacional
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="admin" className="mt-3.5 sm:mt-5">
                  <form onSubmit={handleAdminSubmit} className="space-y-3 sm:space-y-4" autoComplete="off">
                    {offlineAdminAvailable && (
                      <div className="rounded-[20px] border border-[#d9e3f2] bg-[#f4f7fc] p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(
                              'h-10 rounded-2xl border text-sm font-semibold shadow-none',
                              adminAccessMode === 'online'
                                ? 'border-[#1f56a5] bg-[#1f56a5] text-white hover:bg-[#194788] hover:text-white'
                                : 'border-[#d6deec] bg-white text-[#5f6f86] hover:bg-[#edf3fb] hover:text-[#24324a]',
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
                          <Label className="text-[15px] font-medium text-[#24324a]">Usuário admin</Label>
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
                            className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[15px] font-medium text-[#24324a]">PIN offline</Label>
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
                              className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 pr-12 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f8ea5] transition-colors hover:text-[#24324a]"
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
                          <Label className="text-[15px] font-medium text-[#24324a]">E-mail</Label>
                          <Input
                            id="happycash-admin-email"
                            name="happycash-admin-email"
                            type="email"
                            value={email}
                            onChange={e => {
                              setEmail(e.target.value);
                              setAdminAccessCode('');
                              setAdminLoginVerificationRequired(false);
                            }}
                            required
                            placeholder="Digite seu e-mail"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <Label className="text-[15px] font-medium text-[#24324a]">Senha</Label>
                            <a
                              href={HAPPY_CASH_SITE_RECOVERY_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-sm font-medium text-[#64748b] transition-colors hover:text-[#1f56a5]"
                            >
                              Recuperar no site
                            </a>
                          </div>
                          <div className="relative">
                            <Input
                              id="happycash-admin-password"
                              name="happycash-admin-password"
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminPassword}
                              onChange={e => setAdminPassword(e.target.value)}
                              required
                              placeholder="Digite sua senha"
                              minLength={6}
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 pr-12 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f8ea5] transition-colors hover:text-[#24324a]"
                              aria-label={showAdminPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        {adminLoginVerificationRequired && (
                          <div className="space-y-2">
                            <Label className="text-[15px] font-medium text-[#24324a]">Codigo de autorizacao</Label>
                            <Input
                              id="happycash-admin-access-code"
                              name="happycash-admin-access-code"
                              value={adminAccessCode}
                              onChange={e => setAdminAccessCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                              required
                              placeholder="00000000"
                              autoComplete="one-time-code"
                              inputMode="numeric"
                              className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 text-center text-[15px] font-bold tracking-[0.35em] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                            />
                            <p className="text-xs leading-5 text-[#64748b]">
                              Enviamos um codigo para reconhecer esta tentativa de entrada.
                            </p>
                          </div>
                        )}
                        <p className="rounded-2xl border border-[#d9e3f2] bg-[#f4f7fc] px-3 py-2 text-xs leading-5 text-[#64748b]">
                          Apos 3 tentativas incorretas, sera enviado um codigo ao e-mail para autorizar a entrada.
                        </p>
                      </>
                    )}

                    <div className="grid gap-2 pt-0.5 sm:gap-2.5 sm:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="remember-admin-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                        />
                        <Label htmlFor="remember-admin-account" className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="keep-admin-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                        />
                        <Label htmlFor="keep-admin-connected" className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm">
                          Manter conectado
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="h-10 w-full rounded-2xl bg-[#1f56a5] px-4 text-base font-semibold text-white hover:bg-[#194788] sm:h-11"
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
                        className="h-10 w-full rounded-2xl border-[#d6deec] bg-white text-sm font-semibold text-[#1f56a5] hover:bg-[#edf4ff]"
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
                      <Label className="text-[15px] font-medium text-[#24324a]">Usuário</Label>
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
                        className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-[15px] font-medium text-[#24324a]">Senha ou PIN</Label>
                        <button
                          type="button"
                          onClick={() => setOperatorRecoveryOpen(true)}
                          className="shrink-0 text-sm font-medium text-[#64748b] transition-colors hover:text-[#1f56a5]"
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
                          className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 pr-12 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOperatorPassword(current => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f8ea5] transition-colors hover:text-[#24324a]"
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
                          className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                        />
                        <Label htmlFor="remember-operator-account" className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          id="keep-operator-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                        />
                        <Label htmlFor="keep-operator-connected" className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm">
                          Manter conectado
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="h-10 w-full rounded-2xl bg-[#1f56a5] px-4 text-base font-semibold text-white hover:bg-[#194788] sm:h-11"
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
        </main>
      </div>

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
